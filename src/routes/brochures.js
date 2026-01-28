// Brochures Routes - Dynamic Temple Event Brochures
const express = require('express');
const router = express.Router();
const supabaseService = require('../services/supabaseService');
const multer = require('multer');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// GET all brochures
router.get('/', async (req, res) => {
    try {
        const { community_id, status, is_active, limit = 50, page = 1 } = req.query;

        console.log('📄 Fetching brochures:', { community_id, status, is_active });

        let query = supabaseService.client
            .from('brochures')
            .select('*')
            .order('created_at', { ascending: false });

        if (community_id && community_id !== 'all') {
            query = query.eq('community_id', community_id);
        }
        if (status && status !== 'all') {
            query = query.eq('status', status);
        }
        if (is_active !== undefined) {
            query = query.eq('is_active', is_active === 'true');
        }

        const offset = (parseInt(page) - 1) * parseInt(limit);
        query = query.range(offset, offset + parseInt(limit) - 1);

        const { data, error } = await query;

        if (error) throw error;

        res.json({
            success: true,
            data: data || [],
            total: data?.length || 0
        });

    } catch (error) {
        console.error('Error fetching brochures:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch brochures',
            error: error.message
        });
    }
});

// GET single brochure by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabaseService.client
            .from('brochures')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        res.json({
            success: true,
            data
        });

    } catch (error) {
        console.error('Error fetching brochure:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch brochure',
            error: error.message
        });
    }
});

// POST create new brochure
router.post('/', async (req, res) => {
    try {
        const brochureData = {
            ...req.body,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        console.log('📄 Creating brochure:', brochureData.event_title);

        const { data, error } = await supabaseService.client
            .from('brochures')
            .insert(brochureData)
            .select('*')
            .single();

        if (error) throw error;

        console.log('✅ Brochure created:', data.id);

        res.status(201).json({
            success: true,
            data,
            message: 'Brochure created successfully'
        });

    } catch (error) {
        console.error('Error creating brochure:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create brochure',
            error: error.message
        });
    }
});

// PUT update brochure
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = {
            ...req.body,
            updated_at: new Date().toISOString()
        };

        const { data, error } = await supabaseService.client
            .from('brochures')
            .update(updateData)
            .eq('id', id)
            .select('*')
            .single();

        if (error) throw error;

        res.json({
            success: true,
            data,
            message: 'Brochure updated successfully'
        });

    } catch (error) {
        console.error('Error updating brochure:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update brochure',
            error: error.message
        });
    }
});

// DELETE brochure
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabaseService.client
            .from('brochures')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({
            success: true,
            message: 'Brochure deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting brochure:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete brochure',
            error: error.message
        });
    }
});

// POST upload brochure image
router.post('/upload-image', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No image file provided'
            });
        }

        const file = req.file;
        const fileName = `brochure_${Date.now()}_${file.originalname.replace(/\s+/g, '_')}`;

        console.log('📤 Uploading brochure image:', fileName);

        // Try to upload to brochure-images bucket, fallback to cms-images if it doesn't exist
        let bucketName = 'brochure-images';
        let uploadResult = await supabaseService.client.storage
            .from(bucketName)
            .upload(fileName, file.buffer, {
                contentType: file.mimetype,
                upsert: true
            });

        // If brochure-images bucket doesn't exist, try cms-images
        if (uploadResult.error && uploadResult.error.message.includes('not found')) {
            console.log('📤 Fallback to cms-images bucket');
            bucketName = 'cms-images';
            uploadResult = await supabaseService.client.storage
                .from(bucketName)
                .upload(fileName, file.buffer, {
                    contentType: file.mimetype,
                    upsert: true
                });
        }

        if (uploadResult.error) throw uploadResult.error;

        // Get public URL
        const { data: urlData } = supabaseService.client.storage
            .from(bucketName)
            .getPublicUrl(fileName);

        console.log('✅ Image uploaded to', bucketName, ':', urlData.publicUrl);

        res.json({
            success: true,
            data: {
                url: urlData.publicUrl,
                path: uploadResult.data.path,
                bucket: bucketName
            },
            message: 'Image uploaded successfully'
        });

    } catch (error) {
        console.error('Error uploading image:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload image. Make sure storage bucket exists in Supabase.',
            error: error.message
        });
    }
});

// POST publish brochure
router.post('/:id/publish', async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabaseService.client
            .from('brochures')
            .update({
                status: 'published',
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select('*')
            .single();

        if (error) throw error;

        res.json({
            success: true,
            data,
            message: 'Brochure published successfully'
        });

    } catch (error) {
        console.error('Error publishing brochure:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to publish brochure',
            error: error.message
        });
    }
});

module.exports = router;
