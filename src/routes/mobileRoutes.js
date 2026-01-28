// Mobile API Routes - For Volunteer Mobile App
// These endpoints are specifically designed for the mobile app
const express = require('express');
const router = express.Router();
const supabaseService = require('../services/supabaseService');

// =============================================
// GET /api/mobile/me/communities
// Get communities where current user is a member
// =============================================
router.get('/me/communities', async (req, res) => {
    try {
        console.log('🔍 [Mobile] GET /me/communities request received');

        if (!req.user) {
            console.error('❌ [Mobile] req.user is missing in protected route!');
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        const userId = req.user.id;
        console.log('📱 [Mobile] Fetching communities for user:', userId, typeof userId);

        if (!userId) {
            console.error('❌ [Mobile] req.user.id is missing:', req.user);
            return res.status(400).json({ success: false, message: 'User ID missing in token' });
        }

        // Get user's community memberships
        const { data: memberships, error: memberError } = await supabaseService.client
            .from('community_members')
            .select(`
                role,
                joined_at,
                status,
                community_id,
                communities:community_id (
                    id,
                    name,
                    slug,
                    description,
                    logo_url,
                    cover_image_url,
                    status,
                    settings
                )
            `)
            .eq('user_id', userId)
            .eq('status', 'active');

        if (memberError) {
            console.error('❌ Error fetching memberships:', memberError);
            throw memberError;
        }

        // Transform the data
        const communities = (memberships || []).map(m => ({
            id: m.communities?.id,
            name: m.communities?.name,
            slug: m.communities?.slug,
            description: m.communities?.description,
            logo_url: m.communities?.logo_url,
            cover_image_url: m.communities?.cover_image_url,
            status: m.communities?.status,
            member_role: m.role,
            joined_at: m.joined_at
        })).filter(c => c.id); // Filter out any null communities

        console.log(`✅ Found ${communities.length} communities for user`);

        res.json({
            success: true,
            data: communities,
            total: communities.length
        });

    } catch (error) {
        console.error('❌ Error fetching user communities:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch communities',
            error: error.message
        });
    }
});

// =============================================
// GET /api/mobile/me/tasks
// Get tasks assigned to current user
// =============================================
router.get('/me/tasks', async (req, res) => {
    try {
        console.log('🔍 [Mobile] GET /me/tasks request received');

        if (!req.user || !req.user.id) {
            console.error('❌ [Mobile] User missing in /me/tasks:', req.user);
            return res.status(401).json({ success: false, message: 'User not authenticated correctly' });
        }

        const userId = req.user.id;
        const { status, community_id, priority, limit = 50, page = 1 } = req.query;

        console.log('📱 [Mobile] Fetching tasks for user:', userId, { status, community_id, priority });

        // IMPORTANT: Tasks are assigned using community_member.id, NOT user.id
        // First, we need to get all community_member IDs for this user
        const { data: memberships, error: memberError } = await supabaseService.client
            .from('community_members')
            .select('id')
            .eq('user_id', userId)
            .eq('status', 'active');

        if (memberError) {
            console.error('❌ Error fetching user memberships:', memberError);
            throw memberError;
        }

        // Get all community_member IDs for this user
        const memberIds = (memberships || []).map(m => m.id);

        console.log('📱 [Mobile] User member IDs:', memberIds);

        // If user has no community memberships, return empty
        if (memberIds.length === 0) {
            console.log('ℹ️ User has no community memberships, returning empty tasks');
            return res.json({
                success: true,
                data: [],
                total: 0,
                page: parseInt(page),
                limit: parseInt(limit),
                message: 'User is not a member of any community'
            });
        }

        // Build query - we need to check if assigned_to contains ANY of the user's member IDs
        // Since Supabase doesn't support OR with array contains directly, we'll fetch tasks for all communities
        // the user is a member of and then filter client-side
        let query = supabaseService.client
            .from('community_tasks')
            .select(`
                *,
                communities:community_id (
                    id,
                    name,
                    slug
                )
            `);

        // Filter by the user's member IDs - check if assigned_to overlaps with any of user's member IDs
        // We use overlaps operator (ov) for JSONB arrays
        query = query.or(memberIds.map(id => `assigned_to.cs.["${id}"]`).join(','));

        // Restore order
        query = query.order('due_date', { ascending: true, nullsFirst: false });

        // Apply filters
        if (status && status !== 'all') {
            query = query.eq('status', status);
        }
        if (community_id && community_id !== 'all') {
            query = query.eq('community_id', community_id);
        }
        if (priority && priority !== 'all') {
            query = query.eq('priority', priority);
        }

        // Pagination
        const offset = (parseInt(page) - 1) * parseInt(limit);
        query = query.range(offset, offset + parseInt(limit) - 1);

        const { data: tasks, error } = await query;

        if (error) {
            console.error('❌ Error fetching tasks:', error);
            throw error;
        }

        // Transform data
        const transformedTasks = (tasks || []).map(task => ({
            id: task.id,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            due_date: task.due_date,
            tags: task.tags || [],
            community_id: task.community_id,
            community_name: task.communities?.name || 'Unknown',
            community_slug: task.communities?.slug || '',
            created_at: task.created_at,
            updated_at: task.updated_at,
            completed_at: task.completed_at
        }));

        console.log(`✅ Found ${transformedTasks.length} tasks for user`);

        res.json({
            success: true,
            data: transformedTasks,
            total: transformedTasks.length,
            page: parseInt(page),
            limit: parseInt(limit)
        });

    } catch (error) {
        console.error('❌ Error fetching user tasks:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch tasks',
            error: error.message
        });
    }
});

// =============================================
// GET /api/mobile/me/shifts
// Get volunteer shifts for current user
// =============================================
router.get('/me/shifts', async (req, res) => {
    try {
        console.log('🔍 [Mobile] GET /me/shifts request received');

        if (!req.user) {
            console.error('❌ [Mobile] req.user missing in /me/shifts');
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        const userId = req.user.id;
        const userEmail = req.user.email;
        const { upcoming = 'true', limit = 50 } = req.query;

        console.log('📱 [Mobile] Fetching shifts for user:', userId, userEmail);

        // First, find the volunteer record for this user (prefer user_id, fallback to email)
        let volunteer = null;
        let volError = null;

        // Try by user_id first (preferred)
        const { data: volById, error: errById } = await supabaseService.client
            .from('volunteers')
            .select('id, first_name, last_name, email, user_id')
            .eq('user_id', userId)
            .eq('status', 'active')
            .single();

        if (volById) {
            volunteer = volById;
        } else if (errById && errById.code !== 'PGRST116') {
            console.error('❌ Error finding volunteer by user_id:', errById);
        }

        // Fallback to email match for backward compatibility
        if (!volunteer && userEmail) {
            const { data: volByEmail, error: errByEmail } = await supabaseService.client
                .from('volunteers')
                .select('id, first_name, last_name, email, user_id')
                .eq('email', userEmail)
                .eq('status', 'active')
                .single();

            if (volByEmail) {
                volunteer = volByEmail;
                console.log('ℹ️ Found volunteer by email, consider linking user_id');
            } else if (errByEmail && errByEmail.code !== 'PGRST116') {
                volError = errByEmail;
            }
        }

        if (volError) {
            console.error('❌ Error finding volunteer:', volError);
        }

        if (!volunteer) {
            console.log('ℹ️ User is not a registered volunteer');
            return res.json({
                success: true,
                data: [],
                total: 0,
                message: 'User is not a registered volunteer'
            });
        }

        console.log('👤 Found volunteer:', volunteer.id);

        // Get attendance records for this volunteer
        const { data: attendanceRecords, error: attError } = await supabaseService.client
            .from('volunteer_attendance')
            .select(`
                id,
                status,
                check_in_time,
                check_out_time,
                notes,
                shift_id,
                volunteer_shifts:shift_id (
                    id,
                    title,
                    description,
                    shift_date,
                    start_time,
                    end_time,
                    location,
                    status
                )
            `)
            .eq('volunteer_id', volunteer.id)
            .order('created_at', { ascending: false })
            .limit(parseInt(limit));

        if (attError) {
            console.error('❌ Error fetching attendance:', attError);
            throw attError;
        }

        // Transform the data
        let shifts = (attendanceRecords || []).map(att => ({
            id: att.volunteer_shifts?.id,
            title: att.volunteer_shifts?.title,
            description: att.volunteer_shifts?.description,
            shift_date: att.volunteer_shifts?.shift_date,
            start_time: att.volunteer_shifts?.start_time,
            end_time: att.volunteer_shifts?.end_time,
            location: att.volunteer_shifts?.location,
            shift_status: att.volunteer_shifts?.status,
            attendance: {
                id: att.id,
                status: att.status,
                check_in_time: att.check_in_time,
                check_out_time: att.check_out_time
            }
        })).filter(s => s.id);

        // Deduplicate shifts by ID to prevent duplicate key warnings in React Native
        const shiftMap = new Map();
        shifts.forEach(shift => {
            if (!shiftMap.has(shift.id)) {
                shiftMap.set(shift.id, shift);
            }
        });
        shifts = Array.from(shiftMap.values());

        // Filter upcoming shifts if requested
        if (upcoming === 'true') {
            const today = new Date().toISOString().split('T')[0];
            shifts = shifts.filter(s => s.shift_date >= today);
        }

        console.log(`✅ Found ${shifts.length} shifts for volunteer`);

        res.json({
            success: true,
            data: shifts,
            total: shifts.length,
            volunteer_id: volunteer.id
        });

    } catch (error) {
        console.error('❌ Error fetching user shifts:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch shifts',
            error: error.message
        });
    }
});

// =============================================
// GET /api/mobile/me/applications
// Get all applications submitted by current user
// =============================================
router.get('/me/applications', async (req, res) => {
    try {
        console.log('🔍 [Mobile] GET /me/applications request received');

        if (!req.user) {
            console.error('❌ [Mobile] req.user missing in /me/applications');
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        const userId = req.user.id;
        const userEmail = req.user.email;

        console.log('📱 [Mobile] Fetching applications for user:', userId, userEmail);

        // Fetch community applications
        let communityApplications = [];
        try {
            const { data: commApps, error: commError } = await supabaseService.client
                .from('community_applications')
                .select(`
                    id,
                    status,
                    message,
                    reviewed_at,
                    created_at,
                    community_id,
                    communities:community_id (
                        id,
                        name,
                        slug,
                        logo_url
                    )
                `)
                .or(`user_id.eq.${userId},email.eq.${userEmail}`)
                .order('created_at', { ascending: false });

            if (commError) {
                console.error('⚠️ Error fetching community applications:', commError);
            } else {
                communityApplications = (commApps || []).map(app => ({
                    id: app.id,
                    type: 'community',
                    community_id: app.community_id,
                    community_name: app.communities?.name || 'Unknown',
                    community_slug: app.communities?.slug || '',
                    community_logo: app.communities?.logo_url,
                    status: app.status,
                    message: app.message,
                    applied_at: app.created_at,
                    reviewed_at: app.reviewed_at
                }));
            }
        } catch (err) {
            console.error('⚠️ Community applications fetch failed:', err.message);
        }

        // Fetch volunteer applications
        let volunteerApplications = [];
        try {
            const { data: volApps, error: volError } = await supabaseService.client
                .from('volunteer_applications')
                .select('*')
                .or(`user_id.eq.${userId},email.eq.${userEmail}`)
                .order('applied_at', { ascending: false });

            if (volError) {
                console.error('⚠️ Error fetching volunteer applications:', volError);
            } else {
                volunteerApplications = (volApps || []).map(app => ({
                    id: app.id,
                    type: 'volunteer',
                    status: app.status,
                    first_name: app.first_name,
                    last_name: app.last_name,
                    skills: app.skills || [],
                    applied_at: app.applied_at || app.created_at,
                    reviewed_at: app.reviewed_at
                }));
            }
        } catch (err) {
            console.error('⚠️ Volunteer applications fetch failed:', err.message);
        }

        console.log(`✅ Found ${communityApplications.length} community apps, ${volunteerApplications.length} volunteer apps`);

        res.json({
            success: true,
            data: {
                community_applications: communityApplications,
                volunteer_applications: volunteerApplications
            },
            total: communityApplications.length + volunteerApplications.length
        });

    } catch (error) {
        console.error('❌ Error fetching user applications:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch applications',
            error: error.message
        });
    }
});

// =============================================
// GET /api/mobile/communities
// Get all public communities (for browsing)
// =============================================
router.get('/communities', async (req, res) => {
    try {
        const { search, limit = 50, page = 1 } = req.query;

        console.log('📱 [Mobile] Fetching public communities');

        let query = supabaseService.client
            .from('communities')
            .select('*')
            .eq('status', 'active')
            .order('name', { ascending: true });

        // Search filter
        if (search) {
            query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
        }

        // Pagination
        const offset = (parseInt(page) - 1) * parseInt(limit);
        query = query.range(offset, offset + parseInt(limit) - 1);

        const { data: communities, error } = await query;

        if (error) {
            console.error('❌ Error fetching communities:', error);
            throw error;
        }

        console.log(`✅ Found ${communities?.length || 0} public communities`);

        res.json({
            success: true,
            data: communities || [],
            total: communities?.length || 0,
            page: parseInt(page),
            limit: parseInt(limit)
        });

    } catch (error) {
        console.error('❌ Error fetching public communities:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch communities',
            error: error.message
        });
    }
});

// =============================================
// GET /api/mobile/communities/:id/events
// Get events for a specific community
// =============================================
router.get('/communities/:id/events', async (req, res) => {
    try {
        const { id: communityId } = req.params;
        const { upcoming = 'true', month, year, limit = 50 } = req.query;

        console.log('📱 [Mobile] Fetching events for community:', communityId);

        let query = supabaseService.client
            .from('community_events')
            .select('*')
            .eq('community_id', communityId)
            .order('start_date', { ascending: true })
            .limit(parseInt(limit));

        // Filter upcoming events
        if (upcoming === 'true') {
            const now = new Date().toISOString();
            query = query.gte('start_date', now);
        }

        // Filter by month/year if provided
        if (month && year) {
            const startDate = new Date(year, month - 1, 1).toISOString();
            const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();
            query = query.gte('start_date', startDate).lte('start_date', endDate);
        }

        const { data: events, error } = await query;

        if (error) {
            console.error('❌ Error fetching events:', error);
            throw error;
        }

        // Transform and add default images for events
        const eventsWithImages = (events || []).map(event => ({
            id: event.id,
            title: event.title,
            description: event.description,
            location: event.location,
            starts_at: event.start_date,
            ends_at: event.end_date,
            status: event.status,
            event_type: event.event_type,
            max_participants: event.max_participants,
            current_participants: event.current_participants,
            organizer_id: event.organizer_id,
            community_id: event.community_id,
            image_url: event.image_url || getDefaultEventImage(event.id, event.title),
            created_at: event.created_at
        }));

        console.log(`✅ Found ${eventsWithImages.length} events for community`);

        res.json({
            success: true,
            data: eventsWithImages,
            total: eventsWithImages.length
        });

    } catch (error) {
        console.error('❌ Error fetching community events:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch events',
            error: error.message
        });
    }
});

// =============================================
// GET /api/mobile/me/events
// Get events from all communities the user is a member of
// =============================================
router.get('/me/events', async (req, res) => {
    try {
        console.log('🔍 [Mobile] GET /me/events request received');

        if (!req.user) {
            console.error('❌ [Mobile] req.user missing in /me/events');
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        const userId = req.user.id;
        const { upcoming = 'true', limit = 50 } = req.query;

        console.log('📱 [Mobile] Fetching all community events for user:', userId);

        // 1. Get user's community IDs
        const { data: memberships, error: memberError } = await supabaseService.client
            .from('community_members')
            .select('community_id')
            .eq('user_id', userId)
            .eq('status', 'active');

        if (memberError) {
            console.error('❌ Error fetching memberships for events:', memberError);
            throw memberError;
        }

        const communityIds = (memberships || []).map(m => m.community_id);

        if (communityIds.length === 0) {
            return res.json({
                success: true,
                data: [],
                total: 0,
                message: 'User is not a member of any community'
            });
        }

        // 2. Fetch events for these communities from community_events table
        let query = supabaseService.client
            .from('community_events')
            .select(`
                *,
                communities:community_id (
                    name,
                    slug
                )
            `)
            .in('community_id', communityIds)
            .order('start_date', { ascending: true })
            .limit(parseInt(limit));

        if (upcoming === 'true') {
            const now = new Date().toISOString();
            query = query.gte('start_date', now);
        }

        const { data: events, error: eventsError } = await query;

        if (eventsError) {
            console.error('❌ Error fetching user events:', eventsError);
            throw eventsError;
        }

        // Transform and add default images
        const eventsWithImages = (events || []).map(event => ({
            id: event.id,
            title: event.title,
            description: event.description,
            location: event.location,
            starts_at: event.start_date,
            ends_at: event.end_date,
            status: event.status,
            event_type: event.event_type,
            max_participants: event.max_participants,
            current_participants: event.current_participants,
            organizer_id: event.organizer_id,
            community_id: event.community_id,
            image_url: event.image_url || getDefaultEventImage(event.id, event.title),
            community_name: event.communities?.name,
            created_at: event.created_at
        }));

        console.log(`✅ Found ${eventsWithImages.length} events for user`);

        res.json({
            success: true,
            data: eventsWithImages,
            total: eventsWithImages.length
        });

    } catch (error) {
        console.error('❌ Error fetching user events:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch events',
            error: error.message
        });
    }
});

// =============================================
// VOLUNTEER FEATURES
// =============================================

// Helper function to find volunteer for current user
async function findVolunteerForUser(userId, userEmail) {
    let volunteer = null;

    // Try by user_id first
    const { data: volById, error: errById } = await supabaseService.client
        .from('volunteers')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

    if (volById) {
        volunteer = volById;
    } else if (errById && errById.code !== 'PGRST116') {
        console.error('❌ Error finding volunteer by user_id:', errById);
    }

    // Fallback to email match
    if (!volunteer && userEmail) {
        const { data: volByEmail, error: errByEmail } = await supabaseService.client
            .from('volunteers')
            .select('*')
            .eq('email', userEmail)
            .eq('status', 'active')
            .single();

        if (volByEmail) {
            volunteer = volByEmail;
        }
    }

    return volunteer;
}

// =============================================
// GET /api/mobile/me/volunteer-profile
// Get current user's volunteer profile
// =============================================
router.get('/me/volunteer-profile', async (req, res) => {
    try {
        console.log('🔍 [Mobile] GET /me/volunteer-profile request received');

        if (!req.user) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        const volunteer = await findVolunteerForUser(req.user.id, req.user.email);

        if (!volunteer) {
            return res.status(404).json({
                success: false,
                message: 'User is not a registered volunteer'
            });
        }

        // Get stats - completed shifts and total hours
        const { data: stats, error: statsError } = await supabaseService.client
            .from('volunteer_attendance')
            .select('hours_worked, status')
            .eq('volunteer_id', volunteer.id);

        let totalHours = 0;
        let shiftsCompleted = 0;

        if (!statsError && stats) {
            stats.forEach(att => {
                if (att.status === 'completed') {
                    shiftsCompleted++;
                    totalHours += parseFloat(att.hours_worked || 0);
                }
            });
        }

        console.log(`✅ Found volunteer profile: ${volunteer.first_name} ${volunteer.last_name}`);

        res.json({
            success: true,
            data: {
                id: volunteer.id,
                first_name: volunteer.first_name,
                last_name: volunteer.last_name,
                email: volunteer.email,
                phone: volunteer.phone,
                skills: volunteer.skills || [],
                status: volunteer.status,
                total_hours: Math.round(totalHours * 10) / 10,
                shifts_completed: shiftsCompleted,
                created_at: volunteer.created_at
            }
        });

    } catch (error) {
        console.error('❌ Error fetching volunteer profile:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch volunteer profile',
            error: error.message
        });
    }
});

// =============================================
// GET /api/mobile/shifts/available
// Get open shifts that volunteer can sign up for
// =============================================
router.get('/shifts/available', async (req, res) => {
    try {
        console.log('🔍 [Mobile] GET /shifts/available request received');

        if (!req.user) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        const volunteer = await findVolunteerForUser(req.user.id, req.user.email);

        if (!volunteer) {
            return res.status(403).json({
                success: false,
                message: 'User is not a registered volunteer'
            });
        }

        const { limit = 50 } = req.query;
        const today = new Date().toISOString().split('T')[0];

        // Get open shifts from today onwards
        const { data: shifts, error: shiftsError } = await supabaseService.client
            .from('volunteer_shifts')
            .select('*')
            .eq('status', 'open')
            .gte('shift_date', today)
            .order('shift_date', { ascending: true })
            .limit(parseInt(limit));

        if (shiftsError) {
            console.error('❌ Error fetching available shifts:', shiftsError);
            throw shiftsError;
        }

        // Get volunteer's existing signups to filter out
        const { data: mySignups, error: signupsError } = await supabaseService.client
            .from('volunteer_attendance')
            .select('shift_id')
            .eq('volunteer_id', volunteer.id);

        const myShiftIds = new Set((mySignups || []).map(s => s.shift_id));

        // Filter out shifts user is already signed up for
        // Also check current volunteer count
        const availableShifts = [];

        for (const shift of (shifts || [])) {
            if (myShiftIds.has(shift.id)) continue;

            // Get current signup count
            const { count, error: countError } = await supabaseService.client
                .from('volunteer_attendance')
                .select('*', { count: 'exact', head: true })
                .eq('shift_id', shift.id);

            const currentCount = count || 0;
            const maxVolunteers = shift.max_volunteers || 5;

            if (currentCount < maxVolunteers) {
                availableShifts.push({
                    ...shift,
                    current_volunteers: currentCount,
                    spots_available: maxVolunteers - currentCount
                });
            }
        }

        console.log(`✅ Found ${availableShifts.length} available shifts`);

        res.json({
            success: true,
            data: availableShifts,
            total: availableShifts.length
        });

    } catch (error) {
        console.error('❌ Error fetching available shifts:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch available shifts',
            error: error.message
        });
    }
});

// =============================================
// POST /api/mobile/shifts/:id/signup
// Sign up for a shift
// =============================================
router.post('/shifts/:id/signup', async (req, res) => {
    try {
        const shiftId = req.params.id;
        console.log('🔍 [Mobile] POST /shifts/:id/signup for shift:', shiftId);

        if (!req.user) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        const volunteer = await findVolunteerForUser(req.user.id, req.user.email);

        if (!volunteer) {
            return res.status(403).json({
                success: false,
                message: 'User is not a registered volunteer'
            });
        }

        // Check if shift exists and is open
        const { data: shift, error: shiftError } = await supabaseService.client
            .from('volunteer_shifts')
            .select('*')
            .eq('id', shiftId)
            .single();

        if (shiftError || !shift) {
            return res.status(404).json({
                success: false,
                message: 'Shift not found'
            });
        }

        if (shift.status !== 'open') {
            return res.status(400).json({
                success: false,
                message: 'This shift is not available for signup'
            });
        }

        // Check if shift date is in the past
        const today = new Date().toISOString().split('T')[0];
        if (shift.shift_date < today) {
            return res.status(400).json({
                success: false,
                message: 'Cannot sign up for past shifts'
            });
        }

        // Check if already signed up
        const { data: existing, error: existingError } = await supabaseService.client
            .from('volunteer_attendance')
            .select('id')
            .eq('volunteer_id', volunteer.id)
            .eq('shift_id', shiftId)
            .single();

        if (existing) {
            return res.status(400).json({
                success: false,
                message: 'You are already signed up for this shift'
            });
        }

        // Check if shift is full
        const { count } = await supabaseService.client
            .from('volunteer_attendance')
            .select('*', { count: 'exact', head: true })
            .eq('shift_id', shiftId);

        if (count >= (shift.max_volunteers || 5)) {
            return res.status(400).json({
                success: false,
                message: 'This shift is full'
            });
        }

        // Create attendance record
        const { data: attendance, error: createError } = await supabaseService.client
            .from('volunteer_attendance')
            .insert({
                volunteer_id: volunteer.id,
                shift_id: shiftId,
                status: 'scheduled',
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (createError) {
            console.error('❌ Error creating signup:', createError);
            throw createError;
        }

        console.log(`✅ Volunteer ${volunteer.id} signed up for shift ${shiftId}`);

        res.json({
            success: true,
            data: attendance,
            message: 'Successfully signed up for shift'
        });

    } catch (error) {
        console.error('❌ Error signing up for shift:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to sign up for shift',
            error: error.message
        });
    }
});

// =============================================
// POST /api/mobile/shifts/:id/checkin
// Check in to a shift
// =============================================
router.post('/shifts/:id/checkin', async (req, res) => {
    try {
        const shiftId = req.params.id;
        console.log('🔍 [Mobile] POST /shifts/:id/checkin for shift:', shiftId);

        if (!req.user) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        const volunteer = await findVolunteerForUser(req.user.id, req.user.email);

        if (!volunteer) {
            return res.status(403).json({
                success: false,
                message: 'User is not a registered volunteer'
            });
        }

        // Find the attendance record
        const { data: attendance, error: findError } = await supabaseService.client
            .from('volunteer_attendance')
            .select('*')
            .eq('volunteer_id', volunteer.id)
            .eq('shift_id', shiftId)
            .single();

        if (findError || !attendance) {
            return res.status(404).json({
                success: false,
                message: 'You are not signed up for this shift'
            });
        }

        // NOTE: Time restrictions removed for now - check-in allowed anytime for assigned shift
        // TODO: Add back time restrictions after fixing timezone handling

        if (attendance.status === 'present') {
            return res.status(400).json({
                success: false,
                message: 'You are already checked in'
            });
        }

        if (attendance.status === 'completed') {
            return res.status(400).json({
                success: false,
                message: 'You have already checked out from this shift'
            });
        }

        // Update attendance record
        const { data: updated, error: updateError } = await supabaseService.client
            .from('volunteer_attendance')
            .update({
                status: 'present',
                check_in_time: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', attendance.id)
            .select()
            .single();

        if (updateError) {
            console.error('❌ Error checking in:', updateError);
            throw updateError;
        }

        console.log(`✅ Volunteer ${volunteer.id} checked in to shift ${shiftId}`);

        res.json({
            success: true,
            data: updated,
            message: 'Successfully checked in'
        });

    } catch (error) {
        console.error('❌ Error checking in:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check in',
            error: error.message
        });
    }
});

// =============================================
// POST /api/mobile/shifts/:id/checkout
// Check out from a shift
// =============================================
router.post('/shifts/:id/checkout', async (req, res) => {
    try {
        const shiftId = req.params.id;
        console.log('🔍 [Mobile] POST /shifts/:id/checkout for shift:', shiftId);

        if (!req.user) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        const volunteer = await findVolunteerForUser(req.user.id, req.user.email);

        if (!volunteer) {
            return res.status(403).json({
                success: false,
                message: 'User is not a registered volunteer'
            });
        }

        // Find the attendance record
        const { data: attendance, error: findError } = await supabaseService.client
            .from('volunteer_attendance')
            .select('*')
            .eq('volunteer_id', volunteer.id)
            .eq('shift_id', shiftId)
            .single();

        if (findError || !attendance) {
            return res.status(404).json({
                success: false,
                message: 'You are not signed up for this shift'
            });
        }

        if (attendance.status !== 'present') {
            return res.status(400).json({
                success: false,
                message: 'You must check in before checking out'
            });
        }

        // Check-out is allowed anytime after check-in (no time restriction)

        // Calculate hours worked
        const checkInTime = new Date(attendance.check_in_time);
        const checkOutTime = new Date();
        const hoursWorked = (checkOutTime - checkInTime) / (1000 * 60 * 60);

        // Update attendance record
        const { data: updated, error: updateError } = await supabaseService.client
            .from('volunteer_attendance')
            .update({
                status: 'completed',
                check_out_time: checkOutTime.toISOString(),
                hours_worked: Math.round(hoursWorked * 100) / 100,
                updated_at: new Date().toISOString()
            })
            .eq('id', attendance.id)
            .select()
            .single();

        if (updateError) {
            console.error('❌ Error checking out:', updateError);
            throw updateError;
        }

        console.log(`✅ Volunteer ${volunteer.id} checked out from shift ${shiftId} (${hoursWorked.toFixed(2)} hours)`);

        res.json({
            success: true,
            data: updated,
            message: `Successfully checked out. Hours worked: ${hoursWorked.toFixed(2)}`
        });

    } catch (error) {
        console.error('❌ Error checking out:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check out',
            error: error.message
        });
    }
});

// =============================================
// DELETE /api/mobile/shifts/:id/cancel
// Cancel shift signup
// =============================================
router.delete('/shifts/:id/cancel', async (req, res) => {
    try {
        const shiftId = req.params.id;
        console.log('🔍 [Mobile] DELETE /shifts/:id/cancel for shift:', shiftId);

        if (!req.user) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        const volunteer = await findVolunteerForUser(req.user.id, req.user.email);

        if (!volunteer) {
            return res.status(403).json({
                success: false,
                message: 'User is not a registered volunteer'
            });
        }

        // Find the attendance record
        const { data: attendance, error: findError } = await supabaseService.client
            .from('volunteer_attendance')
            .select('*')
            .eq('volunteer_id', volunteer.id)
            .eq('shift_id', shiftId)
            .single();

        if (findError || !attendance) {
            return res.status(404).json({
                success: false,
                message: 'You are not signed up for this shift'
            });
        }

        // Only allow cancellation if not checked in yet
        if (attendance.status !== 'scheduled') {
            return res.status(400).json({
                success: false,
                message: 'Cannot cancel after checking in'
            });
        }

        // Delete the attendance record
        const { error: deleteError } = await supabaseService.client
            .from('volunteer_attendance')
            .delete()
            .eq('id', attendance.id);

        if (deleteError) {
            console.error('❌ Error canceling signup:', deleteError);
            throw deleteError;
        }

        console.log(`✅ Volunteer ${volunteer.id} canceled signup for shift ${shiftId}`);

        res.json({
            success: true,
            message: 'Successfully canceled shift signup'
        });

    } catch (error) {
        console.error('❌ Error canceling signup:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cancel signup',
            error: error.message
        });
    }
});

// =============================================
// DELETE /api/mobile/me/account
// Delete user account and all associated data
// (Required for App Store compliance)
// =============================================
router.delete('/me/account', async (req, res) => {
    try {
        console.log('🔍 [Mobile] DELETE /me/account request received');

        if (!req.user) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        const userId = req.user.id;
        const userEmail = req.user.email;

        console.log(`⚠️ [Mobile] Processing account deletion for user: ${userId}`);

        // 1. Delete volunteer attendance records (if volunteer)
        const volunteer = await findVolunteerForUser(userId, userEmail);
        if (volunteer) {
            const { error: attError } = await supabaseService.client
                .from('volunteer_attendance')
                .delete()
                .eq('volunteer_id', volunteer.id);

            if (attError) {
                console.error('❌ Error deleting attendance records:', attError);
            } else {
                console.log('✓ Deleted volunteer attendance records');
            }

            // 2. Delete volunteer record
            const { error: volError } = await supabaseService.client
                .from('volunteers')
                .delete()
                .eq('id', volunteer.id);

            if (volError) {
                console.error('❌ Error deleting volunteer record:', volError);
            } else {
                console.log('✓ Deleted volunteer record');
            }
        }

        // 3. Delete community task assignments
        const { error: taskError } = await supabaseService.client
            .from('community_tasks')
            .update({ assigned_to: null })
            .eq('assigned_to', userId);

        if (taskError && taskError.code !== 'PGRST116') {
            console.error('❌ Error clearing task assignments:', taskError);
        } else {
            console.log('✓ Cleared task assignments');
        }

        // 4. Delete community memberships
        const { error: memberError } = await supabaseService.client
            .from('community_members')
            .delete()
            .eq('user_id', userId);

        if (memberError) {
            console.error('❌ Error deleting community memberships:', memberError);
        } else {
            console.log('✓ Deleted community memberships');
        }

        // 5. Delete the user account
        const { error: userError } = await supabaseService.client
            .from('users')
            .delete()
            .eq('id', userId);

        if (userError) {
            console.error('❌ Error deleting user account:', userError);
            throw userError;
        }

        console.log(`✅ [Mobile] Successfully deleted account for user: ${userId}`);

        res.json({
            success: true,
            message: 'Your account has been permanently deleted'
        });

    } catch (error) {
        console.error('❌ Error deleting account:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete account. Please contact support.',
            error: error.message
        });
    }
});

// Helper function for default event images
function getDefaultEventImage(eventId, title) {
    const DEFAULT_IMAGES = [
        "https://images.unsplash.com/photo-1609619385002-f40f1df9b7eb?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1548013146-72479768bada?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1604608672516-f1b9b1a4a0e5?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1545389336-cf090694435e?w=800&h=600&fit=crop"
    ];

    if (eventId) {
        const hash = eventId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return DEFAULT_IMAGES[hash % DEFAULT_IMAGES.length];
    }
    return DEFAULT_IMAGES[0];
}

module.exports = router;

