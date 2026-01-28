const supabaseService = require('../supabaseService');

class ApplicationService {
    // Submit a new application
    async submitApplication(applicationData) {
        try {
            const { data, error } = await supabaseService.client
                .from('community_applications')
                .insert(applicationData)
                .select('*')
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error submitting application:', error);
            return { success: false, error: error.message };
        }
    }

    // Get applications for a community
    async getApplications(communityId, status = null) {
        try {
            let query = supabaseService.client
                .from('community_applications')
                .select('*')
                .eq('community_id', communityId)
                .order('applied_at', { ascending: false });

            if (status) {
                query = query.eq('status', status);
            }

            const { data, error } = await query;

            if (error) throw error;
            return { success: true, data: data || [] };
        } catch (error) {
            console.error('Error fetching applications:', error);
            return { success: false, error: error.message };
        }
    }

    // Get single application
    async getApplication(applicationId) {
        try {
            const { data, error } = await supabaseService.client
                .from('community_applications')
                .select('*')
                .eq('id', applicationId)
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error fetching application:', error);
            return { success: false, error: error.message };
        }
    }

    // Approve application (with user creation and email)
    async approveApplication(applicationId, reviewedBy) {
        try {
            console.log('🔄 Approving application:', applicationId);

            // Update application status
            const { data, error } = await supabaseService.client
                .from('community_applications')
                .update({
                    status: 'approved',
                    reviewed_at: new Date().toISOString(),
                    reviewed_by: reviewedBy || null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', applicationId)
                .select('*')
                .single();

            if (error) throw error;

            if (!data) {
                return { success: false, error: 'Application not found' };
            }

            console.log('✅ Application approved successfully:', applicationId);

            // Get community name for email
            const { data: community } = await supabaseService.client
                .from('communities')
                .select('name')
                .eq('id', data.community_id)
                .single();

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
                console.log('🔐 Generated temp password for:', data.email);

                // Check if user already exists
                const { data: existingUser } = await supabaseService.client
                    .from('users')
                    .select('id')
                    .eq('email', data.email.toLowerCase())
                    .maybeSingle();

                if (!existingUser) {
                    const salt = await bcrypt.genSalt(10);
                    const hashedPassword = await bcrypt.hash(tempPassword, salt);

                    const { randomUUID } = require('crypto');
                    const { data: createdUser, error: userError } = await supabaseService.client
                        .from('users')
                        .insert({
                            id: randomUUID(),
                            email: data.email.toLowerCase(),
                            password_hash: hashedPassword,
                            full_name: data.name,
                            phone: data.phone || null,
                            role: 'community_member',
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
                    }
                } else {
                    console.log('ℹ️ User already exists - will send approval email only');
                    userCreated = true;
                    tempPassword = null; // Don't send new password to existing users
                }

                // Get the user ID (either new or existing) - now works correctly
                const userId = existingUser?.id || newUser?.id;

                // Add user to community_members - THIS IS THE CRITICAL FIX
                if (userId) {
                    console.log('📝 Adding user to community_members:', userId, data.community_id);

                    // Check if already a member (avoid duplicates)
                    const { data: existingMember } = await supabaseService.client
                        .from('community_members')
                        .select('id')
                        .eq('community_id', data.community_id)
                        .eq('user_id', userId)
                        .maybeSingle();

                    if (!existingMember) {
                        const { error: memberError } = await supabaseService.client
                            .from('community_members')
                            .insert({
                                community_id: data.community_id,
                                user_id: userId,
                                role: 'member',
                                status: 'active',
                                joined_at: new Date().toISOString(),
                                full_name: data.name || null,
                                email: data.email ? data.email.toLowerCase() : null,
                                phone: data.phone || null,
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString()
                            });

                        if (memberError) {
                            console.error('❌ Error adding to community_members:', memberError);
                        } else {
                            console.log('✅ User added to community_members successfully');
                        }
                    } else {
                        console.log('ℹ️ User already a member of this community');
                    }
                }
            } catch (userCreateError) {
                console.error('❌ Error in user creation:', userCreateError);
            }

            // Send approval email
            let emailSent = false;
            try {
                const emailService = require('../emailService-sendgrid');
                const communityName = community?.name || 'the community';

                const emailHtml = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; }
                            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                            .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                            .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; }
                            .success-box { background: #ecfdf5; border: 2px solid #10b981; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
                            .credentials-box { background: #fff7ed; border: 2px solid #f97316; padding: 20px; border-radius: 8px; margin: 20px 0; }
                            .credential-item { background: white; padding: 10px 15px; margin: 10px 0; border-radius: 5px; font-family: monospace; }
                            .app-download { background: #eff6ff; border: 2px solid #3b82f6; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
                            .button { display: inline-block; padding: 14px 35px; background: #3b82f6; color: white; text-decoration: none; border-radius: 8px; margin: 10px 5px; }
                            .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
                            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <h1>🎉 Welcome to ${communityName}!</h1>
                            </div>
                            <div class="content">
                                <div class="success-box">
                                    <h2>✅ Your application has been approved!</h2>
                                </div>
                                
                                ${tempPassword ? `
                                <div class="credentials-box">
                                    <h3>🔐 Your Login Credentials</h3>
                                    <div class="credential-item"><strong>Email:</strong> ${data.email}</div>
                                    <div class="credential-item"><strong>Password:</strong> ${tempPassword}</div>
                                </div>
                                ` : ''}
                                
                                <div class="app-download">
                                    <h3>📱 Download Our Mobile App</h3>
                                    <a href="#" class="button">Download for Android</a>
                                    <a href="#" class="button">Download for iOS</a>
                                </div>
                                
                                <div class="warning">
                                    <strong>⚠️ Important:</strong> Please change your password after your first login.
                                </div>
                            </div>
                            <div class="footer">
                                <p>© ${new Date().getFullYear()} Sai Samsthan</p>
                            </div>
                        </div>
                    </body>
                    </html>
                `;

                await emailService.sendEmail({
                    to: data.email,
                    subject: `🎉 Welcome to ${communityName} - Your Application is Approved!`,
                    html: emailHtml
                });

                console.log('✅ Approval email sent to:', data.email);
                emailSent = true;
            } catch (emailError) {
                console.error('⚠️ Failed to send approval email:', emailError.message);
            }

            return {
                success: true,
                message: 'Application approved successfully',
                data,
                userCreated,
                emailSent
            };
        } catch (error) {
            console.error('Error approving application:', error);
            return { success: false, error: error.message };
        }
    }


    // Reject application (simplified)
    async rejectApplication(applicationId, reviewedBy) {
        try {
            console.log('🔄 Rejecting application:', applicationId);

            const { data, error } = await supabaseService.client
                .from('community_applications')
                .update({
                    status: 'rejected',
                    reviewed_at: new Date().toISOString(),
                    reviewed_by: reviewedBy || null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', applicationId)
                .select('*')
                .single();

            if (error) throw error;

            if (!data) {
                return { success: false, error: 'Application not found' };
            }

            console.log('✅ Application rejected successfully:', applicationId);
            return {
                success: true,
                message: 'Application rejected successfully',
                data
            };
        } catch (error) {
            console.error('Error rejecting application:', error);
            return { success: false, error: error.message };
        }
    }

    // Check if user already applied to community
    async checkExistingApplication(communityId, userId) {
        try {
            if (!userId) return { success: true, data: null };

            const { data, error } = await supabaseService.client
                .from('community_applications')
                .select('id, status')
                .eq('community_id', communityId)
                .eq('user_id', userId)
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error checking existing application:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new ApplicationService();