// CMS Routes - Simple Link Management
const express = require('express');
const router = express.Router();
const supabaseService = require('../services/supabaseService');
const multer = require('multer');
const { randomUUID } = require('crypto');
const path = require('path');
const { requireAuth } = require('../middleware/authMiddleware');

// Configure multer for memory storage (for puja images)
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

// =============================================
// BANNER ROUTES (single link)
// =============================================
router.get('/banner', async (req, res) => {
    try {
        const { data, error } = await supabaseService.client
            .from('cms_banner')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ success: true, data: data || [] });
    } catch (error) {
        console.error('Error fetching banner:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/banner', requireAuth, async (req, res) => {
    try {
        const { data, error } = await supabaseService.client
            .from('cms_banner')
            .insert(req.body)
            .select('*')
            .single();

        if (error) throw error;
        res.status(201).json({ success: true, data, message: 'Banner created successfully' });
    } catch (error) {
        console.error('Error creating banner:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.put('/banner/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabaseService.client
            .from('cms_banner')
            .update(req.body)
            .eq('id', id)
            .select('*')
            .single();

        if (error) throw error;
        res.json({ success: true, data, message: 'Banner updated successfully' });
    } catch (error) {
        console.error('Error updating banner:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.delete('/banner/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabaseService.client
            .from('cms_banner')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ success: true, message: 'Banner deleted successfully' });
    } catch (error) {
        console.error('Error deleting banner:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// =============================================
// ABOUT ROUTES (single link)
// =============================================
router.get('/about', async (req, res) => {
    try {
        const { data, error } = await supabaseService.client
            .from('cms_about')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ success: true, data: data || [] });
    } catch (error) {
        console.error('Error fetching about:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/about', requireAuth, async (req, res) => {
    try {
        const { data, error } = await supabaseService.client
            .from('cms_about')
            .insert(req.body)
            .select('*')
            .single();

        if (error) throw error;
        res.status(201).json({ success: true, data, message: 'About created successfully' });
    } catch (error) {
        console.error('Error creating about:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.put('/about/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabaseService.client
            .from('cms_about')
            .update(req.body)
            .eq('id', id)
            .select('*')
            .single();

        if (error) throw error;
        res.json({ success: true, data, message: 'About updated successfully' });
    } catch (error) {
        console.error('Error updating about:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.delete('/about/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabaseService.client
            .from('cms_about')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ success: true, message: 'About deleted successfully' });
    } catch (error) {
        console.error('Error deleting about:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// =============================================
// IMAGES ROUTES (multiple images by name: puja, gallery, broadcast, banner)
// =============================================

// GET images by name
router.get('/images/:name', async (req, res) => {
    try {
        const { name } = req.params;

        let query = supabaseService.client
            .from('cms_images')
            .select('*');

        // If requesting 'banner', get all banner slots (banner-1, banner-2, banner-3, banner-4)
        if (name === 'banner') {
            query = query.or('name.eq.banner-1,name.eq.banner-2,name.eq.banner-3,name.eq.banner-4');
        } else {
            query = query.eq('name', name);
        }

        query = query.order('name', { ascending: true });

        const { data, error } = await query;

        if (error) throw error;

        // Sort banner slots in order
        if (name === 'banner' && data) {
            data.sort((a, b) => {
                const aNum = parseInt(a.name.split('-')[1] || '0');
                const bNum = parseInt(b.name.split('-')[1] || '0');
                return aNum - bNum;
            });
        }

        res.json({ success: true, data: data || [] });
    } catch (error) {
        console.error('Error fetching images:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// =============================================
// PUBLIC ENDPOINTS (mounted at /api/cms/public)
// These routes work both with /public prefix (for /api/cms) and without (for /api/cms/public)
// =============================================

// PUBLIC ENDPOINT: Get active banner image for main website
router.get('/banner', async (req, res) => {
    try {
        const { data, error } = await supabaseService.client
            .from('cms_images')
            .select('*')
            .eq('name', 'banner')
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.json({ success: true, data: null });
            }
            throw error;
        }
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching public banner:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// PUBLIC ENDPOINT: Get ALL active banners for carousel
router.get('/banners', async (req, res) => {
    try {
        console.log('📸 Fetching all active banners for carousel');

        const { data, error } = await supabaseService.client
            .from('cms_images')
            .select('*')
            .or('name.eq.banner-1,name.eq.banner-2,name.eq.banner-3,name.eq.banner-4')
            .eq('is_active', true)
            .order('name', { ascending: true });

        if (error) throw error;

        if (data) {
            data.sort((a, b) => {
                const aNum = parseInt(a.name.split('-')[1] || '0');
                const bNum = parseInt(b.name.split('-')[1] || '0');
                return aNum - bNum;
            });
        }

        console.log(`✅ Found ${data?.length || 0} active banners`);
        res.json({ success: true, data: data || [], count: data?.length || 0 });
    } catch (error) {
        console.error('❌ Error fetching public banners:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// PUBLIC ENDPOINT: Get individual banner by slot
router.get('/banner/:slot', async (req, res) => {
    try {
        const { slot } = req.params;
        const validSlots = ['banner-1', 'banner-2', 'banner-3', 'banner-4'];

        if (!validSlots.includes(slot)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid banner slot. Use banner-1, banner-2, banner-3, or banner-4'
            });
        }

        console.log(`📸 Fetching ${slot}`);

        const { data, error } = await supabaseService.client
            .from('cms_images')
            .select('*')
            .eq('name', slot)
            .eq('is_active', true)
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        if (!data) {
            return res.json({ success: true, data: null, message: `No active banner found for ${slot}` });
        }

        console.log(`✅ Found ${slot}`);
        res.json({ success: true, data });
    } catch (error) {
        console.error('❌ Error fetching banner:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// PUBLIC ENDPOINT: Get active pujas
router.get('/pujas', async (req, res) => {
    try {
        const { data, error } = await supabaseService.client
            .from('cms_pujas')
            .select('*')
            .eq('is_active', true)
            .order('display_order', { ascending: true });

        if (error) throw error;
        res.json({ success: true, data: data || [] });
    } catch (error) {
        console.error('Error fetching public pujas:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// PUBLIC ENDPOINT: Get sai aangan
router.get('/sai-aangan', async (req, res) => {
    try {
        const { data, error } = await supabaseService.client
            .from('cms_sai_aangan')
            .select('*')
            .eq('is_active', true)
            .order('display_order', { ascending: true });

        if (error) throw error;
        res.json({ success: true, data: data || [] });
    } catch (error) {
        console.error('Error fetching public sai aangan:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// PUBLIC ENDPOINT: Get upcoming events
router.get('/upcoming-events', async (req, res) => {
    try {
        const { data, error } = await supabaseService.client
            .from('cms_upcoming_events')
            .select('*')
            .eq('is_active', true)
            .gte('event_date', new Date().toISOString().split('T')[0])
            .order('event_date', { ascending: true });

        if (error) throw error;
        res.json({ success: true, data: data || [] });
    } catch (error) {
        console.error('Error fetching public upcoming events:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// PUBLIC ENDPOINT: Get mandir hours
router.get('/mandir-hours', async (req, res) => {
    try {
        const { data, error } = await supabaseService.client
            .from('cms_mandir_hours')
            .select('*')
            .eq('is_active', true)
            .order('display_order', { ascending: true });

        if (error) throw error;
        res.json({ success: true, data: data || [] });
    } catch (error) {
        console.error('Error fetching public mandir hours:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// =============================================
// LEGACY PUBLIC ENDPOINTS (with /public prefix for backward compatibility)
// =============================================

// PUBLIC ENDPOINT: Get active banner image for main website
router.get('/public/banner', async (req, res) => {
    try {
        const { data, error } = await supabaseService.client
            .from('cms_images')
            .select('*')
            .eq('name', 'banner')
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error) {
            // If no banner found, return empty response
            if (error.code === 'PGRST116') {
                return res.json({ success: true, data: null });
            }
            throw error;
        }

        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching public banner:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// PUBLIC ENDPOINT: Get ALL active banners for carousel
router.get('/public/banners', async (req, res) => {
    try {
        console.log('📸 Fetching all active banners for carousel');

        const { data, error } = await supabaseService.client
            .from('cms_images')
            .select('*')
            .or('name.eq.banner-1,name.eq.banner-2,name.eq.banner-3,name.eq.banner-4')
            .eq('is_active', true)
            .order('name', { ascending: true });

        if (error) throw error;

        // Sort by banner number
        if (data) {
            data.sort((a, b) => {
                const aNum = parseInt(a.name.split('-')[1] || '0');
                const bNum = parseInt(b.name.split('-')[1] || '0');
                return aNum - bNum;
            });
        }

        console.log(`✅ Found ${data?.length || 0} active banners`);

        res.json({
            success: true,
            data: data || [],
            count: data?.length || 0
        });
    } catch (error) {
        console.error('❌ Error fetching public banners:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// PUBLIC ENDPOINT: Get individual banner by slot (banner-1, banner-2, banner-3, banner-4)
router.get('/public/banner/:slot', async (req, res) => {
    try {
        const { slot } = req.params;
        const validSlots = ['banner-1', 'banner-2', 'banner-3', 'banner-4'];

        if (!validSlots.includes(slot)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid banner slot. Use banner-1, banner-2, banner-3, or banner-4'
            });
        }

        console.log(`📸 Fetching ${slot}`);

        const { data, error } = await supabaseService.client
            .from('cms_images')
            .select('*')
            .eq('name', slot)
            .eq('is_active', true)
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        if (!data) {
            return res.json({
                success: true,
                data: null,
                message: `No active banner found for ${slot}`
            });
        }

        console.log(`✅ Found ${slot}`);
        res.json({ success: true, data });
    } catch (error) {
        console.error('❌ Error fetching banner:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST create image
router.post('/images', requireAuth, async (req, res) => {
    try {
        const { data, error } = await supabaseService.client
            .from('cms_images')
            .insert(req.body)
            .select('*')
            .single();

        if (error) throw error;
        res.status(201).json({ success: true, data, message: 'Image added successfully' });
    } catch (error) {
        console.error('Error creating image:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST upload banner image with file
router.post('/banner/upload', requireAuth, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No image file provided'
            });
        }

        const { title, description, slot } = req.body;
        const bannerSlot = slot || 'banner-1'; // Default to banner-1

        // Validate slot name
        const validSlots = ['banner-1', 'banner-2', 'banner-3', 'banner-4'];
        if (!validSlots.includes(bannerSlot)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid banner slot. Must be banner-1, banner-2, banner-3, or banner-4'
            });
        }

        // Generate unique filename
        const fileExt = path.extname(req.file.originalname);
        const fileName = `banners/${bannerSlot}-${randomUUID()}${fileExt}`;

        console.log('📤 Uploading banner image to Supabase Storage:', fileName);

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabaseService.client.storage
            .from('gallery-images')
            .upload(fileName, req.file.buffer, {
                contentType: req.file.mimetype,
                upsert: false
            });

        if (uploadError) {
            console.error('❌ Supabase upload error:', uploadError);
            throw uploadError;
        }

        console.log('✅ Banner image uploaded to storage:', uploadData.path);

        // Get public URL
        const { data: { publicUrl } } = supabaseService.client.storage
            .from('gallery-images')
            .getPublicUrl(fileName);

        console.log('🔗 Public URL:', publicUrl);

        // Check if banner slot already exists
        const { data: existingBanner, error: fetchError } = await supabaseService.client
            .from('cms_images')
            .select('*')
            .eq('name', bannerSlot)
            .single();

        let dbData, dbError;

        if (existingBanner) {
            // Delete old image from storage if exists
            if (existingBanner.storage_path) {
                await supabaseService.client.storage
                    .from('gallery-images')
                    .remove([existingBanner.storage_path]);
                console.log('🗑️ Deleted old banner image from storage');
            }

            // Update existing banner
            const result = await supabaseService.client
                .from('cms_images')
                .update({
                    image_url: publicUrl,
                    title: title || existingBanner.title || `Banner ${bannerSlot.split('-')[1]}`,
                    description: description || existingBanner.description || '',
                    storage_path: fileName,
                    is_active: true,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existingBanner.id)
                .select()
                .single();

            dbData = result.data;
            dbError = result.error;
            console.log('✅ Banner updated in database');
        } else {
            // Create new banner
            const result = await supabaseService.client
                .from('cms_images')
                .insert({
                    name: bannerSlot,
                    image_url: publicUrl,
                    title: title || `Banner ${bannerSlot.split('-')[1]}`,
                    description: description || '',
                    storage_path: fileName,
                    is_active: true
                })
                .select()
                .single();

            dbData = result.data;
            dbError = result.error;
            console.log('✅ Banner created in database');
        }

        if (dbError) {
            console.error('❌ Database error:', dbError);
            // Try to delete uploaded file if database operation fails
            await supabaseService.client.storage.from('gallery-images').remove([fileName]);
            throw dbError;
        }

        res.status(201).json({
            success: true,
            message: existingBanner ? 'Banner updated successfully' : 'Banner created successfully',
            data: dbData
        });

    } catch (error) {
        console.error('❌ Banner upload error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to upload banner image',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
});

// DELETE banner image
router.delete('/banner/image/:slot', requireAuth, async (req, res) => {
    try {
        const { slot } = req.params;

        // Get banner to find storage_path
        const { data: banner, error: fetchError } = await supabaseService.client
            .from('cms_images')
            .select('*')
            .eq('name', slot)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

        if (!banner) {
            return res.status(404).json({
                success: false,
                message: 'Banner not found'
            });
        }

        // Delete from storage if storage_path exists
        if (banner.storage_path) {
            const { error: storageError } = await supabaseService.client.storage
                .from('gallery-images')
                .remove([banner.storage_path]);

            if (storageError) {
                console.warn('⚠️ Storage delete warning:', storageError);
            } else {
                console.log('✅ Deleted banner from storage');
            }
        }

        // Delete from database
        const { error: deleteError } = await supabaseService.client
            .from('cms_images')
            .delete()
            .eq('id', banner.id);

        if (deleteError) throw deleteError;

        console.log('✅ Banner deleted from database');

        res.json({
            success: true,
            message: 'Banner deleted successfully'
        });

    } catch (error) {
        console.error('❌ Error deleting banner:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete banner',
            error: error.message
        });
    }
});

// PUT update image
router.put('/images/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabaseService.client
            .from('cms_images')
            .update(req.body)
            .eq('id', id)
            .select('*')
            .single();

        if (error) throw error;
        res.json({ success: true, data, message: 'Image updated successfully' });
    } catch (error) {
        console.error('Error updating image:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// DELETE image
router.delete('/images/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabaseService.client
            .from('cms_images')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ success: true, message: 'Image deleted successfully' });
    } catch (error) {
        console.error('Error deleting image:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// =============================================
// CONTACT FORM ROUTES
// =============================================

// GET all contact submissions
router.get('/contact', requireAuth, async (req, res) => {
    try {
        const { status, is_read } = req.query;
        let query = supabaseService.client
            .from('cms_contact')
            .select('*')
            .order('created_at', { ascending: false });

        if (status) {
            query = query.eq('status', status);
        }
        if (is_read !== undefined) {
            query = query.eq('is_read', is_read === 'true');
        }

        const { data, error } = await query;

        if (error) throw error;
        res.json({ success: true, data: data || [] });
    } catch (error) {
        console.error('Error fetching contact submissions:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET single contact submission
router.get('/contact/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabaseService.client
            .from('cms_contact')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching contact submission:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST create contact submission (public endpoint for website)
router.post('/contact', async (req, res) => {
    try {
        const { data, error } = await supabaseService.client
            .from('cms_contact')
            .insert(req.body)
            .select('*')
            .single();

        if (error) throw error;
        res.status(201).json({ success: true, data, message: 'Contact form submitted successfully' });
    } catch (error) {
        console.error('Error creating contact submission:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// PUT update contact submission (mark as read, add notes, etc.)
router.put('/contact/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabaseService.client
            .from('cms_contact')
            .update(req.body)
            .eq('id', id)
            .select('*')
            .single();

        if (error) throw error;
        res.json({ success: true, data, message: 'Contact submission updated successfully' });
    } catch (error) {
        console.error('Error updating contact submission:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// DELETE contact submission
router.delete('/contact/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabaseService.client
            .from('cms_contact')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ success: true, message: 'Contact submission deleted successfully' });
    } catch (error) {
        console.error('Error deleting contact submission:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// =============================================
// ANNOUNCEMENTS ROUTES (Global Announcements)
// =============================================

// GET public announcements (website endpoint)
router.get('/public/announcements', async (req, res) => {
    try {
        const { data, error } = await supabaseService.client
            .from('cms_announcements')
            .select('*')
            .eq('is_active', true)
            .order('priority', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ success: true, data: data || [] });
    } catch (error) {
        console.error('Error fetching public announcements:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET all announcements (CMS endpoint)
router.get('/announcements', requireAuth, async (req, res) => {
    try {
        const { data, error } = await supabaseService.client
            .from('cms_announcements')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ success: true, data: data || [] });
    } catch (error) {
        console.error('Error fetching announcements:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST create announcement
router.post('/announcements', requireAuth, async (req, res) => {
    try {
        const { data, error } = await supabaseService.client
            .from('cms_announcements')
            .insert(req.body)
            .select('*')
            .single();

        if (error) throw error;
        res.status(201).json({ success: true, data, message: 'Announcement created successfully' });
    } catch (error) {
        console.error('Error creating announcement:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// PUT update announcement
router.put('/announcements/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabaseService.client
            .from('cms_announcements')
            .update(req.body)
            .eq('id', id)
            .select('*')
            .single();

        if (error) throw error;
        res.json({ success: true, data, message: 'Announcement updated successfully' });
    } catch (error) {
        console.error('Error updating announcement:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// DELETE announcement
router.delete('/announcements/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabaseService.client
            .from('cms_announcements')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ success: true, message: 'Announcement deleted successfully' });
    } catch (error) {
        console.error('Error deleting announcement:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});


// PATCH mark as read
router.patch('/contact/:id/read', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabaseService.client
            .from('cms_contact')
            .update({ is_read: true, status: 'read' })
            .eq('id', id)
            .select('*')
            .single();

        if (error) throw error;
        res.json({ success: true, data, message: 'Marked as read' });
    } catch (error) {
        console.error('Error marking as read:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// =============================================
// CMS PUJAS ROUTES (with image upload support)
// =============================================
router.get('/pujas', async (req, res) => {
    try {
        const { data, error } = await supabaseService.client
            .from('cms_pujas')
            .select('*')
            .order('display_order', { ascending: true });

        if (error) throw error;
        res.json({ success: true, data: data || [] });
    } catch (error) {
        console.error('Error fetching CMS pujas:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/pujas/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabaseService.client
            .from('cms_pujas')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching CMS puja:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST create puja with optional image upload
router.post('/pujas', requireAuth, upload.single('image'), async (req, res) => {
    try {
        let imageUrl = req.body.image_url || '';
        let storagePath = '';

        // Handle image upload if file is provided
        if (req.file) {
            const fileExt = path.extname(req.file.originalname);
            const fileName = `pujas/${randomUUID()}${fileExt}`;

            console.log('📤 Uploading puja image to Supabase Storage:', fileName);

            const { data: uploadData, error: uploadError } = await supabaseService.client.storage
                .from('gallery-images')
                .upload(fileName, req.file.buffer, {
                    contentType: req.file.mimetype,
                    upsert: false
                });

            if (uploadError) {
                console.error('❌ Supabase upload error:', uploadError);
                throw uploadError;
            }

            const { data: { publicUrl } } = supabaseService.client.storage
                .from('gallery-images')
                .getPublicUrl(fileName);

            imageUrl = publicUrl;
            storagePath = fileName;
            console.log('✅ Puja image uploaded:', publicUrl);
        }

        // Parse JSON fields if they're strings
        let benefits = req.body.benefits;
        let itemsIncluded = req.body.items_included;

        if (typeof benefits === 'string') {
            try { benefits = JSON.parse(benefits); } catch { benefits = []; }
        }
        if (typeof itemsIncluded === 'string') {
            try { itemsIncluded = JSON.parse(itemsIncluded); } catch { itemsIncluded = []; }
        }

        const pujaData = {
            name: req.body.name,
            slug: req.body.slug,
            description: req.body.description || '',
            short_description: req.body.short_description || '',
            image_url: imageUrl,
            price: parseFloat(req.body.price) || 0,
            price_display: req.body.price_display || '',
            duration: req.body.duration || '',
            location: req.body.location || '',
            priest_name: req.body.priest_name || '',
            category: req.body.category || 'General Puja',
            benefits: benefits || [],
            items_included: itemsIncluded || [],
            booking_required: req.body.booking_required === 'true' || req.body.booking_required === true,
            advance_booking_days: parseInt(req.body.advance_booking_days) || 0,
            is_featured: req.body.is_featured === 'true' || req.body.is_featured === true,
            is_active: req.body.is_active !== 'false' && req.body.is_active !== false,
            display_order: parseInt(req.body.display_order) || 0,
        };

        // Only add storage_path if we have one (column may not exist in older tables)
        if (storagePath) {
            pujaData.storage_path = storagePath;
        }

        console.log('📝 Creating puja with data:', JSON.stringify(pujaData, null, 2));

        const { data, error } = await supabaseService.client
            .from('cms_pujas')
            .insert(pujaData)
            .select('*')
            .single();

        if (error) {
            console.error('❌ Database insert error:', error);
            throw error;
        }

        console.log('✅ Puja created successfully:', data?.id);
        res.status(201).json({ success: true, data, message: 'Puja created successfully' });
    } catch (error) {
        console.error('Error creating CMS puja:', error);
        res.status(500).json({ success: false, message: error.message, error: error.message });
    }
});

// PUT update puja with optional image upload
router.put('/pujas/:id', requireAuth, upload.single('image'), async (req, res) => {
    try {
        const { id } = req.params;
        let imageUrl = req.body.image_url;
        let storagePath = req.body.storage_path || '';

        // Handle new image upload if file is provided
        if (req.file) {
            // Delete old image if exists
            if (req.body.storage_path) {
                await supabaseService.client.storage
                    .from('gallery-images')
                    .remove([req.body.storage_path]);
            }

            const fileExt = path.extname(req.file.originalname);
            const fileName = `pujas/${randomUUID()}${fileExt}`;

            const { data: uploadData, error: uploadError } = await supabaseService.client.storage
                .from('gallery-images')
                .upload(fileName, req.file.buffer, {
                    contentType: req.file.mimetype,
                    upsert: false
                });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabaseService.client.storage
                .from('gallery-images')
                .getPublicUrl(fileName);

            imageUrl = publicUrl;
            storagePath = fileName;
        }

        // Parse JSON fields if they're strings
        let benefits = req.body.benefits;
        let itemsIncluded = req.body.items_included;

        if (typeof benefits === 'string') {
            try { benefits = JSON.parse(benefits); } catch { benefits = []; }
        }
        if (typeof itemsIncluded === 'string') {
            try { itemsIncluded = JSON.parse(itemsIncluded); } catch { itemsIncluded = []; }
        }

        const updateData = {
            name: req.body.name,
            slug: req.body.slug,
            description: req.body.description || '',
            short_description: req.body.short_description || '',
            price: parseFloat(req.body.price) || 0,
            price_display: req.body.price_display || '',
            duration: req.body.duration || '',
            location: req.body.location || '',
            priest_name: req.body.priest_name || '',
            category: req.body.category || 'General Puja',
            benefits: benefits || [],
            items_included: itemsIncluded || [],
            booking_required: req.body.booking_required === 'true' || req.body.booking_required === true,
            advance_booking_days: parseInt(req.body.advance_booking_days) || 0,
            is_featured: req.body.is_featured === 'true' || req.body.is_featured === true,
            is_active: req.body.is_active !== 'false' && req.body.is_active !== false,
            display_order: parseInt(req.body.display_order) || 0,
            updated_at: new Date().toISOString()
        };

        if (imageUrl !== undefined) updateData.image_url = imageUrl;
        // Only update storage_path if we have a new one from file upload
        // Skip if column doesn't exist in table

        console.log('📝 Updating puja with data:', JSON.stringify(updateData, null, 2));

        const { data, error } = await supabaseService.client
            .from('cms_pujas')
            .update(updateData)
            .eq('id', id)
            .select('*')
            .single();

        if (error) {
            console.error('❌ Database update error:', error);
            throw error;
        }

        console.log('✅ Puja updated successfully:', data?.id);
        res.json({ success: true, data, message: 'Puja updated successfully' });
    } catch (error) {
        console.error('Error updating CMS puja:', error);
        res.status(500).json({ success: false, message: error.message, error: error.message });
    }
});

// DELETE puja (also deletes image from storage)
router.delete('/pujas/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;

        // Get puja to find storage_path
        const { data: puja, error: fetchError } = await supabaseService.client
            .from('cms_pujas')
            .select('storage_path')
            .eq('id', id)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

        // Delete image from storage if exists
        if (puja?.storage_path) {
            await supabaseService.client.storage
                .from('gallery-images')
                .remove([puja.storage_path]);
            console.log('✅ Deleted puja image from storage');
        }

        const { error } = await supabaseService.client
            .from('cms_pujas')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ success: true, message: 'Puja deleted successfully' });
    } catch (error) {
        console.error('Error deleting CMS puja:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// PUBLIC ENDPOINT: Get active pujas for website
router.get('/public/pujas', async (req, res) => {
    try {
        const { data, error } = await supabaseService.client
            .from('cms_pujas')
            .select('*')
            .eq('is_active', true)
            .order('display_order', { ascending: true });

        if (error) throw error;
        res.json({ success: true, data: data || [] });
    } catch (error) {
        console.error('Error fetching public pujas:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// =============================================
// ABOUT MANDIR ROUTES
// =============================================
router.get('/about-mandir', async (req, res) => {
    try {
        const { data, error } = await supabaseService.client
            .from('about_mandir')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ success: true, data: data || [] });
    } catch (error) {
        console.error('Error fetching about mandir:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/about-mandir', requireAuth, async (req, res) => {
    try {
        const { data, error } = await supabaseService.client
            .from('about_mandir')
            .insert({
                ...req.body,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select('*')
            .single();

        if (error) throw error;
        res.status(201).json({ success: true, data, message: 'About Mandir created successfully' });
    } catch (error) {
        console.error('Error creating about mandir:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.put('/about-mandir/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        console.log('Updating about_mandir:', id, req.body);

        const { data, error } = await supabaseService.client
            .from('about_mandir')
            .update({
                ...req.body,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select('*');

        if (error) {
            console.error('Supabase error:', error);
            throw error;
        }

        if (!data || data.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'About Mandir record not found'
            });
        }

        console.log('Update successful:', data[0]);
        res.json({ success: true, data: data[0], message: 'About Mandir updated successfully' });
    } catch (error) {
        console.error('Error updating about mandir:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.delete('/about-mandir/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabaseService.client
            .from('about_mandir')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ success: true, message: 'About Mandir deleted successfully' });
    } catch (error) {
        console.error('Error deleting about mandir:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// PUBLIC ENDPOINT: Get About Mandir content for website
router.get('/public/about-mandir', async (req, res) => {
    try {
        const { data, error } = await supabaseService.client
            .from('about_mandir')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ success: true, data: data || [] });
    } catch (error) {
        console.error('Error fetching public about mandir:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// =============================================
// SAI AANGAN (Mandir Expansion) ROUTES
// =============================================
router.get('/sai-aangan', async (req, res) => {
    try {
        const { data, error } = await supabaseService.client
            .from('cms_sai_aangan')
            .select('*')
            .order('display_order', { ascending: true });

        if (error) throw error;
        res.json({ success: true, data: data || [] });
    } catch (error) {
        console.error('Error fetching sai aangan:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/sai-aangan', requireAuth, upload.single('image'), async (req, res) => {
    try {
        let imageUrl = req.body.image_url || '';

        if (req.file) {
            const fileExt = path.extname(req.file.originalname);
            const fileName = `sai-aangan/${randomUUID()}${fileExt}`;

            const { error: uploadError } = await supabaseService.client.storage
                .from('gallery-images')
                .upload(fileName, req.file.buffer, {
                    contentType: req.file.mimetype,
                    upsert: false
                });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabaseService.client.storage
                .from('gallery-images')
                .getPublicUrl(fileName);

            imageUrl = publicUrl;
        }

        let timelineUpdates = req.body.timeline_updates;
        if (typeof timelineUpdates === 'string') {
            try { timelineUpdates = JSON.parse(timelineUpdates); } catch { timelineUpdates = []; }
        }

        const { data, error } = await supabaseService.client
            .from('cms_sai_aangan')
            .insert({
                title: req.body.title,
                description: req.body.description || '',
                image_url: imageUrl,
                timeline_updates: timelineUpdates || [],
                donation_link: req.body.donation_link || '',
                display_order: parseInt(req.body.display_order) || 0,
                is_active: req.body.is_active !== 'false'
            })
            .select('*')
            .single();

        if (error) throw error;
        res.status(201).json({ success: true, data, message: 'Sai Aangan project created' });
    } catch (error) {
        console.error('Error creating sai aangan:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.put('/sai-aangan/:id', requireAuth, upload.single('image'), async (req, res) => {
    try {
        const { id } = req.params;
        let imageUrl = req.body.image_url;

        if (req.file) {
            const fileExt = path.extname(req.file.originalname);
            const fileName = `sai-aangan/${randomUUID()}${fileExt}`;

            const { error: uploadError } = await supabaseService.client.storage
                .from('gallery-images')
                .upload(fileName, req.file.buffer, {
                    contentType: req.file.mimetype,
                    upsert: false
                });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabaseService.client.storage
                .from('gallery-images')
                .getPublicUrl(fileName);

            imageUrl = publicUrl;
        }

        let timelineUpdates = req.body.timeline_updates;
        if (typeof timelineUpdates === 'string') {
            try { timelineUpdates = JSON.parse(timelineUpdates); } catch { timelineUpdates = []; }
        }

        const updateData = {
            title: req.body.title,
            description: req.body.description || '',
            timeline_updates: timelineUpdates || [],
            donation_link: req.body.donation_link || '',
            display_order: parseInt(req.body.display_order) || 0,
            is_active: req.body.is_active !== 'false',
            updated_at: new Date().toISOString()
        };

        if (imageUrl) updateData.image_url = imageUrl;

        const { data, error } = await supabaseService.client
            .from('cms_sai_aangan')
            .update(updateData)
            .eq('id', id)
            .select('*')
            .single();

        if (error) throw error;
        res.json({ success: true, data, message: 'Sai Aangan project updated' });
    } catch (error) {
        console.error('Error updating sai aangan:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.delete('/sai-aangan/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabaseService.client
            .from('cms_sai_aangan')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ success: true, message: 'Sai Aangan project deleted' });
    } catch (error) {
        console.error('Error deleting sai aangan:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/public/sai-aangan', async (req, res) => {
    try {
        const { data, error } = await supabaseService.client
            .from('cms_sai_aangan')
            .select('*')
            .eq('is_active', true)
            .order('display_order', { ascending: true });

        if (error) throw error;
        res.json({ success: true, data: data || [] });
    } catch (error) {
        console.error('Error fetching public sai aangan:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// =============================================
// UPCOMING EVENTS ROUTES
// =============================================
router.get('/upcoming-events', async (req, res) => {
    try {
        const { data, error } = await supabaseService.client
            .from('cms_upcoming_events')
            .select('*')
            .order('event_date', { ascending: true });

        if (error) throw error;
        res.json({ success: true, data: data || [] });
    } catch (error) {
        console.error('Error fetching upcoming events:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/upcoming-events', requireAuth, async (req, res) => {
    try {
        const { data, error } = await supabaseService.client
            .from('cms_upcoming_events')
            .insert({
                event_name: req.body.event_name,
                event_date: req.body.event_date,
                day_of_week: req.body.day_of_week || '',
                time_details: req.body.time_details || '',
                description: req.body.description || '',
                details_link: req.body.details_link || '',
                display_order: parseInt(req.body.display_order) || 0,
                is_active: req.body.is_active !== false
            })
            .select('*')
            .single();

        if (error) throw error;
        res.status(201).json({ success: true, data, message: 'Event created' });
    } catch (error) {
        console.error('Error creating upcoming event:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.put('/upcoming-events/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabaseService.client
            .from('cms_upcoming_events')
            .update({
                event_name: req.body.event_name,
                event_date: req.body.event_date,
                day_of_week: req.body.day_of_week || '',
                time_details: req.body.time_details || '',
                description: req.body.description || '',
                details_link: req.body.details_link || '',
                display_order: parseInt(req.body.display_order) || 0,
                is_active: req.body.is_active !== false,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select('*')
            .single();

        if (error) throw error;
        res.json({ success: true, data, message: 'Event updated' });
    } catch (error) {
        console.error('Error updating upcoming event:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.delete('/upcoming-events/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabaseService.client
            .from('cms_upcoming_events')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ success: true, message: 'Event deleted' });
    } catch (error) {
        console.error('Error deleting upcoming event:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/public/upcoming-events', async (req, res) => {
    try {
        const { data, error } = await supabaseService.client
            .from('cms_upcoming_events')
            .select('*')
            .eq('is_active', true)
            .gte('event_date', new Date().toISOString().split('T')[0])
            .order('event_date', { ascending: true });

        if (error) throw error;
        res.json({ success: true, data: data || [] });
    } catch (error) {
        console.error('Error fetching public upcoming events:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// =============================================
// MANDIR HOURS & AARTI TIMES ROUTES
// =============================================
router.get('/mandir-hours', async (req, res) => {
    try {
        const { data, error } = await supabaseService.client
            .from('cms_mandir_hours')
            .select('*')
            .order('display_order', { ascending: true });

        if (error) throw error;
        res.json({ success: true, data: data || [] });
    } catch (error) {
        console.error('Error fetching mandir hours:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/mandir-hours', requireAuth, async (req, res) => {
    try {
        console.log('📝 Creating mandir hours - Raw body:', JSON.stringify(req.body, null, 2));

        let timings = req.body.timings;
        console.log('📝 Timings before parse - Type:', typeof timings, 'Value:', timings);

        if (typeof timings === 'string') {
            try {
                timings = JSON.parse(timings);
                console.log('📝 Timings after parse:', JSON.stringify(timings));
            } catch (e) {
                console.error('❌ Failed to parse timings:', e);
                timings = [];
            }
        }

        const insertData = {
            section_type: req.body.section_type,
            title: req.body.title || '',
            description: req.body.description || '',
            timings: timings || [],
            display_order: parseInt(req.body.display_order) || 0,
            is_active: req.body.is_active !== false
        };

        console.log('📝 Insert data:', JSON.stringify(insertData, null, 2));

        const { data, error } = await supabaseService.client
            .from('cms_mandir_hours')
            .insert(insertData)
            .select('*')
            .single();

        if (error) {
            console.error('❌ Supabase error:', error);
            throw error;
        }

        console.log('✅ Mandir hours created:', JSON.stringify(data, null, 2));
        res.status(201).json({ success: true, data, message: 'Mandir hours created' });
    } catch (error) {
        console.error('Error creating mandir hours:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.put('/mandir-hours/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        console.log('📝 Updating mandir hours ID:', id, '- Raw body:', JSON.stringify(req.body, null, 2));

        let timings = req.body.timings;
        console.log('📝 Timings before parse - Type:', typeof timings, 'Value:', timings);

        if (typeof timings === 'string') {
            try {
                timings = JSON.parse(timings);
                console.log('📝 Timings after parse:', JSON.stringify(timings));
            } catch (e) {
                console.error('❌ Failed to parse timings:', e);
                timings = [];
            }
        }

        const updateData = {
            section_type: req.body.section_type,
            title: req.body.title || '',
            description: req.body.description || '',
            timings: timings || [],
            display_order: parseInt(req.body.display_order) || 0,
            is_active: req.body.is_active !== false,
            updated_at: new Date().toISOString()
        };

        console.log('📝 Update data:', JSON.stringify(updateData, null, 2));

        const { data, error } = await supabaseService.client
            .from('cms_mandir_hours')
            .update(updateData)
            .eq('id', id)
            .select('*')
            .single();

        if (error) {
            console.error('❌ Supabase error:', error);
            throw error;
        }

        console.log('✅ Mandir hours updated:', JSON.stringify(data, null, 2));
        res.json({ success: true, data, message: 'Mandir hours updated' });
    } catch (error) {
        console.error('Error updating mandir hours:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.delete('/mandir-hours/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabaseService.client
            .from('cms_mandir_hours')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ success: true, message: 'Mandir hours deleted' });
    } catch (error) {
        console.error('Error deleting mandir hours:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/public/mandir-hours', async (req, res) => {
    try {
        const { data, error } = await supabaseService.client
            .from('cms_mandir_hours')
            .select('*')
            .eq('is_active', true)
            .order('display_order', { ascending: true });

        if (error) throw error;
        res.json({ success: true, data: data || [] });
    } catch (error) {
        console.error('Error fetching public mandir hours:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// =============================================
// BAL VIDYA MANDIR ROUTES
// =============================================

// Configure multer for document uploads (PDFs, images, and common document formats)
const documentUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit for documents
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            // Documents
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'text/plain',
            // Images
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'image/svg+xml',
        ];
        if (!allowedTypes.includes(file.mimetype)) {
            return cb(new Error('File type not allowed. Supported: PDF, Word, Excel, PowerPoint, images (JPEG, PNG, GIF, WebP, SVG), and text files.'), false);
        }
        cb(null, true);
    },
});

// Helper function to ensure bucket exists
async function ensureBalVidyaBucketExists() {
    try {
        const { data: buckets } = await supabaseService.client.storage.listBuckets();
        const bucketExists = buckets?.some(b => b.name === 'bal-vidya-documents');

        if (!bucketExists) {
            console.log('📦 Creating bal-vidya-documents bucket...');
            const { error } = await supabaseService.client.storage.createBucket('bal-vidya-documents', {
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

// POST /cms/bal-vidya/upload-document - Upload document for Bal Vidya
router.post('/bal-vidya/upload-document', requireAuth, documentUpload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No document file provided'
            });
        }

        const { documentType } = req.body; // 'syllabus' or 'parent_guidelines'

        if (!documentType || !['syllabus', 'parent_guidelines'].includes(documentType)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid document type. Must be "syllabus" or "parent_guidelines"'
            });
        }

        console.log('📤 Uploading Bal Vidya document:', req.file.originalname, 'Type:', documentType);

        // Ensure bucket exists
        await ensureBalVidyaBucketExists();

        // Generate unique filename
        const fileExt = path.extname(req.file.originalname);
        const fileName = `${documentType}/${randomUUID()}${fileExt}`;

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabaseService.client.storage
            .from('bal-vidya-documents')
            .upload(fileName, req.file.buffer, {
                contentType: req.file.mimetype,
                upsert: false
            });

        if (uploadError) {
            console.error('❌ Supabase upload error:', uploadError);
            throw uploadError;
        }

        console.log('✅ Document uploaded to storage:', uploadData.path);

        // Get public URL
        const { data: { publicUrl } } = supabaseService.client.storage
            .from('bal-vidya-documents')
            .getPublicUrl(fileName);

        console.log('🔗 Public URL:', publicUrl);

        res.json({
            success: true,
            data: {
                url: publicUrl,
                path: fileName,
                documentType: documentType,
                fileName: req.file.originalname
            },
            message: 'Document uploaded successfully'
        });

    } catch (error) {
        console.error('❌ Error uploading Bal Vidya document:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to upload document'
        });
    }
});

// GET Bal Vidya content
router.get('/bal-vidya', async (req, res) => {
    try {
        const { data, error } = await supabaseService.client
            .from('cms_bal_vidya_mandir')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        res.json({ success: true, data: data || null });
    } catch (error) {
        console.error('Error fetching Bal Vidya content:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST create Bal Vidya content
router.post('/bal-vidya', requireAuth, async (req, res) => {
    try {
        const { data, error } = await supabaseService.client
            .from('cms_bal_vidya_mandir')
            .insert(req.body)
            .select('*')
            .single();

        if (error) throw error;
        res.status(201).json({ success: true, data, message: 'Bal Vidya content created' });
    } catch (error) {
        console.error('Error creating Bal Vidya content:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// PUT update Bal Vidya content
router.put('/bal-vidya/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = {
            ...req.body,
            updated_at: new Date().toISOString()
        };

        const { data, error } = await supabaseService.client
            .from('cms_bal_vidya_mandir')
            .update(updateData)
            .eq('id', id)
            .select('*')
            .single();

        if (error) throw error;
        res.json({ success: true, data, message: 'Bal Vidya content updated' });
    } catch (error) {
        console.error('Error updating Bal Vidya content:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// DELETE Bal Vidya content
router.delete('/bal-vidya/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabaseService.client
            .from('cms_bal_vidya_mandir')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ success: true, message: 'Bal Vidya content deleted' });
    } catch (error) {
        console.error('Error deleting Bal Vidya content:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// PUBLIC ENDPOINT: Get Bal Vidya content for website
router.get('/public/bal-vidya', async (req, res) => {
    try {
        const { data, error } = await supabaseService.client
            .from('cms_bal_vidya_mandir')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        res.json({ success: true, data: data || null });
    } catch (error) {
        console.error('Error fetching public Bal Vidya content:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// =============================================
// ANNOUNCEMENTS ROUTES
// =============================================

// GET all announcements (Admin)
router.get('/announcements', async (req, res) => {
    try {
        const { data, error } = await supabaseService.client
            .from('cms_announcements')
            .select('*')
            .order('priority', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ success: true, data: data || [] });
    } catch (error) {
        console.error('Error fetching announcements:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST create announcement
router.post('/announcements', requireAuth, async (req, res) => {
    try {
        const { title, body, priority, is_active } = req.body;
        const { data, error } = await supabaseService.client
            .from('cms_announcements')
            .insert({
                title,
                body,
                priority: parseInt(priority) || 0,
                is_active: is_active !== false
            })
            .select('*')
            .single();

        if (error) throw error;
        res.status(201).json({ success: true, data, message: 'Announcement created successfully' });
    } catch (error) {
        console.error('Error creating announcement:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// PUT update announcement
router.put('/announcements/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = {
            ...req.body,
            updated_at: new Date().toISOString()
        };

        const { data, error } = await supabaseService.client
            .from('cms_announcements')
            .update(updateData)
            .eq('id', id)
            .select('*')
            .single();

        if (error) throw error;
        res.json({ success: true, data, message: 'Announcement updated successfully' });
    } catch (error) {
        console.error('Error updating announcement:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// DELETE announcement
router.delete('/announcements/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabaseService.client
            .from('cms_announcements')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ success: true, message: 'Announcement deleted successfully' });
    } catch (error) {
        console.error('Error deleting announcement:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// PUBLIC ENDPOINT: Get active announcements for website
router.get('/public/announcements', async (req, res) => {
    try {
        const { data, error } = await supabaseService.client
            .from('cms_announcements')
            .select('*')
            .eq('is_active', true)
            .order('priority', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ success: true, data: data || [] });
    } catch (error) {
        console.error('Error fetching public announcements:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
