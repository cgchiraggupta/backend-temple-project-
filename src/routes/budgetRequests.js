// backend/src/routes/budgetRequests.js - Budget Request Management with File Upload
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');
const path = require('path');
const supabaseService = require('../services/supabaseService');
const { checkRole } = require('../middleware/authMiddleware');

// Initialize Supabase client for storage
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB per file
        files: 5 // Max 5 files
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Allowed: images, PDF, DOC, DOCX'), false);
        }
    }
});

// Helper function to ensure bucket exists
async function ensureBucketExists(bucketName) {
    try {
        const { data: buckets } = await supabase.storage.listBuckets();
        const bucketExists = buckets?.some(b => b.name === bucketName);

        if (!bucketExists) {
            console.log(`📦 Creating bucket: ${bucketName}`);
            const { error } = await supabase.storage.createBucket(bucketName, {
                public: true,
                fileSizeLimit: 10485760 // 10MB
            });
            if (error && !error.message.includes('already exists')) {
                console.error('❌ Failed to create bucket:', error);
            }
        }
    } catch (err) {
        console.error('❌ Error checking/creating bucket:', err.message);
    }
}

// Helper function to upload file to Supabase Storage
async function uploadToSupabase(file, communityId) {
    const fileExt = path.extname(file.originalname);
    const fileName = `budget-requests/${communityId}/${randomUUID()}${fileExt}`;
    const bucketName = 'budget-documents';

    console.log(`📤 Uploading file to Supabase: ${fileName}`);

    // Ensure bucket exists
    await ensureBucketExists(bucketName);

    const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(fileName, file.buffer, {
            contentType: file.mimetype,
            upsert: false
        });

    if (error) {
        console.error('❌ Supabase storage upload error:', error);
        // Try with gallery bucket as fallback
        console.log('📤 Trying fallback bucket: gallery');
        const fallbackFileName = `budget-request-docs/${communityId}/${randomUUID()}${fileExt}`;
        const { data: fallbackData, error: fallbackError } = await supabase.storage
            .from('gallery')
            .upload(fallbackFileName, file.buffer, {
                contentType: file.mimetype,
                upsert: false
            });

        if (fallbackError) {
            console.error('❌ Fallback upload also failed:', fallbackError);
            throw error; // Throw original error
        }

        const { data: fallbackUrlData } = supabase.storage
            .from('gallery')
            .getPublicUrl(fallbackFileName);

        console.log(`✅ File uploaded to fallback bucket: ${fallbackUrlData.publicUrl}`);

        return {
            name: file.originalname,
            url: fallbackUrlData.publicUrl,
            type: file.mimetype,
            size: file.size,
            path: fallbackFileName
        };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(fileName);

    console.log(`✅ File uploaded successfully: ${urlData.publicUrl}`);

    return {
        name: file.originalname,
        url: urlData.publicUrl,
        type: file.mimetype,
        size: file.size,
        path: fileName
    };
}

// ===== BUDGET REQUESTS ROUTES =====

// Role groups
// Role groups
const ALLOW_REQUESTERS = ['community_lead', 'community_owner', 'finance_team', 'admin', 'board', 'chair_board', 'chairman'];
const ALLOW_APPROVERS = ['finance_team', 'admin', 'board', 'chair_board', 'chairman'];

// Get all budget requests (for finance team)
router.get('/', checkRole(ALLOW_REQUESTERS), async (req, res) => {
    try {
        const { status = 'all', community_id } = req.query;
        console.log('📋 Fetching budget requests');

        let query = supabaseService.client
            .from('budget_requests')
            .select('*');

        if (status !== 'all') {
            query = query.eq('status', status);
        }

        if (community_id) {
            query = query.eq('community_id', community_id);
        }

        const { data: requests, error } = await query.order('created_at', { ascending: false });

        if (error) {
            console.error('❌ Supabase budget requests query error:', error);
            throw error;
        }

        // Fetch community data separately and merge
        const requestsWithCommunity = [];
        if (requests && requests.length > 0) {
            for (const request of requests) {
                const { data: communityData } = await supabaseService.client
                    .from('communities')
                    .select('id, name')
                    .eq('id', request.community_id)
                    .single();

                requestsWithCommunity.push({
                    ...request,
                    community: communityData || { id: request.community_id, name: 'Unknown Community' }
                });
            }
        }

        console.log('✅ Budget requests fetched:', requestsWithCommunity?.length || 0);

        res.json({
            success: true,
            data: requestsWithCommunity || [],
            total: requestsWithCommunity?.length || 0
        });
    } catch (error) {
        console.error('❌ Error fetching budget requests:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch budget requests',
            error: error.message
        });
    }
});

// Get budget requests for a specific community
router.get('/community/:communityId', checkRole(ALLOW_REQUESTERS), async (req, res) => {
    try {
        const { communityId } = req.params;
        const { status = 'all' } = req.query;

        console.log('📋 Fetching budget requests for community:', communityId);

        let query = supabaseService.client
            .from('budget_requests')
            .select('*')
            .eq('community_id', communityId);

        if (status !== 'all') {
            query = query.eq('status', status);
        }

        const { data: requests, error } = await query.order('created_at', { ascending: false });

        if (error) {
            console.error('❌ Supabase community budget requests query error:', error);
            throw error;
        }

        console.log('✅ Community budget requests fetched:', requests?.length || 0);

        res.json({
            success: true,
            data: requests || [],
            total: requests?.length || 0
        });
    } catch (error) {
        console.error('❌ Error fetching community budget requests:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch community budget requests',
            error: error.message
        });
    }
});

// Create new budget request (JSON - no files)
router.post('/', checkRole(ALLOW_REQUESTERS), async (req, res) => {
    try {
        console.log('📥 Received budget request (JSON)');
        console.log('📥 Body:', req.body);

        const { community_id, budget_amount, purpose, event_name, requested_by, documents } = req.body;

        // Validate required fields
        if (!community_id || !budget_amount || !purpose) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: community_id, budget_amount, purpose'
            });
        }

        const requestData = {
            community_id,
            budget_amount: parseFloat(budget_amount),
            purpose,
            event_name: event_name || null,
            documents: documents || [],
            requested_by: requested_by || null,
            status: 'pending',
            created_at: new Date().toISOString()
        };

        const { data: request, error } = await supabaseService.client
            .from('budget_requests')
            .insert(requestData)
            .select('*')
            .single();

        if (error) {
            console.error('❌ Supabase budget request creation error:', error);
            throw error;
        }

        console.log('✅ Budget request created successfully:', request.id);

        res.status(201).json({
            success: true,
            data: request,
            message: 'Budget request submitted successfully'
        });
    } catch (error) {
        console.error('❌ Error creating budget request:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create budget request',
            error: error.message
        });
    }
});


// Create new budget request with file upload (multipart/form-data)
router.post('/with-files', checkRole(ALLOW_REQUESTERS), upload.array('documents', 5), async (req, res) => {
    try {
        console.log('📥 Received budget request with files');
        console.log('📥 Body:', req.body);
        console.log('📎 Files received:', req.files?.length || 0);

        const { community_id, budget_amount, purpose, event_name, requested_by } = req.body;

        // Validate required fields
        if (!community_id || !budget_amount || !purpose) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: community_id, budget_amount, purpose'
            });
        }

        // Upload files to Supabase Storage
        let uploadedDocuments = [];
        if (req.files && req.files.length > 0) {
            console.log('📤 Uploading documents to Supabase Storage...');
            for (const file of req.files) {
                try {
                    const uploadedFile = await uploadToSupabase(file, community_id);
                    uploadedDocuments.push(uploadedFile);
                } catch (uploadError) {
                    console.error('❌ File upload failed:', uploadError.message);
                }
            }
            console.log(`✅ Uploaded ${uploadedDocuments.length} documents`);
        }

        const requestData = {
            community_id,
            budget_amount: parseFloat(budget_amount),
            purpose,
            event_name: event_name || null,
            documents: uploadedDocuments,
            requested_by: requested_by || null,
            status: 'pending',
            created_at: new Date().toISOString()
        };

        const { data: request, error } = await supabaseService.client
            .from('budget_requests')
            .insert(requestData)
            .select('*')
            .single();

        if (error) {
            console.error('❌ Supabase budget request creation error:', error);
            throw error;
        }

        console.log('✅ Budget request created successfully:', request.id);

        res.status(201).json({
            success: true,
            data: request,
            message: 'Budget request submitted successfully'
        });
    } catch (error) {
        console.error('❌ Error creating budget request:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create budget request',
            error: error.message
        });
    }
});

// Upload documents to existing budget request
router.post('/:requestId/documents', checkRole(ALLOW_REQUESTERS), upload.array('documents', 5), async (req, res) => {
    try {
        const { requestId } = req.params;
        console.log('📎 Adding documents to budget request:', requestId);

        const { data: existingRequest, error: fetchError } = await supabaseService.client
            .from('budget_requests')
            .select('*')
            .eq('id', requestId)
            .single();

        if (fetchError || !existingRequest) {
            return res.status(404).json({
                success: false,
                message: 'Budget request not found'
            });
        }

        let uploadedDocuments = [];
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                try {
                    const uploadedFile = await uploadToSupabase(file, existingRequest.community_id);
                    uploadedDocuments.push(uploadedFile);
                } catch (uploadError) {
                    console.error('❌ File upload failed:', uploadError.message);
                }
            }
        }

        const allDocuments = [...(existingRequest.documents || []), ...uploadedDocuments];

        const { data: request, error } = await supabaseService.client
            .from('budget_requests')
            .update({ documents: allDocuments, updated_at: new Date().toISOString() })
            .eq('id', requestId)
            .select('*')
            .single();

        if (error) throw error;

        res.json({
            success: true,
            data: request,
            message: `${uploadedDocuments.length} document(s) uploaded successfully`
        });
    } catch (error) {
        console.error('❌ Error uploading documents:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload documents',
            error: error.message
        });
    }
});

// Approve budget request
router.put('/:requestId/approve', checkRole(ALLOW_APPROVERS), async (req, res) => {
    try {
        const { requestId } = req.params;
        const { approved_by, approval_notes, approved_amount } = req.body;

        const updateData = {
            status: 'approved',
            approved_by: approved_by || null,
            approval_notes: approval_notes || null,
            approved_amount: approved_amount ? parseFloat(approved_amount) : null,
            reviewed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const { data: request, error } = await supabaseService.client
            .from('budget_requests')
            .update(updateData)
            .eq('id', requestId)
            .select('*')
            .single();

        if (error) throw error;
        if (!request) {
            return res.status(404).json({ success: false, message: 'Budget request not found' });
        }

        res.json({ success: true, data: request, message: 'Budget request approved successfully' });
    } catch (error) {
        console.error('❌ Error approving budget request:', error);
        res.status(500).json({ success: false, message: 'Failed to approve budget request', error: error.message });
    }
});

// Reject budget request
router.put('/:requestId/reject', checkRole(ALLOW_APPROVERS), async (req, res) => {
    try {
        const { requestId } = req.params;
        const { rejected_by, rejection_reason } = req.body;

        const updateData = {
            status: 'rejected',
            rejected_by: rejected_by || null,
            rejection_reason: rejection_reason || null,
            reviewed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const { data: request, error } = await supabaseService.client
            .from('budget_requests')
            .update(updateData)
            .eq('id', requestId)
            .select('*')
            .single();

        if (error) throw error;
        if (!request) {
            return res.status(404).json({ success: false, message: 'Budget request not found' });
        }

        res.json({ success: true, data: request, message: 'Budget request rejected successfully' });
    } catch (error) {
        console.error('❌ Error rejecting budget request:', error);
        res.status(500).json({ success: false, message: 'Failed to reject budget request', error: error.message });
    }
});

// Delete budget request
router.delete('/:requestId', checkRole(ALLOW_APPROVERS), async (req, res) => {
    try {
        const { requestId } = req.params;

        const { data: request, error } = await supabaseService.client
            .from('budget_requests')
            .delete()
            .eq('id', requestId)
            .select('*')
            .single();

        if (error) throw error;
        if (!request) {
            return res.status(404).json({ success: false, message: 'Budget request not found' });
        }

        res.json({ success: true, data: request, message: 'Budget request deleted successfully' });
    } catch (error) {
        console.error('❌ Error deleting budget request:', error);
        res.status(500).json({ success: false, message: 'Failed to delete budget request', error: error.message });
    }
});

module.exports = router;
