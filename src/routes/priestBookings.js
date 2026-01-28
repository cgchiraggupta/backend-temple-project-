// Priest Bookings Routes
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { requireAuth } = require('../middleware/authMiddleware');
const emailService = require('../services/emailService');

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

// Get all priest bookings
router.get('/', requireAuth, async (req, res) => {
    try {
        const { status, start_date, end_date, page = 1, limit = 50 } = req.query;

        let query = supabase
            .from('priest_bookings')
            .select(`
                id,
                name,
                email,
                phone,
                puja_type,
                preferred_date,
                preferred_time,
                address,
                city,
                state,
                zip_code,
                family_members,
                gotra,
                nakshatra,
                special_requests,
                status,
                priest_id,
                admin_notes,
                created_at,
                updated_at,
                priests(id, name, phone, specialization)
            `)
            .order('created_at', { ascending: false });

        if (status && status !== 'all') {
            query = query.eq('status', status);
        }

        if (start_date) {
            query = query.gte('preferred_date', start_date);
        }

        if (end_date) {
            query = query.lte('preferred_date', end_date);
        }

        // Pagination
        const offset = (parseInt(page) - 1) * parseInt(limit);
        query = query.range(offset, offset + parseInt(limit) - 1);

        const { data, error, count } = await query;

        if (error) throw error;

        // Map puja_type to service_type for frontend compatibility
        const mappedData = (data || []).map(booking => ({
            ...booking,
            service_type: booking.puja_type, // Add service_type alias for frontend
        }));

        res.json({
            success: true,
            data: mappedData,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: count || data?.length || 0
            }
        });

    } catch (error) {
        console.error('❌ Error fetching priest bookings:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch priest bookings',
            error: error.message
        });
    }
});

// Get single booking by ID
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('priest_bookings')
            .select(`
                id, name, email, phone, puja_type,
                preferred_date, preferred_time, address,
                city, state, zip_code, family_members,
                gotra, nakshatra, special_requests,
                status, priest_id, admin_notes,
                created_at, updated_at,
                priests(id, name, phone, specialization)
            `)
            .eq('id', id)
            .single();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        // Map puja_type to service_type for frontend compatibility
        const mappedData = {
            ...data,
            service_type: data.puja_type
        };

        res.json({
            success: true,
            data: mappedData
        });

    } catch (error) {
        console.error('❌ Error fetching booking:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch booking',
            error: error.message
        });
    }
});

// Update booking status
router.put('/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, priest_id, admin_notes } = req.body;

        // Get the current booking to check status change
        const { data: currentBooking } = await supabase
            .from('priest_bookings')
            .select('status, email, name, puja_type, preferred_date, preferred_time')
            .eq('id', id)
            .single();

        const updateData = {
            updated_at: new Date().toISOString()
        };

        if (status) updateData.status = status;
        if (priest_id !== undefined) updateData.priest_id = priest_id || null;
        if (admin_notes !== undefined) updateData.admin_notes = admin_notes;

        const { data, error } = await supabase
            .from('priest_bookings')
            .update(updateData)
            .eq('id', id)
            .select(`
                id, name, email, phone, puja_type,
                preferred_date, preferred_time, address,
                city, state, zip_code, family_members,
                gotra, nakshatra, special_requests,
                status, priest_id, admin_notes,
                created_at, updated_at,
                priests(id, name, phone, specialization)
            `)
            .single();

        if (error) throw error;

        // Send confirmation email when status changes to 'confirmed'
        if (status === 'confirmed' && currentBooking?.status !== 'confirmed' && data.email) {
            try {
                const priestName = data.priests?.name || 'a priest';
                const formattedDate = new Date(data.preferred_date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
                const timeInfo = data.preferred_time ? ` at ${data.preferred_time}` : '';

                const emailHtml = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                            <h1 style="color: white; margin: 0;">🙏 Booking Confirmed!</h1>
                        </div>
                        <div style="padding: 30px; background: #f9f9f9;">
                            <p style="font-size: 16px;">Dear <strong>${data.name}</strong>,</p>
                            <p style="font-size: 16px;">We are pleased to confirm your priest booking for <strong>${data.puja_type}</strong>.</p>
                            
                            <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0;">
                                <h3 style="color: #667eea; margin-top: 0;">📅 Booking Details</h3>
                                <p><strong>Service:</strong> ${data.puja_type}</p>
                                <p><strong>Date:</strong> ${formattedDate}${timeInfo}</p>
                                <p><strong>Assigned Priest:</strong> ${priestName}</p>
                                ${data.address ? `<p><strong>Location:</strong> ${data.address}${data.city ? ', ' + data.city : ''}${data.state ? ', ' + data.state : ''}</p>` : ''}
                            </div>
                            
                            <p style="font-size: 14px; color: #666;">If you have any questions, please contact us.</p>
                            <p style="font-size: 14px; color: #666;">🙏 Om Sai Ram!</p>
                        </div>
                        <div style="background: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
                            <p style="margin: 0;">Sai Samsthan USA</p>
                        </div>
                    </div>
                `;

                await emailService.sendEmail({
                    to: data.email,
                    subject: `✅ Your ${data.puja_type} Booking is Confirmed!`,
                    html: emailHtml
                });

                console.log('✅ Confirmation email sent to:', data.email);
            } catch (emailError) {
                console.error('⚠️ Failed to send confirmation email:', emailError.message);
                // Don't fail the request if email fails
            }
        }

        // Map puja_type to service_type for frontend compatibility
        const mappedData = {
            ...data,
            service_type: data.puja_type
        };

        res.json({
            success: true,
            message: 'Booking updated successfully',
            data: mappedData
        });

    } catch (error) {
        console.error('❌ Error updating booking:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update booking',
            error: error.message
        });
    }
});

// Delete booking
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('priest_bookings')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({
            success: true,
            message: 'Booking deleted successfully'
        });

    } catch (error) {
        console.error('❌ Error deleting booking:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete booking',
            error: error.message
        });
    }
});

// PUBLIC: Create new priest booking request (no auth required for website submissions)
router.post('/', async (req, res) => {
    try {
        const {
            name,
            email,
            phone,
            puja_type,
            preferred_date,
            preferred_time,
            priest_id,
            address,
            city,
            state,
            zip_code,
            family_members,
            gotra,
            nakshatra,
            special_requests
        } = req.body;

        console.log('📝 [Public] Creating new priest booking:', { name, email, puja_type, preferred_date });

        // Validate required fields
        if (!name || !email || !phone || !puja_type || !preferred_date) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: name, email, phone, puja_type, preferred_date'
            });
        }

        const bookingData = {
            name,
            email: email.toLowerCase().trim(),
            phone,
            puja_type,
            preferred_date,
            preferred_time: preferred_time || null,
            priest_id: priest_id || null,
            address: address || null,
            city: city || null,
            state: state || null,
            zip_code: zip_code || null,
            family_members: family_members || null,
            gotra: gotra || null,
            nakshatra: nakshatra || null,
            special_requests: special_requests || null,
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('priest_bookings')
            .insert(bookingData)
            .select()
            .single();

        if (error) {
            console.error('❌ Error creating booking:', error);
            throw error;
        }

        console.log('✅ Priest booking created:', data.id);

        res.status(201).json({
            success: true,
            message: 'Booking request submitted successfully',
            data
        });

    } catch (error) {
        console.error('❌ Error creating priest booking:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create booking request',
            error: error.message
        });
    }
});

// Get busy priests for a specific date and time
router.get('/busy-priests/:date', async (req, res) => {
    try {
        const { date } = req.params;
        const { time, exclude_booking_id } = req.query;

        // Find all confirmed/pending bookings for this date
        let query = supabase
            .from('priest_bookings')
            .select('priest_id, preferred_time, id')
            .eq('preferred_date', date)
            .not('priest_id', 'is', null)
            .in('status', ['pending', 'confirmed']);

        // Exclude current booking when editing
        if (exclude_booking_id) {
            query = query.neq('id', exclude_booking_id);
        }

        const { data, error } = await query;

        if (error) throw error;

        // Create a map of busy priests with their booking times
        const busyPriests = {};
        (data || []).forEach(booking => {
            if (booking.priest_id) {
                if (!busyPriests[booking.priest_id]) {
                    busyPriests[booking.priest_id] = [];
                }
                busyPriests[booking.priest_id].push(booking.preferred_time || 'All day');
            }
        });

        res.json({
            success: true,
            data: busyPriests
        });

    } catch (error) {
        console.error('❌ Error fetching busy priests:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch busy priests',
            error: error.message
        });
    }
});

// PUBLIC: Get bookings for a specific priest by date range (for website calendar view)
router.get('/priest/:priestId/bookings', async (req, res) => {
    try {
        const { priestId } = req.params;
        const { start_date, end_date } = req.query;

        console.log('📅 [Public] Fetching bookings for priest:', priestId, 'from', start_date, 'to', end_date);

        if (!priestId) {
            return res.status(400).json({
                success: false,
                message: 'Priest ID is required'
            });
        }

        let query = supabase
            .from('priest_bookings')
            .select('id, priest_id, preferred_date, preferred_time, status, puja_type, name')
            .eq('priest_id', priestId)
            .in('status', ['pending', 'confirmed'])
            .order('preferred_date', { ascending: true });

        if (start_date) {
            query = query.gte('preferred_date', start_date);
        }

        if (end_date) {
            query = query.lte('preferred_date', end_date);
        }

        const { data, error } = await query;

        if (error) throw error;

        console.log(`✅ Found ${data?.length || 0} bookings for priest ${priestId}`);

        res.json({
            success: true,
            data: data || []
        });

    } catch (error) {
        console.error('❌ Error fetching priest bookings:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch priest bookings',
            error: error.message
        });
    }
});

// Get booking statistics
router.get('/stats/summary', requireAuth, async (req, res) => {
    try {
        const { data: allBookings, error } = await supabase
            .from('priest_bookings')
            .select('status, created_at');

        if (error) throw error;

        const stats = {
            total: allBookings?.length || 0,
            pending: allBookings?.filter(b => b.status === 'pending').length || 0,
            confirmed: allBookings?.filter(b => b.status === 'confirmed').length || 0,
            completed: allBookings?.filter(b => b.status === 'completed').length || 0,
            cancelled: allBookings?.filter(b => b.status === 'cancelled').length || 0
        };

        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('❌ Error fetching booking stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch booking statistics',
            error: error.message
        });
    }
});

module.exports = router;
