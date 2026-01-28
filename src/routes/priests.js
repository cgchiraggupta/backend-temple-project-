// Priests Routes with Supabase Storage for Image Upload
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');
const path = require('path');
const { requireAuth } = require('../middleware/authMiddleware');

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    },
});

// Get all priests
router.get('/', async (req, res) => {
    try {
        const { status, search, page = 1, limit = 50 } = req.query;

        let query = supabase
            .from('priests')
            .select('*')
            .order('created_at', { ascending: false });

        if (status && status !== 'all') {
            query = query.eq('status', status);
        }

        if (search) {
            query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
        }

        // Pagination
        const offset = (parseInt(page) - 1) * parseInt(limit);
        query = query.range(offset, offset + parseInt(limit) - 1);

        const { data, error, count } = await query;

        if (error) throw error;

        res.json({
            success: true,
            data: data || [],
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: count || data?.length || 0
            }
        });

    } catch (error) {
        console.error('❌ Error fetching priests:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch priests',
            error: error.message
        });
    }
});

// Get single priest by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('priests')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({
                success: false,
                message: 'Priest not found'
            });
        }

        res.json({
            success: true,
            data
        });

    } catch (error) {
        console.error('❌ Error fetching priest:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch priest',
            error: error.message
        });
    }
});

// Create new priest with image upload
router.post('/', requireAuth, upload.single('image'), async (req, res) => {
    try {
        const {
            name,
            email,
            phone,
            specialization,
            experience_years,
            qualification,
            address,
            date_of_birth,
            joining_date,
            status = 'active',
            notes
        } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'Priest name is required'
            });
        }

        let imageUrl = null;
        let storagePath = null;

        // Handle image upload if provided
        if (req.file) {
            const fileExt = path.extname(req.file.originalname);
            const fileName = `priests/${randomUUID()}${fileExt}`;

            console.log('📤 Uploading priest image to Supabase Storage:', fileName);

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('gallery-images')
                .upload(fileName, req.file.buffer, {
                    contentType: req.file.mimetype,
                    upsert: false
                });

            if (uploadError) {
                console.error('❌ Supabase upload error:', uploadError);
                throw uploadError;
            }

            const { data: { publicUrl } } = supabase.storage
                .from('gallery-images')
                .getPublicUrl(fileName);

            imageUrl = publicUrl;
            storagePath = fileName;
            console.log('✅ Priest image uploaded:', publicUrl);
        }

        // Insert priest record (without created_by to avoid FK constraint issues)
        const { data, error } = await supabase
            .from('priests')
            .insert({
                name,
                email: email || null,
                phone: phone || null,
                specialization: specialization || null,
                experience_years: experience_years ? parseInt(experience_years) : null,
                qualification: qualification || null,
                address: address || null,
                date_of_birth: date_of_birth || null,
                joining_date: joining_date || new Date().toISOString().split('T')[0],
                status,
                notes: notes || null,
                image_url: imageUrl,
                storage_path: storagePath
            })
            .select()
            .single();

        if (error) {
            // Clean up uploaded image if database insert fails
            if (storagePath) {
                await supabase.storage.from('gallery-images').remove([storagePath]);
            }
            throw error;
        }

        console.log('✅ Priest created successfully:', data.id);

        res.status(201).json({
            success: true,
            message: 'Priest created successfully',
            data
        });

    } catch (error) {
        console.error('❌ Error creating priest:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to create priest',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
});


// Update priest with optional image upload
router.put('/:id', requireAuth, upload.single('image'), async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            email,
            phone,
            specialization,
            experience_years,
            qualification,
            address,
            date_of_birth,
            joining_date,
            status,
            notes
        } = req.body;

        // Get existing priest to check for old image
        const { data: existingPriest, error: fetchError } = await supabase
            .from('priests')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !existingPriest) {
            return res.status(404).json({
                success: false,
                message: 'Priest not found'
            });
        }

        let imageUrl = existingPriest.image_url;
        let storagePath = existingPriest.storage_path;

        // Handle new image upload
        if (req.file) {
            const fileExt = path.extname(req.file.originalname);
            const fileName = `priests/${randomUUID()}${fileExt}`;

            console.log('📤 Uploading new priest image:', fileName);

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('gallery-images')
                .upload(fileName, req.file.buffer, {
                    contentType: req.file.mimetype,
                    upsert: false
                });

            if (uploadError) throw uploadError;

            // Delete old image if exists
            if (existingPriest.storage_path) {
                await supabase.storage.from('gallery-images').remove([existingPriest.storage_path]);
                console.log('🗑️ Deleted old priest image');
            }

            const { data: { publicUrl } } = supabase.storage
                .from('gallery-images')
                .getPublicUrl(fileName);

            imageUrl = publicUrl;
            storagePath = fileName;
        }

        // Build update object
        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (email !== undefined) updateData.email = email || null;
        if (phone !== undefined) updateData.phone = phone || null;
        if (specialization !== undefined) updateData.specialization = specialization || null;
        if (experience_years !== undefined) updateData.experience_years = experience_years ? parseInt(experience_years) : null;
        if (qualification !== undefined) updateData.qualification = qualification || null;
        if (address !== undefined) updateData.address = address || null;
        if (date_of_birth !== undefined) updateData.date_of_birth = date_of_birth || null;
        if (joining_date !== undefined) updateData.joining_date = joining_date || null;
        if (status !== undefined) updateData.status = status;
        if (notes !== undefined) updateData.notes = notes || null;
        if (req.file) {
            updateData.image_url = imageUrl;
            updateData.storage_path = storagePath;
        }
        updateData.updated_at = new Date().toISOString();

        const { data, error } = await supabase
            .from('priests')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json({
            success: true,
            message: 'Priest updated successfully',
            data
        });

    } catch (error) {
        console.error('❌ Error updating priest:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update priest',
            error: error.message
        });
    }
});

// Delete priest
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;

        // Get priest to delete associated image
        const { data: priest, error: fetchError } = await supabase
            .from('priests')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !priest) {
            return res.status(404).json({
                success: false,
                message: 'Priest not found'
            });
        }

        // Delete image from storage if exists
        if (priest.storage_path) {
            console.log('🗑️ Deleting priest image from storage:', priest.storage_path);
            await supabase.storage.from('gallery-images').remove([priest.storage_path]);
        }

        // Delete priest record
        const { error: deleteError } = await supabase
            .from('priests')
            .delete()
            .eq('id', id);

        if (deleteError) throw deleteError;

        console.log('✅ Priest deleted successfully:', id);

        res.json({
            success: true,
            message: 'Priest deleted successfully'
        });

    } catch (error) {
        console.error('❌ Error deleting priest:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete priest',
            error: error.message
        });
    }
});

module.exports = router;
