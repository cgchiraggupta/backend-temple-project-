// Public Events API - For website integration
const express = require('express');
const router = express.Router();
const supabaseService = require('../services/supabaseService');

// Default religious images for events without custom images
const DEFAULT_EVENT_IMAGES = [
    "https://images.unsplash.com/photo-1609619385002-f40f1df9b7eb?w=800&h=600&fit=crop", // Om
    "https://images.unsplash.com/photo-1548013146-72479768bada?w=800&h=600&fit=crop", // Temple
    "https://images.unsplash.com/photo-1604608672516-f1b9b1a4a0e5?w=800&h=600&fit=crop", // Diya
    "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=800&h=600&fit=crop", // Flowers
    "https://images.unsplash.com/photo-1545389336-cf090694435e?w=800&h=600&fit=crop", // Prayer
    "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&h=600&fit=crop", // Meditation
    "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=800&h=600&fit=crop", // Sunrise
];

// Get default image based on event ID for consistency
function getDefaultImage(eventId, title) {
    const lowerTitle = (title || '').toLowerCase();

    // Category-specific defaults
    if (lowerTitle.includes('puja') || lowerTitle.includes('archana')) {
        return DEFAULT_EVENT_IMAGES[2]; // Diya
    }
    if (lowerTitle.includes('festival') || lowerTitle.includes('navaratri') || lowerTitle.includes('diwali')) {
        return DEFAULT_EVENT_IMAGES[3]; // Flowers
    }
    if (lowerTitle.includes('meditation') || lowerTitle.includes('yoga')) {
        return DEFAULT_EVENT_IMAGES[5]; // Meditation
    }

    // Consistent default based on event ID
    if (eventId) {
        const hash = eventId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return DEFAULT_EVENT_IMAGES[hash % DEFAULT_EVENT_IMAGES.length];
    }

    return DEFAULT_EVENT_IMAGES[0];
}

// GET all public events (no authentication required)
router.get('/', async (req, res) => {
    try {
        const {
            status = 'published',
            limit = 50,
            upcoming = 'true',
            community_id
        } = req.query;

        console.log('📅 Fetching public events:', { status, limit, upcoming, community_id });

        let query = supabaseService.client
            .from('events')
            .select(`
        id,
        title,
        description,
        location,
        starts_at,
        ends_at,
        image_url,
        thumbnail_url,
        status,
        capacity,
        registration_required,
        created_at,
        community_id
      `)
            //.eq('visibility', 'public') // Temporarily disabled for production DB compatibility
            .eq('status', status)
            .order('starts_at', { ascending: true });

        // Filter by community if specified
        if (community_id) {
            query = query.eq('community_id', community_id);
        }

        // Filter upcoming events
        if (upcoming === 'true') {
            const now = new Date().toISOString();
            query = query.gte('starts_at', now);
        }

        // Apply limit
        query = query.limit(parseInt(limit));

        const { data: events, error } = await query;

        if (error) {
            // If error is about missing column, try without status as well or log it specifically
            console.error('❌ Error fetching public events:', error);
            throw error;
        }

        console.log(`✅ Found ${events?.length || 0} public events`);

        // Add default images for events without custom images
        const eventsWithImages = (events || []).map(event => ({
            ...event,
            image_url: event.image_url || getDefaultImage(event.id, event.title),
            thumbnail_url: event.thumbnail_url || event.image_url || getDefaultImage(event.id, event.title)
        }));

        res.json({
            success: true,
            data: eventsWithImages,
            count: eventsWithImages.length
        });
    } catch (error) {
        console.error('❌ Error in public events route:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch events',
            error: error.message
        });
    }
});

// GET single public event by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        console.log('📅 Fetching public event:', id);

        const { data: event, error } = await supabaseService.client
            .from('events')
            .select(`
        id,
        title,
        description,
        location,
        starts_at,
        ends_at,
        image_url,
        thumbnail_url,
        status,
        capacity,
        registration_required,
        created_at,
        community_id
      `)
            .eq('id', id)
            //.eq('visibility', 'public') // Temporarily disabled for production DB compatibility
            .eq('status', 'published')
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({
                    success: false,
                    message: 'Event not found or not public'
                });
            }
            throw error;
        }

        console.log('✅ Found public event:', event.title);

        // Add default image if none exists
        const eventWithImage = {
            ...event,
            image_url: event.image_url || getDefaultImage(event.id, event.title),
            thumbnail_url: event.thumbnail_url || event.image_url || getDefaultImage(event.id, event.title)
        };

        res.json({
            success: true,
            data: eventWithImage
        });
    } catch (error) {
        console.error('❌ Error fetching public event:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch event',
            error: error.message
        });
    }
});

// GET upcoming events count
router.get('/stats/upcoming', async (req, res) => {
    try {
        const now = new Date().toISOString();

        const { count, error } = await supabaseService.client
            .from('events')
            .select('*', { count: 'exact', head: true })
            //.eq('visibility', 'public') // Temporarily disabled for production DB compatibility
            .eq('status', 'published')
            .gte('starts_at', now);

        if (error) throw error;

        res.json({
            success: true,
            data: { upcoming_count: count || 0 }
        });
    } catch (error) {
        console.error('❌ Error fetching event stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch event stats',
            error: error.message
        });
    }
});

module.exports = router;
