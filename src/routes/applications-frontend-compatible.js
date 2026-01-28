const express = require('express');
const router = express.Router();
const applicationService = require('../services/community/applicationService-fixed');

// Frontend-compatible routes for applications

// PUT approve application (frontend expects PUT method)
router.put('/communities/:communityId/applications/:applicationId/approve', async (req, res) => {
    try {
        const { applicationId } = req.params;
        const { reviewed_by } = req.body;

        console.log('📋 Frontend approval request for application:', applicationId);

        if (applicationId === 'undefined' || !applicationId) {
            return res.status(400).json({
                success: false,
                error: 'Invalid application ID'
            });
        }

        const result = await applicationService.approveApplication(applicationId, reviewed_by);

        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error in frontend approve route:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// PUT reject application (frontend expects PUT method)
router.put('/communities/:communityId/applications/:applicationId/reject', async (req, res) => {
    try {
        const { applicationId } = req.params;
        const { reviewed_by } = req.body;

        console.log('📋 Frontend rejection request for application:', applicationId);

        if (applicationId === 'undefined' || !applicationId) {
            return res.status(400).json({
                success: false,
                error: 'Invalid application ID'
            });
        }

        const result = await applicationService.rejectApplication(applicationId, reviewed_by);

        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error in frontend reject route:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// POST create event (frontend compatible)
router.post('/communities/:communityId/events', async (req, res) => {
    try {
        const communityId = req.params.communityId;
        const {
            title,
            description,
            start_date,
            end_date,
            location,
            event_type = 'meeting',
            max_participants = 50,
            organizer_id
        } = req.body;

        console.log('📅 Frontend event creation for community:', communityId);

        // Validate required fields
        if (!title || !start_date || !end_date) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: title, start_date, end_date'
            });
        }

        // Validate dates
        if (new Date(end_date) <= new Date(start_date)) {
            return res.status(400).json({
                success: false,
                message: 'End date must be after start date'
            });
        }

        const eventData = {
            community_id: communityId,
            title,
            description: description || '',
            start_date,
            end_date,
            location: location || '',
            event_type,
            status: 'published',
            max_participants: parseInt(max_participants),
            current_participants: 0,
            organizer_id: organizer_id || null
        };

        const supabaseService = require('../services/supabaseService');
        const { data, error } = await supabaseService.client
            .from('community_events')
            .insert(eventData)
            .select('*')
            .single();

        if (error) throw error;

        console.log('✅ Frontend event created:', data.id);

        res.status(201).json({
            success: true,
            data,
            message: 'Event created successfully'
        });

    } catch (error) {
        console.error('Error in frontend event creation:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create event',
            error: error.message
        });
    }
});

module.exports = router;