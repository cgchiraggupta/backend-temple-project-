// Gallery Routes with Supabase Storage
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');
const path = require('path');

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
        // Accept images only
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    },
});

// Upload gallery image
router.post('/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No image file provided'
            });
        }

        const { title, description, name = 'gallery' } = req.body;

        if (!title) {
            return res.status(400).json({
                success: false,
                message: 'Title is required'
            });
        }

        // Generate unique filename
        const fileExt = path.extname(req.file.originalname);
        const fileName = `${name}/${randomUUID()}${fileExt}`;

        console.log('📤 Uploading image to Supabase Storage:', fileName);

        // Upload to Supabase Storage
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

        console.log('✅ Image uploaded to storage:', uploadData.path);

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('gallery-images')
            .getPublicUrl(fileName);

        console.log('🔗 Public URL:', publicUrl);

        // Save metadata to database
        // Try with service role client first, fallback to regular client
        let dbData, dbError;

        try {
            // Create a service role client for this operation
            const serviceClient = createClient(
                process.env.SUPABASE_URL,
                process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY,
                {
                    auth: {
                        persistSession: false,
                        autoRefreshToken: false
                    }
                }
            );

            const result = await serviceClient
                .from('cms_images')
                .insert({
                    name: name,
                    image_url: publicUrl,
                    title: title,
                    description: description || null,
                    storage_path: fileName,
                    is_active: true
                })
                .select()
                .single();

            dbData = result.data;
            dbError = result.error;
        } catch (error) {
            dbError = error;
        }

        if (dbError) {
            console.error('❌ Database error:', dbError);
            console.error('   Error details:', JSON.stringify(dbError, null, 2));

            // If RLS error, provide helpful message
            if (dbError.message && dbError.message.includes('row-level security')) {
                console.error('\n⚠️  RLS POLICY ERROR DETECTED!');
                console.error('   Run this SQL in Supabase Dashboard:');
                console.error('   ALTER TABLE cms_images DISABLE ROW LEVEL SECURITY;\n');
            }

            // Try to delete uploaded file if database insert fails
            await supabase.storage.from('gallery-images').remove([fileName]);
            throw dbError;
        }

        console.log('✅ Image metadata saved to database');

        res.status(201).json({
            success: true,
            message: 'Image uploaded successfully',
            data: dbData
        });

    } catch (error) {
        console.error('❌ Gallery upload error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to upload image',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
});

// Get all gallery images
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('cms_images')
            .select('*')
            .eq('name', 'gallery')
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({
            success: true,
            data: data || []
        });

    } catch (error) {
        console.error('❌ Error fetching gallery images:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch gallery images',
            error: error.message
        });
    }
});

// Delete gallery image
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { storage_path } = req.body;

        // Get image details first
        const { data: image, error: fetchError } = await supabase
            .from('cms_images')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;

        if (!image) {
            return res.status(404).json({
                success: false,
                message: 'Image not found'
            });
        }

        // Delete from storage if storage_path exists
        if (image.storage_path || storage_path) {
            const pathToDelete = image.storage_path || storage_path;
            console.log('🗑️ Deleting from storage:', pathToDelete);

            const { error: storageError } = await supabase.storage
                .from('gallery-images')
                .remove([pathToDelete]);

            if (storageError) {
                console.warn('⚠️ Storage delete warning:', storageError);
                // Continue even if storage delete fails
            } else {
                console.log('✅ Deleted from storage');
            }
        }

        // Delete from database
        const { error: deleteError } = await supabase
            .from('cms_images')
            .delete()
            .eq('id', id);

        if (deleteError) throw deleteError;

        console.log('✅ Image deleted from database');

        res.json({
            success: true,
            message: 'Image deleted successfully'
        });

    } catch (error) {
        console.error('❌ Error deleting gallery image:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete image',
            error: error.message
        });
    }
});

// Update gallery image metadata
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, is_active } = req.body;

        const updateData = {};
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (is_active !== undefined) updateData.is_active = is_active;

        const { data, error } = await supabase
            .from('cms_images')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json({
            success: true,
            message: 'Image updated successfully',
            data
        });

    } catch (error) {
        console.error('❌ Error updating gallery image:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update image',
            error: error.message
        });
    }
});

module.exports = router;
