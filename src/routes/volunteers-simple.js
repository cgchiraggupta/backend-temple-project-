// Simple Volunteer Routes - Working Version
const express = require('express');
const router = express.Router();
const supabaseService = require('../services/supabaseService');
const HybridUserService = require('../services/hybridUserService');

// Helper for Gmail email normalization
const normalizeEmail = (email) => HybridUserService.normalizeGmailAddress(email);

// GET all volunteers
router.get('/', async (req, res) => {
    try {
        const { community_id, status, limit = 50, page = 1 } = req.query;

        console.log('👥 Fetching volunteers with filters:', { community_id, status, limit, page });

        // Build base query conditions
        let countQuery = supabaseService.client
            .from('volunteers')
            .select('id', { count: 'exact', head: true });

        let dataQuery = supabaseService.client
            .from('volunteers')
            .select('*')
            .order('created_at', { ascending: false });

        // Apply filters to both queries
        if (community_id && community_id !== 'all') {
            countQuery = countQuery.eq('community_id', community_id);
            dataQuery = dataQuery.eq('community_id', community_id);
        }
        if (status && status !== 'all') {
            countQuery = countQuery.eq('status', status);
            dataQuery = dataQuery.eq('status', status);
        }

        // Get total count first
        const { count: totalCount, error: countError } = await countQuery;
        if (countError) throw countError;

        // Apply pagination to data query
        const offset = (parseInt(page) - 1) * parseInt(limit);
        dataQuery = dataQuery.range(offset, offset + parseInt(limit) - 1);

        const { data, error } = await dataQuery;

        if (error) throw error;

        // OPTIMIZED: Batch fetch all volunteer hours in a SINGLE query (fixes N+1)
        const volunteerIds = (data || []).map(v => v.id);
        let hoursMap = {};

        if (volunteerIds.length > 0) {
            const { data: attendanceData, error: attendanceError } = await supabaseService.client
                .from('volunteer_attendance')
                .select('volunteer_id, hours_worked')
                .in('volunteer_id', volunteerIds)
                .eq('status', 'completed');

            if (!attendanceError && attendanceData) {
                // Aggregate hours by volunteer_id
                for (const record of attendanceData) {
                    const vid = record.volunteer_id;
                    if (!hoursMap[vid]) hoursMap[vid] = 0;
                    hoursMap[vid] += parseFloat(record.hours_worked) || 0;
                }
            }
        }

        // Map hours to volunteers
        const volunteersWithHours = (data || []).map(volunteer => ({
            ...volunteer,
            total_hours_volunteered: Math.round((hoursMap[volunteer.id] || 0) * 100) / 100
        }));

        const total = totalCount || 0;
        const parsedLimit = parseInt(limit);
        const totalPages = Math.ceil(total / parsedLimit);

        res.json({
            success: true,
            data: volunteersWithHours || [],
            total,
            totalPages,
            page: parseInt(page),
            limit: parsedLimit
        });

    } catch (error) {
        console.error('Error fetching volunteers:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch volunteers',
            error: error.message
        });
    }
});

// POST create new volunteer (with automatic user creation)
router.post('/', async (req, res) => {
    try {
        const {
            community_id,
            first_name,
            last_name,
            email,
            phone,
            skills,
            interests,
            notes
        } = req.body;

        console.log('👥 Creating new volunteer:', { first_name, last_name, email });

        // Validate required fields
        if (!first_name || !last_name || !email) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: first_name, last_name, email'
            });
        }

        // Check if volunteer with this email already exists
        const { data: existingVolunteer } = await supabaseService.client
            .from('volunteers')
            .select('id')
            .eq('email', normalizeEmail(email))
            .maybeSingle();

        if (existingVolunteer) {
            return res.status(400).json({
                success: false,
                message: 'A volunteer with this email already exists'
            });
        }

        // Create volunteer data
        const volunteerData = {
            community_id: community_id || null,
            first_name,
            last_name,
            email: normalizeEmail(email),
            phone: phone || '',
            skills: Array.isArray(skills) ? skills : [],
            interests: Array.isArray(interests) ? interests : [],
            notes: notes || '',
            status: 'active',
            total_hours_volunteered: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        // Insert volunteer record
        const { data: volunteer, error } = await supabaseService.client
            .from('volunteers')
            .insert(volunteerData)
            .select('*')
            .single();

        if (error) throw error;

        console.log('✅ Volunteer created:', volunteer.id);

        // === CREATE USER ACCOUNT (if new email) ===
        let userCreated = false;
        let tempPassword = null;
        let newUser = null;

        try {
            const bcrypt = require('bcryptjs');

            // Generate random password function
            const generateRandomPassword = (length = 12) => {
                const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
                const lowercase = 'abcdefghijklmnopqrstuvwxyz';
                const numbers = '0123456789';
                const special = '!@#$%^&*';
                const allChars = uppercase + lowercase + numbers + special;
                let password = '';
                password += uppercase[Math.floor(Math.random() * uppercase.length)];
                password += lowercase[Math.floor(Math.random() * lowercase.length)];
                password += numbers[Math.floor(Math.random() * numbers.length)];
                password += special[Math.floor(Math.random() * special.length)];
                for (let i = password.length; i < length; i++) {
                    password += allChars[Math.floor(Math.random() * allChars.length)];
                }
                return password.split('').sort(() => Math.random() - 0.5).join('');
            };

            // Check if user already exists
            const { data: existingUser } = await supabaseService.client
                .from('users')
                .select('id')
                .eq('email', normalizeEmail(email))
                .maybeSingle();

            if (!existingUser) {
                // Generate temp password
                tempPassword = generateRandomPassword(12);
                console.log('🔐 Generated temp password for:', email);

                // Hash password
                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash(tempPassword, salt);

                // Create user
                const { randomUUID } = require('crypto');
                const { data: createdUser, error: userError } = await supabaseService.client
                    .from('users')
                    .insert({
                        id: randomUUID(),
                        email: normalizeEmail(email),
                        password_hash: hashedPassword,
                        full_name: `${first_name} ${last_name}`.trim(),
                        phone: phone || null,
                        role: 'volunteer',
                        status: 'active',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .select()
                    .single();

                if (userError) {
                    console.error('❌ Error creating user account:', userError);
                } else {
                    newUser = createdUser;
                    console.log('✅ User account created:', newUser.id);
                    userCreated = true;

                    // Link the volunteer record to user_id
                    if (volunteer?.id && newUser?.id) {
                        const { error: linkError } = await supabaseService.client
                            .from('volunteers')
                            .update({ user_id: newUser.id })
                            .eq('id', volunteer.id);

                        if (linkError) {
                            console.error('❌ Error linking volunteer to user:', linkError);
                        } else {
                            console.log('✅ Volunteer linked to user_id:', newUser.id);
                        }
                    }
                }
            } else {
                console.log('ℹ️ User already exists, linking volunteer to existing user');
                userCreated = true;
                tempPassword = null;

                // Link the volunteer record to existing user_id
                if (volunteer?.id && existingUser?.id) {
                    const { error: linkError } = await supabaseService.client
                        .from('volunteers')
                        .update({ user_id: existingUser.id })
                        .eq('id', volunteer.id);

                    if (linkError) {
                        console.error('❌ Error linking volunteer to existing user:', linkError);
                    } else {
                        console.log('✅ Volunteer linked to existing user_id:', existingUser.id);
                    }
                }
            }
        } catch (userCreateError) {
            console.error('❌ Error in user creation flow:', userCreateError);
        }

        // === SEND WELCOME EMAIL WITH CREDENTIALS ===
        let emailSent = false;
        if (tempPassword) {
            try {
                const emailService = require('../services/emailService-sendgrid');
                const frontendUrl = process.env.VITE_FRONTEND_URL || 'https://temple-management-woad.vercel.app';

                const emailHtml = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; }
                            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                            .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                            .header h1 { margin: 0; font-size: 24px; }
                            .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                            .welcome-box { background: #ecfdf5; border: 2px solid #10b981; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
                            .welcome-box h2 { color: #059669; margin: 0; }
                            .credentials-box { background: #fff7ed; border: 2px solid #f97316; padding: 20px; border-radius: 8px; margin: 20px 0; }
                            .credentials-box h3 { color: #ea580c; margin-top: 0; }
                            .credential-item { background: white; padding: 10px 15px; margin: 10px 0; border-radius: 5px; font-family: monospace; font-size: 14px; border: 1px solid #fed7aa; }
                            .button { display: inline-block; padding: 14px 35px; background: #10b981; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }
                            .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0; }
                            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <h1>🎉 Welcome to the Volunteer Team!</h1>
                                <p style="margin: 10px 0 0 0; opacity: 0.9;">You've been added as a volunteer</p>
                            </div>
                            <div class="content">
                                <div class="welcome-box">
                                    <h2>Hello ${first_name}!</h2>
                                    <p style="margin-bottom: 0;">You have been registered as a volunteer.</p>
                                </div>
                                
                                <div class="credentials-box">
                                    <h3>🔐 Your Login Credentials</h3>
                                    <p>Use these credentials to login:</p>
                                    <div class="credential-item">
                                        <strong>📧 Email:</strong> ${email.toLowerCase()}
                                    </div>
                                    <div class="credential-item">
                                        <strong>🔑 Temporary Password:</strong> ${tempPassword}
                                    </div>
                                </div>
                                
                                <div class="warning">
                                    <strong>⚠️ Important:</strong> Please change your password after your first login for security.
                                </div>
                                
                                <center>
                                    <a href="${frontendUrl}/login" class="button">
                                        Login to Your Account →
                                    </a>
                                </center>
                            </div>
                            <div class="footer">
                                <p>© ${new Date().getFullYear()} Temple Management System. All rights reserved.</p>
                            </div>
                        </div>
                    </body>
                    </html>
                `;

                await emailService.sendEmail({
                    from: `${process.env.EMAIL_FROM_NAME || 'Temple Admin'} <${process.env.EMAIL_FROM || 'noreply@temple.com'}>`,
                    to: email.toLowerCase(),
                    subject: '🎉 Welcome to the Volunteer Team - Your Login Credentials',
                    html: emailHtml
                });

                emailSent = true;
                console.log('✅ Welcome email sent to:', email);
            } catch (emailError) {
                console.error('❌ Error sending welcome email:', emailError);
            }
        }

        res.status(201).json({
            success: true,
            data: volunteer,
            user_created: userCreated,
            email_sent: emailSent,
            message: userCreated
                ? (tempPassword ? 'Volunteer created with new user account. Welcome email sent.' : 'Volunteer created and linked to existing user.')
                : 'Volunteer created successfully'
        });

    } catch (error) {
        console.error('Error creating volunteer:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create volunteer',
            error: error.message
        });
    }
});


// PUT update volunteer
router.put('/:id', async (req, res) => {
    try {
        const volunteerId = req.params.id;
        const updateData = { ...req.body };
        updateData.updated_at = new Date().toISOString();

        console.log('👥 Updating volunteer:', volunteerId);

        const { data, error } = await supabaseService.client
            .from('volunteers')
            .update(updateData)
            .eq('id', volunteerId)
            .select('*')
            .single();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({
                success: false,
                message: 'Volunteer not found'
            });
        }

        console.log('✅ Volunteer updated:', data.id);

        res.json({
            success: true,
            data: data,
            message: 'Volunteer updated successfully'
        });

    } catch (error) {
        console.error('Error updating volunteer:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update volunteer',
            error: error.message
        });
    }
});

// DELETE volunteer
router.delete('/:id', async (req, res) => {
    try {
        const volunteerId = req.params.id;

        console.log('👥 Deleting volunteer:', volunteerId);

        // First get the volunteer to find their email
        const { data: volunteer, error: fetchError } = await supabaseService.client
            .from('volunteers')
            .select('*')
            .eq('id', volunteerId)
            .single();

        if (fetchError || !volunteer) {
            return res.status(404).json({
                success: false,
                message: 'Volunteer not found'
            });
        }

        const volunteerEmail = volunteer.email;

        // Delete volunteer record
        const { error: deleteError } = await supabaseService.client
            .from('volunteers')
            .delete()
            .eq('id', volunteerId);

        if (deleteError) throw deleteError;
        console.log('✅ Volunteer deleted:', volunteerId);

        // Soft delete the volunteer application(s) (mark as 'deleted' instead of removing)
        let applicationMarkedDeleted = false;
        if (volunteerEmail) {
            console.log('🔄 Marking applications as deleted for email:', volunteerEmail);
            const { data: updatedApps, error: appError } = await supabaseService.client
                .from('volunteer_applications')
                .update({
                    status: 'deleted',
                    updated_at: new Date().toISOString()
                })
                .eq('email', volunteerEmail.toLowerCase())
                .select('id');

            if (appError) {
                console.error('❌ Error marking applications as deleted:', appError);
            } else if (updatedApps && updatedApps.length > 0) {
                console.log('✅ Volunteer application(s) marked as deleted:', updatedApps.map(a => a.id));
                applicationMarkedDeleted = true;
            } else {
                console.log('⚠️ No applications found to mark as deleted');
            }
        }


        // Note: We do NOT delete the user account - they might still be a community member

        res.json({
            success: true,
            data: volunteer,
            applicationMarkedDeleted,
            message: 'Volunteer deleted and application marked as deleted'
        });



    } catch (error) {
        console.error('Error deleting volunteer:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete volunteer',
            error: error.message
        });
    }
});


// =============================================
// VOLUNTEER SHIFTS ROUTES
// =============================================

// GET all volunteer shifts
router.get('/shifts', async (req, res) => {
    try {
        const { community_id, status, date, limit = 50, page = 1 } = req.query;

        console.log('📅 Fetching volunteer shifts with filters:', { community_id, status, date, limit, page });

        // Build count and data queries
        let countQuery = supabaseService.client
            .from('volunteer_shifts')
            .select('id', { count: 'exact', head: true });

        let dataQuery = supabaseService.client
            .from('volunteer_shifts')
            .select('*')
            .order('created_at', { ascending: false });

        // Apply filters to both queries
        if (community_id && community_id !== 'all') {
            countQuery = countQuery.eq('community_id', community_id);
            dataQuery = dataQuery.eq('community_id', community_id);
        }
        if (status && status !== 'all') {
            countQuery = countQuery.eq('status', status);
            dataQuery = dataQuery.eq('status', status);
        }
        if (date) {
            countQuery = countQuery.eq('shift_date', date);
            dataQuery = dataQuery.eq('shift_date', date);
        }

        // Get total count
        const { count: totalCount, error: countError } = await countQuery;
        if (countError) throw countError;

        // Apply pagination to data query
        const offset = (parseInt(page) - 1) * parseInt(limit);
        dataQuery = dataQuery.range(offset, offset + parseInt(limit) - 1);

        const { data, error } = await dataQuery;

        if (error) throw error;

        const total = totalCount || 0;
        const parsedLimit = parseInt(limit);
        const totalPages = Math.ceil(total / parsedLimit);

        res.json({
            success: true,
            data: data || [],
            total,
            totalPages,
            page: parseInt(page),
            limit: parsedLimit
        });

    } catch (error) {
        console.error('Error fetching volunteer shifts:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch volunteer shifts',
            error: error.message
        });
    }
});

// POST create new volunteer shift
router.post('/shifts', async (req, res) => {
    try {
        const {
            community_id,
            title,
            description,
            location,
            shift_date,
            start_time,
            end_time,
            required_volunteers,
            skills_required
        } = req.body;

        console.log('📅 Creating new volunteer shift:', { title, shift_date, location });

        // Validate required fields
        if (!title || !shift_date || !start_time || !end_time) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: title, shift_date, start_time, end_time'
            });
        }

        const shiftData = {
            community_id: community_id || null,
            title,
            description: description || '',
            location: location || '',
            shift_date,
            start_time,
            end_time,
            required_volunteers: parseInt(required_volunteers) || 1,
            skills_required: Array.isArray(skills_required) ? skills_required : [],
            status: 'open',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const { data, error } = await supabaseService.client
            .from('volunteer_shifts')
            .insert(shiftData)
            .select('*')
            .single();

        if (error) throw error;

        console.log('✅ Volunteer shift created:', data.id);

        res.status(201).json({
            success: true,
            data: data,
            message: 'Volunteer shift created successfully'
        });

    } catch (error) {
        console.error('Error creating volunteer shift:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create volunteer shift',
            error: error.message
        });
    }
});

// PUT update volunteer shift
router.put('/shifts/:id', async (req, res) => {
    try {
        const shiftId = req.params.id;
        const updateData = { ...req.body };
        updateData.updated_at = new Date().toISOString();

        console.log('📅 Updating volunteer shift:', shiftId);

        const { data, error } = await supabaseService.client
            .from('volunteer_shifts')
            .update(updateData)
            .eq('id', shiftId)
            .select('*')
            .single();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({
                success: false,
                message: 'Volunteer shift not found'
            });
        }

        console.log('✅ Volunteer shift updated:', data.id);

        res.json({
            success: true,
            data: data,
            message: 'Volunteer shift updated successfully'
        });

    } catch (error) {
        console.error('Error updating volunteer shift:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update volunteer shift',
            error: error.message
        });
    }
});

// DELETE volunteer shift
router.delete('/shifts/:id', async (req, res) => {
    try {
        const shiftId = req.params.id;

        console.log('📅 Deleting volunteer shift:', shiftId);

        const { data, error } = await supabaseService.client
            .from('volunteer_shifts')
            .delete()
            .eq('id', shiftId)
            .select('*')
            .single();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({
                success: false,
                message: 'Volunteer shift not found'
            });
        }

        console.log('✅ Volunteer shift deleted:', data.id);

        res.json({
            success: true,
            data: data,
            message: 'Volunteer shift deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting volunteer shift:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete volunteer shift',
            error: error.message
        });
    }
});

// =============================================
// VOLUNTEER ATTENDANCE ROUTES
// =============================================

// GET volunteer attendance records
router.get('/attendance', async (req, res) => {
    try {
        const { volunteer_id, shift_id, date, limit = 50, page = 1 } = req.query;

        console.log('📊 Fetching attendance with filters:', { volunteer_id, shift_id, date, limit, page });

        // If date filter is provided, we need to handle it differently
        // First get shift IDs for the date, then filter attendance by those shifts
        let shiftIdsForDate = null;
        if (date) {
            const { data: shiftsOnDate } = await supabaseService.client
                .from('volunteer_shifts')
                .select('id')
                .eq('shift_date', date);

            if (shiftsOnDate && shiftsOnDate.length > 0) {
                shiftIdsForDate = shiftsOnDate.map(s => s.id);
            } else {
                // No shifts on this date, return empty
                return res.json({
                    success: true,
                    data: [],
                    total: 0,
                    totalPages: 0,
                    page: parseInt(page),
                    limit: parseInt(limit)
                });
            }
        }

        // Build count and data queries
        let countQuery = supabaseService.client
            .from('volunteer_attendance')
            .select('id', { count: 'exact', head: true });

        let dataQuery = supabaseService.client
            .from('volunteer_attendance')
            .select('*')
            .order('created_at', { ascending: false });

        // Apply filters to both queries
        if (volunteer_id && volunteer_id !== 'all') {
            countQuery = countQuery.eq('volunteer_id', volunteer_id);
            dataQuery = dataQuery.eq('volunteer_id', volunteer_id);
        }
        if (shift_id && shift_id !== 'all') {
            countQuery = countQuery.eq('shift_id', shift_id);
            dataQuery = dataQuery.eq('shift_id', shift_id);
        }

        // Use the shift IDs to filter by date (more reliable than attendance_date)
        if (shiftIdsForDate) {
            countQuery = countQuery.in('shift_id', shiftIdsForDate);
            dataQuery = dataQuery.in('shift_id', shiftIdsForDate);
        }

        // Get total count
        const { count: totalCount, error: countError } = await countQuery;
        if (countError) throw countError;

        // Apply pagination to data query
        const offset = (parseInt(page) - 1) * parseInt(limit);
        dataQuery = dataQuery.range(offset, offset + parseInt(limit) - 1);

        const { data: attendanceData, error } = await dataQuery;

        if (error) throw error;

        // Fetch volunteer and shift details separately if needed
        const enrichedData = await Promise.all((attendanceData || []).map(async (attendance) => {
            let volunteer = null;
            let shift = null;

            // Fetch volunteer details
            if (attendance.volunteer_id) {
                const { data: volunteerData } = await supabaseService.client
                    .from('volunteers')
                    .select('id, first_name, last_name, email')
                    .eq('id', attendance.volunteer_id)
                    .single();
                volunteer = volunteerData;
            }

            // Fetch shift details
            if (attendance.shift_id) {
                const { data: shiftData } = await supabaseService.client
                    .from('volunteer_shifts')
                    .select('id, title, shift_date, start_time, end_time, location')
                    .eq('id', attendance.shift_id)
                    .single();
                shift = shiftData;
            }

            return {
                ...attendance,
                volunteers: volunteer,
                volunteer_shifts: shift
            };
        }));

        const total = totalCount || 0;
        const parsedLimit = parseInt(limit);
        const totalPages = Math.ceil(total / parsedLimit);

        res.json({
            success: true,
            data: enrichedData || [],
            total,
            totalPages,
            page: parseInt(page),
            limit: parsedLimit
        });

    } catch (error) {
        console.error('Error fetching attendance:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch attendance',
            error: error.message
        });
    }
});

// POST create attendance record (for manual marking)
router.post('/attendance', async (req, res) => {
    try {
        const { volunteer_id, shift_id, status, check_in_time, check_out_time, notes } = req.body;

        console.log('📝 Creating attendance record:', { volunteer_id, shift_id, status });

        // Validate required fields
        if (!volunteer_id || !shift_id || !status) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: volunteer_id, shift_id, status'
            });
        }

        // Fetch the shift to get the shift_date for attendance_date
        let attendance_date = null;
        const { data: shiftData } = await supabaseService.client
            .from('volunteer_shifts')
            .select('shift_date')
            .eq('id', shift_id)
            .single();

        if (shiftData) {
            attendance_date = shiftData.shift_date;
        }

        const attendanceData = {
            volunteer_id,
            shift_id,
            status,
            attendance_date,
            check_in_time: check_in_time || null,
            check_out_time: check_out_time || null,
            notes: notes || '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const { data, error } = await supabaseService.client
            .from('volunteer_attendance')
            .insert(attendanceData)
            .select('*')
            .single();

        if (error) throw error;

        console.log('✅ Attendance record created:', data.id, 'for date:', attendance_date);

        res.status(201).json({
            success: true,
            data: data,
            message: 'Attendance record created successfully'
        });

    } catch (error) {
        console.error('Error creating attendance record:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create attendance record',
            error: error.message
        });
    }
});

// PUT update attendance status
router.put('/attendance/:id', async (req, res) => {
    try {
        const attendanceId = req.params.id;
        const { status, check_in_time, check_out_time, notes } = req.body;

        console.log('📝 Updating attendance:', attendanceId, 'status:', status);

        const updateData = {
            status,
            notes: notes || '',
            updated_at: new Date().toISOString()
        };

        if (check_in_time) updateData.check_in_time = check_in_time;
        if (check_out_time) updateData.check_out_time = check_out_time;

        const { data, error } = await supabaseService.client
            .from('volunteer_attendance')
            .update(updateData)
            .eq('id', attendanceId)
            .select('*')
            .single();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({
                success: false,
                message: 'Attendance record not found'
            });
        }

        console.log('✅ Attendance updated:', data.id);

        res.json({
            success: true,
            data: data,
            message: 'Attendance updated successfully'
        });

    } catch (error) {
        console.error('Error updating attendance:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update attendance',
            error: error.message
        });
    }
});

// POST check-in volunteer
router.post('/attendance/checkin', async (req, res) => {
    try {
        const { volunteer_id, shift_id, notes } = req.body;

        console.log('✅ Checking in volunteer:', volunteer_id, 'for shift:', shift_id);

        // Validate required fields
        if (!volunteer_id || !shift_id) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: volunteer_id, shift_id'
            });
        }

        // Fetch the shift to get the shift_date for attendance_date
        let attendance_date = null;
        const { data: shiftData } = await supabaseService.client
            .from('volunteer_shifts')
            .select('shift_date')
            .eq('id', shift_id)
            .single();

        if (shiftData) {
            attendance_date = shiftData.shift_date;
        }

        const attendanceData = {
            volunteer_id,
            shift_id,
            attendance_date,
            check_in_time: new Date().toISOString(),
            status: 'present',
            notes: notes || '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const { data, error } = await supabaseService.client
            .from('volunteer_attendance')
            .insert(attendanceData)
            .select('*')
            .single();

        if (error) throw error;

        console.log('✅ Volunteer checked in:', data.id, 'for date:', attendance_date);

        res.status(201).json({
            success: true,
            data: data,
            message: 'Volunteer checked in successfully'
        });

    } catch (error) {
        console.error('Error checking in volunteer:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check in volunteer',
            error: error.message
        });
    }
});

// PUT check-out volunteer
router.put('/attendance/:id/checkout', async (req, res) => {
    try {
        const attendanceId = req.params.id;
        const { notes } = req.body;

        console.log('⏰ Checking out volunteer attendance:', attendanceId);

        // First, get the existing attendance record to get check_in_time
        const { data: existingAttendance, error: fetchError } = await supabaseService.client
            .from('volunteer_attendance')
            .select('*')
            .eq('id', attendanceId)
            .single();

        if (fetchError || !existingAttendance) {
            return res.status(404).json({
                success: false,
                message: 'Attendance record not found'
            });
        }

        const checkOutTime = new Date();
        let hoursWorked = 0;

        // Calculate hours worked if check_in_time exists
        if (existingAttendance.check_in_time) {
            const checkInTime = new Date(existingAttendance.check_in_time);
            hoursWorked = (checkOutTime - checkInTime) / (1000 * 60 * 60); // Convert ms to hours
            hoursWorked = Math.round(hoursWorked * 100) / 100; // Round to 2 decimal places
        }

        const updateData = {
            check_out_time: checkOutTime.toISOString(),
            status: 'completed',
            hours_worked: hoursWorked,
            notes: notes || existingAttendance.notes || '',
            updated_at: new Date().toISOString()
        };

        const { data, error } = await supabaseService.client
            .from('volunteer_attendance')
            .update(updateData)
            .eq('id', attendanceId)
            .select('*')
            .single();

        if (error) throw error;

        console.log(`✅ Volunteer checked out: ${data.id}, Hours worked: ${hoursWorked}`);

        res.json({
            success: true,
            data: data,
            hours_worked: hoursWorked,
            message: `Volunteer checked out successfully. Hours worked: ${hoursWorked.toFixed(2)}`
        });

    } catch (error) {
        console.error('Error checking out volunteer:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check out volunteer',
            error: error.message
        });
    }
});

// =============================================
// VOLUNTEER APPLICATIONS ROUTES
// =============================================

// GET all volunteer applications
router.get('/applications', async (req, res) => {
    try {
        const { community_id, status, limit = 50, page = 1 } = req.query;

        console.log('📝 Fetching volunteer applications with filters:', { community_id, status, limit, page });

        // Build count and data queries
        let countQuery = supabaseService.client
            .from('volunteer_applications')
            .select('id', { count: 'exact', head: true });

        let dataQuery = supabaseService.client
            .from('volunteer_applications')
            .select('*')
            .order('applied_at', { ascending: false });

        // Apply filters to both queries
        if (community_id && community_id !== 'all') {
            countQuery = countQuery.eq('community_id', community_id);
            dataQuery = dataQuery.eq('community_id', community_id);
        }
        if (status && status !== 'all') {
            countQuery = countQuery.eq('status', status);
            dataQuery = dataQuery.eq('status', status);
        }

        // Get total count
        const { count: totalCount, error: countError } = await countQuery;

        // Handle count error (table might not exist)
        if (countError) {
            if (countError.message.includes('volunteer_applications') || countError.message.includes('relation')) {
                console.log('⚠️ Volunteer applications table not found, returning empty data');
                return res.json({
                    success: true,
                    data: [],
                    total: 0,
                    totalPages: 0,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    message: 'Volunteer applications table not found. Please apply database schema.'
                });
            }
            throw countError;
        }

        // Apply pagination to data query
        const offset = (parseInt(page) - 1) * parseInt(limit);
        dataQuery = dataQuery.range(offset, offset + parseInt(limit) - 1);

        const { data, error } = await dataQuery;

        if (error) {
            console.error('Supabase error:', error);
            throw error;
        }

        const total = totalCount || 0;
        const parsedLimit = parseInt(limit);
        const totalPages = Math.ceil(total / parsedLimit);

        console.log('✅ Found', data?.length || 0, 'volunteer applications (total:', total, ')');

        res.json({
            success: true,
            data: data || [],
            total,
            totalPages,
            page: parseInt(page),
            limit: parsedLimit
        });

    } catch (error) {
        console.error('Error fetching volunteer applications:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch volunteer applications',
            error: error.message
        });
    }
});

// POST create new volunteer application
router.post('/applications', async (req, res) => {
    try {
        const {
            community_id,
            first_name,
            last_name,
            email,
            phone,
            skills,
            interests,
            motivation,
            experience,
            user_id
        } = req.body;

        console.log('📝 Creating volunteer application:', { first_name, last_name, email });

        // Validate required fields
        if (!first_name || !email || !phone) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: first_name, email, phone'
            });
        }

        const applicationData = {
            community_id: community_id || null,
            first_name,
            last_name: last_name || '',
            email,
            phone,
            skills: Array.isArray(skills) ? skills : [],
            interests: Array.isArray(interests) ? interests : [],
            motivation: motivation || '',
            experience: experience || '',
            status: 'pending',
            applied_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const { data, error } = await supabaseService.client
            .from('volunteer_applications')
            .insert(applicationData)
            .select('*')
            .single();

        if (error) {
            console.error('Supabase error:', error);
            throw error;
        }

        console.log('✅ Volunteer application created:', data.id);

        res.status(201).json({
            success: true,
            data: data,
            message: 'Volunteer application submitted successfully'
        });

    } catch (error) {
        console.error('Error creating volunteer application:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit volunteer application',
            error: error.message
        });
    }
});

// PUT approve volunteer application
router.put('/applications/:id/approve', async (req, res) => {
    try {
        const applicationId = req.params.id;
        const { reviewed_by, notes } = req.body;

        console.log('✅ Approving volunteer application:', applicationId);

        // First, update the application status
        const { data: application, error: updateError } = await supabaseService.client
            .from('volunteer_applications')
            .update({
                status: 'approved',
                reviewed_at: new Date().toISOString(),
                reviewed_by: null,
                review_notes: notes || '',
                updated_at: new Date().toISOString()
            })
            .eq('id', applicationId)
            .select('*')
            .single();

        if (updateError) throw updateError;

        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Volunteer application not found'
            });
        }

        // Create volunteer record from approved application
        console.log('👥 Creating volunteer record from approved application...');

        const volunteerData = {
            first_name: application.first_name || '',
            last_name: application.last_name || '',
            email: application.email,
            phone: application.phone || null,
            skills: application.skills || [],
            interests: application.interests || [],
            status: 'active',
            total_hours_volunteered: 0,
            community_id: application.community_id || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const { data: volunteer, error: volunteerError } = await supabaseService.client
            .from('volunteers')
            .insert(volunteerData)
            .select('*')
            .single();

        if (volunteerError) {
            console.error('❌ Error creating volunteer record:', volunteerError);
        } else {
            console.log('✅ Volunteer record created:', volunteer.id);
        }

        // Create user account with temporary password
        let userCreated = false;
        let tempPassword = null;
        let newUser = null; // Declare in outer scope to fix variable scope bug

        try {
            const bcrypt = require('bcryptjs');

            // Generate random password
            const generateRandomPassword = (length = 12) => {
                const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
                const lowercase = 'abcdefghijklmnopqrstuvwxyz';
                const numbers = '0123456789';
                const special = '!@#$%^&*';
                const allChars = uppercase + lowercase + numbers + special;
                let password = '';
                password += uppercase[Math.floor(Math.random() * uppercase.length)];
                password += lowercase[Math.floor(Math.random() * lowercase.length)];
                password += numbers[Math.floor(Math.random() * numbers.length)];
                password += special[Math.floor(Math.random() * special.length)];
                for (let i = password.length; i < length; i++) {
                    password += allChars[Math.floor(Math.random() * allChars.length)];
                }
                return password.split('').sort(() => Math.random() - 0.5).join('');
            };

            tempPassword = generateRandomPassword(12);
            console.log('🔐 Generated temp password for:', application.email);

            // Check if user already exists
            const { data: existingUser } = await supabaseService.client
                .from('users')
                .select('id')
                .eq('email', normalizeEmail(application.email))
                .maybeSingle();

            if (!existingUser) {
                // Hash password
                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash(tempPassword, salt);

                // Create user
                const { randomUUID } = require('crypto');
                const { data: createdUser, error: userError } = await supabaseService.client
                    .from('users')
                    .insert({
                        id: randomUUID(),
                        email: normalizeEmail(application.email),
                        password_hash: hashedPassword,
                        full_name: `${application.first_name} ${application.last_name}`.trim(),
                        phone: application.phone || null,
                        role: 'volunteer',
                        status: 'active',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .select()
                    .single();


                if (userError) {
                    console.error('❌ Error creating user account:', userError);
                } else {
                    newUser = createdUser; // Assign to outer scope variable
                    console.log('✅ User account created:', newUser.id);
                    userCreated = true;

                    // Link the volunteer record to user_id
                    if (volunteer?.id && newUser?.id) {
                        const { error: linkError } = await supabaseService.client
                            .from('volunteers')
                            .update({ user_id: newUser.id })
                            .eq('id', volunteer.id);

                        if (linkError) {
                            console.error('❌ Error linking volunteer to user:', linkError);
                        } else {
                            console.log('✅ Volunteer linked to user_id:', newUser.id);
                        }
                    }
                }
            } else {
                console.log('ℹ️ User already exists, skipping user creation - will send approval email only');
                userCreated = true;
                tempPassword = null; // Don't send new password to existing users

                // Link the volunteer record to existing user_id
                if (volunteer?.id && existingUser?.id) {
                    const { error: linkError } = await supabaseService.client
                        .from('volunteers')
                        .update({ user_id: existingUser.id })
                        .eq('id', volunteer.id);

                    if (linkError) {
                        console.error('❌ Error linking volunteer to existing user:', linkError);
                    } else {
                        console.log('✅ Volunteer linked to existing user_id:', existingUser.id);
                    }
                }
            }
        } catch (userCreateError) {
            console.error('❌ Error in user creation:', userCreateError);
        }

        // Send approval email with credentials
        let emailSent = false;
        let emailErrorMessage = null;
        try {
            const emailService = require('../services/emailService-sendgrid');

            const emailHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                        .header h1 { margin: 0; font-size: 24px; }
                        .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                        .success-box { background: #ecfdf5; border: 2px solid #10b981; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
                        .success-box h2 { color: #059669; margin: 0; }
                        .credentials-box { background: #fff7ed; border: 2px solid #f97316; padding: 20px; border-radius: 8px; margin: 20px 0; }
                        .credentials-box h3 { color: #ea580c; margin-top: 0; }
                        .credential-item { background: white; padding: 10px 15px; margin: 10px 0; border-radius: 5px; font-family: monospace; font-size: 14px; border: 1px solid #fed7aa; }
                        .credential-label { color: #9a3412; font-weight: bold; font-family: Arial, sans-serif; }
                        .app-download { background: #eff6ff; border: 2px solid #3b82f6; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
                        .app-download h3 { color: #1d4ed8; margin-top: 0; }
                        .button { display: inline-block; padding: 14px 35px; background: #10b981; color: white; text-decoration: none; border-radius: 8px; margin: 10px 5px; font-weight: bold; }
                        .button-secondary { background: #3b82f6; }
                        .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0; }
                        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🎉 Welcome to the Volunteer Team!</h1>
                            <p style="margin: 10px 0 0 0; opacity: 0.9;">Your application has been approved</p>
                        </div>
                        <div class="content">
                            <div class="success-box">
                                <h2>✅ Congratulations, ${application.first_name}!</h2>
                                <p style="margin-bottom: 0;">Your volunteer application has been approved.</p>
                            </div>
                            
                            ${tempPassword ? `
                            <div class="credentials-box">
                                <h3>🔐 Your Login Credentials</h3>
                                <p>Use these credentials to login to the mobile app:</p>
                                
                                <div class="credential-item">
                                    <span class="credential-label">Email:</span><br>
                                    <strong>${application.email}</strong>
                                </div>
                                
                                <div class="credential-item">
                                    <span class="credential-label">Temporary Password:</span><br>
                                    <strong>${tempPassword}</strong>
                                </div>
                            </div>
                            ` : ''}
                            
                            <div class="app-download">
                                <h3>📱 Download Our Mobile App</h3>
                                <p>Get the Sai Samsthan app to manage your volunteer activities:</p>
                                <a href="#" class="button button-secondary">Download for Android</a>
                                <a href="#" class="button button-secondary">Download for iOS</a>
                            </div>
                            
                            <div class="warning">
                                <strong>⚠️ Important:</strong><br>
                                Please change your password after your first login for security.
                            </div>
                            
                            <p><strong>As a volunteer, you can:</strong></p>
                            <ul>
                                <li>View and sign up for volunteer shifts</li>
                                <li>Track your volunteer hours</li>
                                <li>Receive notifications about upcoming events</li>
                                <li>Connect with other volunteers</li>
                            </ul>
                            
                            <p style="color: #666; font-size: 14px; margin-top: 30px;">
                                If you have any questions, please contact the volunteer coordinator.
                            </p>
                        </div>
                        <div class="footer">
                            <p>© ${new Date().getFullYear()} Sai Samsthan. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `;

            const result = await emailService.sendEmail({
                from: process.env.EMAIL_FROM || 'noreply@saisamsthan.org',
                to: application.email,
                subject: '🎉 Your Volunteer Application Has Been Approved!',
                html: emailHtml
            });

            console.log('✅ Approval email sent to:', application.email);
            console.log('📧 Email result:', JSON.stringify(result, null, 2));
            emailSent = true;
        } catch (emailError) {
            console.error('⚠️ Failed to send approval email:', emailError.message);
            emailErrorMessage = emailError.message;
            if (emailError.response) {
                console.error('📧 SendGrid Error Status:', emailError.response.statusCode);
                console.error('📧 SendGrid Error Body:', JSON.stringify(emailError.response.body, null, 2));
                emailErrorMessage += ` (Status: ${emailError.response.statusCode})`;
            }
        }

        res.json({
            success: true,
            data: application,
            volunteer: volunteer || null,
            userCreated,
            emailSent,
            emailError: emailErrorMessage,
            message: emailSent
                ? 'Volunteer application approved successfully and email sent'
                : `Volunteer application approved but email failed: ${emailErrorMessage || 'Unknown error'}`
        });

    } catch (error) {
        console.error('Error approving volunteer application:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to approve volunteer application',
            error: error.message
        });
    }
});


// PUT reject volunteer application
router.put('/applications/:id/reject', async (req, res) => {
    try {
        const applicationId = req.params.id;
        const { reviewed_by, rejection_reason, notes } = req.body;

        console.log('❌ Rejecting volunteer application:', applicationId);

        const { data, error } = await supabaseService.client
            .from('volunteer_applications')
            .update({
                status: 'rejected',
                reviewed_at: new Date().toISOString(),
                reviewed_by: null, // TODO: Use actual user UUID when auth is implemented
                review_notes: notes || rejection_reason || 'Application rejected',
                updated_at: new Date().toISOString()
            })
            .eq('id', applicationId)
            .select('*')
            .single();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({
                success: false,
                message: 'Volunteer application not found'
            });
        }

        console.log('✅ Volunteer application rejected:', data.id);

        res.json({
            success: true,
            data: data,
            message: 'Volunteer application rejected'
        });

    } catch (error) {
        console.error('Error rejecting volunteer application:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reject volunteer application',
            error: error.message
        });
    }
});

// PUT update application status (for under-review, interview scheduling, etc.)
router.put('/applications/:id/status', async (req, res) => {
    try {
        const applicationId = req.params.id;
        const { status, notes, interview_date, background_check } = req.body;

        console.log('📝 Updating volunteer application status:', applicationId, 'to:', status);

        const updateData = {
            status,
            review_notes: notes || '',
            updated_at: new Date().toISOString()
        };

        if (interview_date) {
            updateData.interview_scheduled = true;
            updateData.interview_date = interview_date;
        }

        if (background_check) {
            updateData.background_check = background_check;
        }

        const { data, error } = await supabaseService.client
            .from('volunteer_applications')
            .update(updateData)
            .eq('id', applicationId)
            .select('*')
            .single();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({
                success: false,
                message: 'Volunteer application not found'
            });
        }

        console.log('✅ Volunteer application status updated:', data.id);

        res.json({
            success: true,
            data: data,
            message: 'Volunteer application updated successfully'
        });

    } catch (error) {
        console.error('Error updating volunteer application:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update volunteer application',
            error: error.message
        });
    }
});

module.exports = router;