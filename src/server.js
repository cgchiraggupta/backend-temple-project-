// Main Server File - Supabase Backend
require('dotenv').config({ path: require('path').join(__dirname, '../.env') }); // Load .env from temple-backend directory
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// Import routes
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');
const communityRoutes = require('./routes/communities');
const communityFeaturesRoutes = require('./routes/communityFeatures');
const applicationRoutes = require('./routes/applications');
const frontendCompatibleRoutes = require('./routes/applications-frontend-compatible');
const reportsRoutes = require('./routes/reports');
const debugRoutes = require('./routes/debug');
const eventsWithUploadRoutes = require('./routes/eventsWithUpload');
const publicEventsRoutes = require('./routes/publicEvents');
const taskRoutes = require('./routes/tasks');
const volunteerRoutes = require('./routes/volunteers-simple');
const broadcastRoutes = require('./routes/broadcasts');
const templateRoutes = require('./routes/templates');
const pujaRoutes = require('./routes/pujas');
const financeRoutes = require('./routes/finance');
const budgetRequestRoutes = require('./routes/budgetRequests');
const budgetsRoutes = require('./routes/budgets');
const communicationRoutes = require('./routes/communications');
const donationsRoutes = require('./routes/donations');
const expensesRoutes = require('./routes/expenses');
const cmsRoutes = require('./routes/cms');
const galleryRoutes = require('./routes/gallery');
const brochuresRoutes = require('./routes/brochures');
const priestsRoutes = require('./routes/priests');
const priestBookingsRoutes = require('./routes/priestBookings');
const mobileRoutes = require('./routes/mobileRoutes');
const paypalRoutes = require('./routes/paypal');

// Import auth middleware
const { requireAuth } = require('./middleware/authMiddleware');
const { checkRole } = require('./middleware/authMiddleware');

// Role-check middlewares for specific route groups
const checkFinanceRole = checkRole(['admin', 'board', 'chair_board', 'chairman', 'finance_team']);
const checkAdminRole = checkRole(['admin']);
const checkReportsRole = checkRole(['admin', 'board', 'chair_board', 'chairman']);

// Import Supabase-backed models
require('./models/User');
require('./models/Community');
require('./models/CommunityMember');
require('./models/CommunityApplication');
require('./models/CommunityTask');
require('./models/CommunityEvent');
require('./models/CommunityPost');
require('./models/CommunityAnnouncement');

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy for Railway/Vercel deployments (required for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(compression());
app.use(morgan('combined'));

// CORS configuration - MUST be before rate limiting to handle preflight requests
const allowedOrigins = [
  // Production
  'https://temple-management-cms.vercel.app',
  'https://temple-management-woad.vercel.app',
  // Development (always allow for local testing against production API)
  'http://localhost:8080',
  'http://localhost:8081',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:4173',
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman in dev)
    if (!origin) {
      return callback(null, true);
    }

    // Allow localhost origins (for development)
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }

    // Check against allowed origins
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }

    // Allow Vercel preview deployments (your app's preview URLs)
    // Covers both temple-management and saisamsthan projects
    if (origin.includes('vercel.app') && (origin.includes('temple-management') || origin.includes('saisamsthan') || origin.includes('saisamsthanusa'))) {
      return callback(null, true);
    }

    console.log('❌ CORS blocked origin:', origin);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Length', 'X-Reques                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         t-Id'],
  maxAge: 86400 // 24 hours
}));

// Handle preflight requests explicitly
app.options('*', cors());

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting - prevent abuse (after CORS)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 500 : 1000, // Higher limits
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS', // Skip preflight requests
});

// Stricter rate limit for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 20 : 100, // Higher for dev
  message: {
    success: false,
    message: 'Too many login attempts, please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS', // Skip preflight requests
});

// Apply rate limiting
app.use('/api', generalLimiter);
app.use('/api/users/login', authLimiter);
app.use('/api/users/register', authLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    database: 'Supabase',
    version: '1.0.0',
    models: {
      community: 'Community',
      members: 'CommunityMember',
      applications: 'CommunityApplication',
      tasks: 'CommunityTask',
      events: 'CommunityEvent'
    }
  });
});

// =============================================
// PUBLIC ROUTES (No authentication required)
// =============================================
const supabaseService = require('./services/supabaseService');

// Make supabaseService available to all routes via app.get('supabaseService')
app.set('supabaseService', supabaseService);

app.use('/api/users', userRoutes); // Has its own auth for protected routes
app.use('/api/public/events', publicEventsRoutes); // Public events for website

// PUBLIC: Community events for website (fetches from community_events table)
app.get('/api/public/community-events', async (req, res) => {
  try {
    const { upcoming = 'false', limit = 50 } = req.query;
    console.log('📅 [Public] Fetching public community events');

    let query = supabaseService.client
      .from('community_events')
      .select('*')
      .eq('status', 'published')
      .order('start_date', { ascending: true });

    // Filter upcoming events
    if (upcoming === 'true') {
      const now = new Date().toISOString();
      query = query.gte('start_date', now);
    }

    query = query.limit(parseInt(limit));

    const { data: events, error } = await query;

    if (error) {
      console.error('❌ Error fetching public community events:', error);
      throw error;
    }

    console.log(`✅ Found ${events?.length || 0} public community events`);

    res.json({
      success: true,
      data: events || [],
      count: events?.length || 0
    });
  } catch (error) {
    console.error('❌ Error in public community events route:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch events',
      error: error.message
    });
  }
});

// Public communities endpoint for mobile app browsing (apply screen)
app.get('/api/public/communities', async (req, res) => {
  try {
    const { search, limit = 50, page = 1 } = req.query;
    console.log('📱 [Public] Fetching public communities');

    let query = supabaseService.client
      .from('communities')
      .select('*')
      .eq('status', 'active')
      .order('name', { ascending: true });

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    query = query.range(offset, offset + parseInt(limit) - 1);

    const { data: communities, error } = await query;

    if (error) {
      console.error('❌ Error fetching communities:', error);
      throw error;
    }

    console.log(`✅ Found ${communities?.length || 0} public communities`);

    res.json({
      success: true,
      data: communities || [],
      total: communities?.length || 0,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('❌ Error fetching public communities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch communities',
      error: error.message
    });
  }
});

// PUBLIC: Community application (no auth required)
app.post('/api/public/communities/:communityId/apply', async (req, res) => {
  try {
    const { communityId } = req.params;
    const { name, email, phone, why_join, additional_message, experience } = req.body;

    console.log('📱 [Public] Community application received:', { communityId, email });

    // Validate required fields
    if (!email || !name) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: email, name'
      });
    }

    // Check if already has a pending application
    const { data: existingApp } = await supabaseService.client
      .from('community_applications')
      .select('id, status')
      .eq('community_id', communityId)
      .eq('email', email.toLowerCase())
      .eq('status', 'pending')
      .maybeSingle();

    if (existingApp) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending application for this community'
      });
    }

    // Check if already a community member
    const { data: existingMember } = await supabaseService.client
      .from('community_members')
      .select('id')
      .eq('community_id', communityId)
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (existingMember) {
      return res.status(400).json({
        success: false,
        message: 'You are already a member of this community'
      });
    }


    const applicationData = {
      community_id: communityId,
      name,
      email: email.toLowerCase(),
      phone: phone || null,
      why_join: why_join || null,
      message: additional_message || null,
      experience: experience || null,
      status: 'pending',
      applied_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabaseService.client
      .from('community_applications')
      .insert(applicationData)
      .select('*')
      .single();

    if (error) {
      console.error('❌ Error submitting community application:', error);
      throw error;
    }

    console.log('✅ Community application submitted:', data.id);

    res.status(201).json({
      success: true,
      data,
      message: 'Application submitted successfully'
    });
  } catch (error) {
    console.error('❌ Error in public community apply:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit application',
      error: error.message
    });
  }
});

// PUBLIC: Volunteer application (no auth required)
app.post('/api/public/volunteers/apply', async (req, res) => {
  try {
    const { first_name, last_name, email, phone, skills, interests, motivation, experience } = req.body;

    console.log('📱 [Public] Volunteer application received:', { email });

    // Validate required fields
    if (!first_name || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: first_name, email, phone'
      });
    }

    // Check if already has a pending application
    const { data: existingApp } = await supabaseService.client
      .from('volunteer_applications')
      .select('id, status')
      .eq('email', email.toLowerCase())
      .eq('status', 'pending')
      .maybeSingle();

    if (existingApp) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending volunteer application'
      });
    }

    // Check if already an active volunteer
    const { data: existingVolunteer } = await supabaseService.client
      .from('volunteers')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (existingVolunteer) {
      return res.status(400).json({
        success: false,
        message: 'You are already a registered volunteer'
      });
    }


    const applicationData = {
      first_name,
      last_name: last_name || '',
      email: email.toLowerCase(),
      phone,
      skills: Array.isArray(skills) ? skills : [],
      interests: Array.isArray(interests) ? interests : [],
      motivation: motivation || '',
      experience: experience || '',
      status: 'pending',
      applied_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabaseService.client
      .from('volunteer_applications')
      .insert(applicationData)
      .select('*')
      .single();

    if (error) {
      console.error('❌ Error submitting volunteer application:', error);
      throw error;
    }

    console.log('✅ Volunteer application submitted:', data.id);

    res.status(201).json({
      success: true,
      data,
      message: 'Volunteer application submitted successfully'
    });
  } catch (error) {
    console.error('❌ Error in public volunteer apply:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit application',
      error: error.message
    });
  }
});

// Public CMS endpoints (for main website to fetch banners, pujas, etc.)
// These routes do NOT require authentication
// app.use('/api/cms/public', cmsRoutes); // All /public/* routes in cmsRoutes
app.post('/api/cms/contact', cmsRoutes); // Contact form submission

// PayPal payment routes (public - handles its own security)
app.use('/api/paypal', paypalRoutes);

// PUBLIC: Create donation from PayPal (no auth required for payment gateway callbacks)
app.post('/api/public/donations', async (req, res) => {
  try {
    console.log('💰 [Public] Creating donation from PayPal:', JSON.stringify(req.body, null, 2));

    const { amount } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount is required' });
    }

    const donorName = req.body.donor_name || req.body.name || 'Anonymous';
    const donorEmail = req.body.donor_email || req.body.email || 'not-provided@example.com';
    const donorPhone = req.body.donor_phone || req.body.phone || null;
    const purpose = req.body.purpose || req.body.campaign_name || req.body.message || null;
    const metadata = req.body.metadata || {};

    // Map paypal to 'online' since DB constraint doesn't allow 'paypal'
    const paymentMethod = req.body.payment_method === 'paypal' ? 'online' : (req.body.payment_method || 'online');

    const donationData = {
      name: donorName,
      email: donorEmail,
      phone: donorPhone,
      message: purpose,
      amount: parseFloat(amount),
      donor_name: donorName,
      donor_email: donorEmail !== 'not-provided@example.com' ? donorEmail : null,
      donor_phone: donorPhone,
      purpose: purpose,
      payment_status: req.body.status || 'completed',
      donation_type: req.body.donation_type || 'general',
      payment_method: paymentMethod,
      currency: metadata.currency || req.body.currency || 'USD',
      donation_date: new Date().toISOString().split('T')[0],
      metadata: metadata,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabaseService.client
      .from('donations')
      .insert(donationData)
      .select('*')
      .single();

    if (error) {
      console.error('❌ Database error:', error);
      throw error;
    }

    console.log('✅ Donation created successfully:', data.id);
    res.status(201).json({ success: true, data, message: 'Donation created successfully' });
  } catch (error) {
    console.error('❌ Error creating donation:', error);
    res.status(500).json({ success: false, message: 'Failed to create donation', error: error.message });
  }
});

// PUBLIC: Gallery images for website (no authentication required)
app.get('/api/cms/public/gallery', async (req, res) => {
  try {
    console.log('🖼️ [Public] Fetching public gallery images');

    const { data: images, error } = await supabaseService.client
      .from('cms_images')
      .select('id, image_url, title, description, created_at')
      .eq('name', 'gallery')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching gallery images:', error);
      throw error;
    }

    // Transform to match frontend expected format
    const formattedImages = (images || []).map(img => ({
      id: img.id,
      image_url: img.image_url,
      title: img.title || 'Gallery Image',
      description: img.description || '',
      category: 'Gallery',
      date: img.created_at
    }));

    console.log(`✅ Found ${formattedImages.length} public gallery images`);

    res.json({
      success: true,
      data: formattedImages
    });
  } catch (error) {
    console.error('❌ Error in public gallery route:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch gallery images',
      error: error.message
    });
  }
});

// CMS, Priests, and Priest Bookings routes - granular auth handled inside route files
// These MUST be placed before generic /api routes to avoid being caught by wildcard routes
app.use('/api/cms', cmsRoutes);
app.use('/api/priests', priestsRoutes);
app.use('/api/priest-bookings', priestBookingsRoutes);


// =============================================
// PROTECTED ROUTES (Authentication required)
// =============================================
app.use('/api/admin', requireAuth, checkAdminRole, adminRoutes);
app.use('/api/communities', requireAuth, communityRoutes); // Basic community CRUD
app.use('/api/communities', requireAuth, communityFeaturesRoutes); // Members, Applications, Tasks
app.use('/api', requireAuth, applicationRoutes); // Standalone application routes
app.use('/api', requireAuth, frontendCompatibleRoutes); // Frontend-compatible routes

// Mobile App API Routes (protected) - MUST come before generic /api routes
app.use('/api/mobile', requireAuth, mobileRoutes);

// Reports routes - admin/board only (role check is applied inside the route handlers)
app.use('/api', requireAuth, reportsRoutes); // Reports and calendar routes

app.use('/api/events', requireAuth, eventsWithUploadRoutes); // Events with image upload
app.use('/api', requireAuth, taskRoutes); // Tasks management routes
app.use('/api/volunteers', requireAuth, volunteerRoutes);
app.use('/api/broadcasts', requireAuth, broadcastRoutes);
app.use('/api/templates', requireAuth, templateRoutes);
app.use('/api/pujas', requireAuth, pujaRoutes);

// Finance routes - restricted to admin, board, finance roles
app.use('/api/finance', requireAuth, checkFinanceRole, financeRoutes);
// Budget requests - allow any authenticated user to submit (approval restricted in route handlers)
app.use('/api/budget-requests', requireAuth, budgetRequestRoutes);
app.use('/api/budgets', requireAuth, checkFinanceRole, budgetsRoutes);
app.use('/api/donations', requireAuth, checkFinanceRole, donationsRoutes);
app.use('/api/expenses', requireAuth, checkFinanceRole, expensesRoutes);

app.use('/api/communications', requireAuth, communicationRoutes);
app.use('/api/cms/gallery', requireAuth, galleryRoutes);
app.use('/api/brochures', requireAuth, brochuresRoutes);

// Debug routes - only in development
if (process.env.NODE_ENV !== 'production') {
  app.use('/api', debugRoutes);
}

// Temporary schema check endpoint (remove in production)
// app.use('/api/debug', require('../check-schema-endpoint'));

// Test route for community features
app.get('/api/test/community-routes', (req, res) => {
  res.json({
    success: true,
    message: 'Community features routes are active',
    availableEndpoints: [
      'GET /api/communities/:id/members',
      'POST /api/communities/:id/members',
      'PUT /api/communities/:id/members/:memberId',
      'DELETE /api/communities/:id/members/:memberId',
      'POST /api/communities/:id/members/email',
      'GET /api/communities/:id/leads',
      'GET /api/communities/:id/applications',
      'POST /api/communities/:id/applications',
      'PUT /api/communities/:id/applications/:applicationId/approve',
      'PUT /api/communities/:id/applications/:applicationId/reject',
      'GET /api/communities/:id/tasks',
      'POST /api/communities/:id/tasks',
      'PUT /api/communities/:id/tasks/:taskId',
      'DELETE /api/communities/:id/tasks/:taskId'
    ]
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ GLOBAL ERROR HANDLER:', err);
  console.error('❌ Error Code:', err.code);
  console.error('❌ Error Message:', err.message);
  console.error('❌ Error Details:', err.details);
  console.error('❌ Error Hint:', err.hint);

  const isDev = process.env.NODE_ENV !== 'production';

  // Supabase database errors - show details only in development
  if (err.code && err.code.startsWith('23')) {
    return res.status(400).json({
      success: false,
      message: 'Database operation failed',
      ...(isDev && {
        error: err.message,
        details: err.details,
        hint: err.hint,
        code: err.code
      })
    });
  }

  // Supabase unique constraint error
  if (err.code === '23505') {
    return res.status(400).json({
      success: false,
      message: 'A record with this information already exists',
      ...(isDev && { error: err.message, details: err.details })
    });
  }

  // Supabase foreign key error
  if (err.code === '23503') {
    return res.status(400).json({
      success: false,
      message: 'Invalid reference to related record',
      ...(isDev && { error: err.message })
    });
  }

  // JWT error
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }

  // JWT expired error
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired'
    });
  }

  // Default error
  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      error: err.message
    })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    requestedUrl: req.originalUrl,
    method: req.method
  });
});

// Start server
const server = app.listen(PORT, async () => {
  console.log('\n🎉 ========================================');
  console.log(`🚀 Temple Steward Backend Server Started!`);
  console.log('==========================================');
  console.log(`📊 Database: Supabase (Hybrid Mode)`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
  console.log(`✅ Health Check: http://localhost:${PORT}/health`);
  console.log(`🧪 Test Routes: http://localhost:${PORT}/api/test/community-routes`);
  console.log('\n📂 Active Models:');
  console.log('   ✓ User (Hybrid: Supabase + Memory)');
  console.log('   ✓ Community (Hybrid: Supabase + Memory)');
  console.log('   ✓ CommunityMember (Supabase)');
  console.log('   ✓ CommunityApplication (Supabase)');
  console.log('   ✓ CommunityTask (Supabase)');
  console.log('   ✓ CommunityEvent (Supabase)');
  console.log('   ✓ CommunityPost (Supabase)');
  console.log('   ✓ CommunityAnnouncement (Supabase)');
  console.log('==========================================\n');

  // Default communities initialization removed

});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n⚠️  SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n⚠️  SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ UNHANDLED REJECTION! Shutting down...');
  console.error(err);
  server.close(() => {
    process.exit(1);
  });
});

module.exports = app;