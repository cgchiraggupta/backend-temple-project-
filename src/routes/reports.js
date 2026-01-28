const express = require('express');
const router = express.Router();
const supabaseService = require('../services/supabaseService');
const { checkRole } = require('../middleware/authMiddleware');

// Role check middleware for reports - admin, board, chair_board, and chairman
const checkReportsRole = checkRole(['admin', 'board', 'chair_board', 'chairman']);

// GET community reports
router.get('/communities/:id/reports', checkReportsRole, async (req, res) => {
    try {
        const communityId = req.params.id;
        const { startDate, endDate } = req.query;

        console.log('📊 Generating reports for community:', communityId);

        // Get applications statistics
        const { data: applications, error: appError } = await supabaseService.client
            .from('community_applications')
            .select('*')
            .eq('community_id', communityId);

        if (appError) throw appError;

        // Get members count (with error handling for RLS issues)
        let members = [];
        try {
            const { data: membersData, error: membersError } = await supabaseService.client
                .from('community_members')
                .select('*')
                .eq('community_id', communityId);

            if (!membersError) {
                members = membersData || [];
            }
        } catch (membersErr) {
            console.log('⚠️ Could not fetch members (RLS issue)');
        }

        // Get events (if events table exists)
        let events = [];
        try {
            const { data: eventsData, error: eventsError } = await supabaseService.client
                .from('community_events')
                .select('*')
                .eq('community_id', communityId);

            if (!eventsError) {
                events = eventsData || [];
            }
        } catch (eventsErr) {
            console.log('⚠️ Could not fetch events');
        }

        // Calculate statistics
        const stats = {
            applications: {
                total: applications.length,
                pending: applications.filter(app => app.status === 'pending').length,
                approved: applications.filter(app => app.status === 'approved').length,
                rejected: applications.filter(app => app.status === 'rejected').length
            },
            members: {
                total: members.length,
                active: members.filter(member => member.status === 'active').length
            },
            events: {
                total: events.length,
                upcoming: events.filter(event => new Date(event.start_date) > new Date()).length,
                past: events.filter(event => new Date(event.start_date) < new Date()).length
            }
        };

        // Recent activity
        const recentApplications = applications
            .sort((a, b) => new Date(b.applied_at) - new Date(a.applied_at))
            .slice(0, 10);

        const recentEvents = events
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 5);

        const report = {
            community_id: communityId,
            generated_at: new Date().toISOString(),
            period: { startDate, endDate },
            statistics: stats,
            recent_activity: {
                applications: recentApplications,
                events: recentEvents
            },
            charts_data: {
                applications_by_status: [
                    { name: 'Pending', value: stats.applications.pending },
                    { name: 'Approved', value: stats.applications.approved },
                    { name: 'Rejected', value: stats.applications.rejected }
                ],
                applications_over_time: getApplicationsOverTime(applications),
                events_by_month: getEventsByMonth(events)
            }
        };

        res.json({
            success: true,
            data: report
        });

    } catch (error) {
        console.error('Error generating reports:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate reports',
            error: error.message
        });
    }
});

// GET calendar events
router.get('/communities/:id/calendar', checkReportsRole, async (req, res) => {
    try {
        const communityId = req.params.id;
        const { month, year } = req.query;

        console.log('📅 Fetching calendar events for community:', communityId);

        // Get events for the specified month/year or all events
        let query = supabaseService.client
            .from('community_events')
            .select('*')
            .eq('community_id', communityId);

        if (month && year) {
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0);
            query = query
                .gte('start_date', startDate.toISOString())
                .lte('start_date', endDate.toISOString());
        }

        const { data: events, error } = await query.order('start_date', { ascending: true });

        if (error) throw error;

        // Format events for calendar
        const calendarEvents = (events || []).map(event => ({
            id: event.id,
            title: event.title,
            start: event.start_date,
            end: event.end_date,
            description: event.description,
            location: event.location,
            type: event.event_type,
            status: event.status,
            attendees_count: event.max_participants,
            color: getEventColor(event.event_type)
        }));

        res.json({
            success: true,
            data: calendarEvents
        });

    } catch (error) {
        console.error('Error fetching calendar events:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch calendar events',
            error: error.message
        });
    }
});

// Helper functions
function getApplicationsOverTime(applications) {
    const monthlyData = {};

    applications.forEach(app => {
        const month = new Date(app.applied_at).toISOString().substring(0, 7); // YYYY-MM
        monthlyData[month] = (monthlyData[month] || 0) + 1;
    });

    return Object.entries(monthlyData).map(([month, count]) => ({
        month,
        applications: count
    }));
}

function getEventsByMonth(events) {
    const monthlyData = {};

    events.forEach(event => {
        const month = new Date(event.start_date).toISOString().substring(0, 7); // YYYY-MM
        monthlyData[month] = (monthlyData[month] || 0) + 1;
    });

    return Object.entries(monthlyData).map(([month, count]) => ({
        month,
        events: count
    }));
}

function getEventColor(eventType) {
    const colors = {
        'worship': '#8B5CF6',
        'festival': '#F59E0B',
        'community': '#10B981',
        'education': '#3B82F6',
        'volunteer': '#EF4444',
        'meeting': '#6B7280'
    };
    return colors[eventType] || '#6B7280';
}

module.exports = router;