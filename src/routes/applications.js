const express = require('express');
const router = express.Router();
const applicationService = require('../services/community/applicationService-fixed');

// Submit application to join community
router.post('/communities/:communityId/apply', async (req, res) => {
    try {
        const { communityId } = req.params;
        const { user_id, email, name, phone, message, why_join, skills, experience } = req.body;

        // Validate required fields
        if (!email || !name) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: email, name'
            });
        }

        // Check if user already applied (only if user_id is provided)
        if (user_id) {
            const existingCheck = await applicationService.checkExistingApplication(communityId, user_id);
            if (existingCheck.success && existingCheck.data) {
                return res.status(400).json({
                    success: false,
                    error: `You already have a ${existingCheck.data.status} application for this community`
                });
            }
        }

        const applicationData = {
            community_id: communityId,
            user_id,
            email,
            name,
            phone,
            message,
            why_join,
            skills,
            experience
        };

        const result = await applicationService.submitApplication(applicationData);

        if (result.success) {
            res.status(201).json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error in apply route:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get applications for a community
router.get('/communities/:communityId/applications', async (req, res) => {
    try {
        const { communityId } = req.params;
        const { status } = req.query;

        const result = await applicationService.getApplications(communityId, status);

        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error in get applications route:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get single application
router.get('/applications/:applicationId', async (req, res) => {
    try {
        const { applicationId } = req.params;

        const result = await applicationService.getApplication(applicationId);

        if (result.success) {
            res.json(result);
        } else {
            res.status(404).json(result);
        }
    } catch (error) {
        console.error('Error in get application route:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Approve application
router.post('/applications/:applicationId/approve', async (req, res) => {
    try {
        const { applicationId } = req.params;
        const { reviewed_by } = req.body;

        // reviewed_by is optional

        const result = await applicationService.approveApplication(applicationId, reviewed_by);

        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error in approve application route:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Reject application
router.post('/applications/:applicationId/reject', async (req, res) => {
    try {
        const { applicationId } = req.params;
        const { reviewed_by } = req.body;

        // reviewed_by is optional

        const result = await applicationService.rejectApplication(applicationId, reviewed_by);

        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error in reject application route:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

module.exports = router;