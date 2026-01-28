// Events Routes with Image Upload Support
const express = require('express');
const router = express.Router();
const multer = require('multer');
const supabaseService = require('../services/supabaseService');
const imageUploadService = require('../services/imageUploadService');

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed'));
        }
    }
});

// GET all events
router.get('/', async (req, res) => {
    try {
        const {
            status,
            visibility,
            community_id,
            upcoming = 'false',
            limit = 50
        } = req.query;

        console.log('📅 Fetching events:', { status, visibility, community_id, upcoming, limit });

        let query = supabaseService.client
            .from('community_events')
            .select('*')
            .order('start_date', { ascending: true });

        if (status && status !== 'all') {
            query = query.eq('status', status);
        }
        if (visibility && visibility !== 'all') {
            query = query.eq('visibility', visibility);
        }
        if (community_id && community_id !== 'all') {
            query = query.eq('community_id', community_id);
        }
        if (upcoming === 'true') {
            const now = new Date().toISOString();
            query = query.gte('start_date', now);
        }

        query = query.limit(parseInt(limit));

        const { data, error } = await query;

        if (error) throw error;

        // Map database fields to API format
        const mappedData = (data || []).map(event => ({
            ...event,
            starts_at: event.start_date,
            ends_at: event.end_date,
            capacity: event.max_participants,
            registration_required: false,
            timezone: 'Asia/Kolkata',
            visibility: 'public',
            is_recurring: false
        }));

        res.json({
            success: true,
            data: mappedData,
            count: mappedData.length
        });
    } catch (error) {
        console.error('❌ Error fetching events:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch events',
            error: error.message
        });
    }
});

// GET single event
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabaseService.client
            .from('community_events')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({
                    success: false,
                    message: 'Event not found'
                });
            }
            throw error;
        }

        // Map database fields to API format
        const mappedEvent = {
            ...data,
            starts_at: data.start_date,
            ends_at: data.end_date,
            capacity: data.max_participants,
            registration_required: false,
            timezone: 'Asia/Kolkata',
            visibility: 'public',
            is_recurring: false
        };

        res.json({
            success: true,
            data: mappedEvent
        });
    } catch (error) {
        console.error('❌ Error fetching event:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch event',
            error: error.message
        });
    }
});

// POST create event with optional image
router.post('/', upload.single('image'), async (req, res) => {
    try {
        console.log('📅 Creating event - Full request body:', req.body);
        console.log('📷 Image file:', req.file ? 'Yes' : 'No');

        // Extract fields from request body
        // Note: FormData sends everything as strings, so we need to handle that
        const title = req.body.title;
        const description = req.body.description || '';
        const location = req.body.location || '';
        const starts_at = req.body.starts_at || req.body.startDate;
        const ends_at = req.body.ends_at || req.body.endDate;
        const visibility = req.body.visibility || 'public';
        const status = req.body.status || 'published';
        const capacity = req.body.capacity ? parseInt(req.body.capacity) : null;
        const registration_required = req.body.registration_required === 'true' || req.body.registrationRequired === 'true';
        const community_id = req.body.community_id || req.body.communityId || null;
        const timezone = req.body.timezone || 'Asia/Kolkata';

        console.log('📅 Parsed fields:', { title, starts_at, ends_at, description, location });

        // Validate required fields
        if (!title || !starts_at || !ends_at) {
            console.error('❌ Missing required fields:', { title: !!title, starts_at: !!starts_at, ends_at: !!ends_at });
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: title, starts_at, ends_at',
                received: { title, starts_at, ends_at }
            });
        }

        // Prepare event data for community_events table
        const eventData = {
            title,
            description: description || '',
            location: location || '',
            start_date: starts_at,  // Map to start_date
            end_date: ends_at,      // Map to end_date
            event_type: 'meeting',  // Default event type
            status,
            max_participants: capacity ? parseInt(capacity) : null,  // Map capacity to max_participants
            current_participants: 0,
            community_id: community_id || null,
            organizer_id: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        // Upload image if provided
        if (req.file) {
            try {
                imageUploadService.validateImage(req.file);
                const uploadResult = await imageUploadService.uploadImage(req.file, 'event-images', 'events');
                eventData.image_url = uploadResult.url;
                console.log('✅ Image uploaded:', uploadResult.url);
            } catch (uploadError) {
                console.error('⚠️ Image upload failed:', uploadError.message);
                // Continue without image
            }
        }

        // Insert event into database
        const { data, error } = await supabaseService.client
            .from('community_events')
            .insert([eventData])
            .select()
            .single();

        if (error) {
            console.error('❌ Database error:', error);
            throw error;
        }

        console.log('✅ Event created:', data.id);

        res.status(201).json({
            success: true,
            data,
            message: 'Event created successfully'
        });
    } catch (error) {
        console.error('❌ Error creating event:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create event',
            error: error.message
        });
    }
});

// PUT update event with optional image
router.put('/:id', upload.single('image'), async (req, res) => {
    try {
        const { id } = req.params;
        console.log('📅 Updating event:', id);
        console.log('📷 New image:', req.file ? 'Yes' : 'No');

        // Get existing event
        const { data: existingEvent, error: fetchError } = await supabaseService.client
            .from('events')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !existingEvent) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        // Prepare update data
        const updateData = {
            ...req.body,
            updated_at: new Date().toISOString()
        };

        // Handle image upload if new image provided
        if (req.file) {
            try {
                imageUploadService.validateImage(req.file);

                // Extract old file path from URL if exists
                let oldFilePath = null;
                if (existingEvent.image_url) {
                    const urlParts = existingEvent.image_url.split('/event-images/');
                    if (urlParts.length > 1) {
                        oldFilePath = urlParts[1];
                    }
                }

                // Upload new image (and delete old one)
                const uploadResult = await imageUploadService.updateImage(
                    req.file,
                    oldFilePath,
                    'event-images',
                    'events'
                );

                updateData.image_url = uploadResult.url;
                updateData.thumbnail_url = uploadResult.url;
                console.log('✅ Image updated:', uploadResult.url);
            } catch (uploadError) {
                console.error('⚠️ Image upload failed:', uploadError.message);
            }
        }

        // Update event in database
        const { data, error } = await supabaseService.client
            .from('events')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('❌ Database error:', error);
            throw error;
        }

        console.log('✅ Event updated:', id);

        res.json({
            success: true,
            data,
            message: 'Event updated successfully'
        });
    } catch (error) {
        console.error('❌ Error updating event:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update event',
            error: error.message
        });
    }
});

// DELETE event
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log('🗑️ Deleting event:', id);

        // Get event to delete image
        const { data: event, error: fetchError } = await supabaseService.client
            .from('events')
            .select('image_url')
            .eq('id', id)
            .single();

        if (fetchError || !event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        // Delete image if exists
        if (event.image_url) {
            const urlParts = event.image_url.split('/event-images/');
            if (urlParts.length > 1) {
                const filePath = urlParts[1];
                await imageUploadService.deleteImage(filePath, 'event-images').catch(err => {
                    console.warn('⚠️ Could not delete image:', err.message);
                });
            }
        }

        // Delete event from database
        const { error } = await supabaseService.client
            .from('events')
            .delete()
            .eq('id', id);

        if (error) throw error;

        console.log('✅ Event deleted:', id);

        res.json({
            success: true,
            message: 'Event deleted successfully'
        });
    } catch (error) {
        console.error('❌ Error deleting event:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete event',
            error: error.message
        });
    }
});

module.exports = router;
