// Donations Routes - Dedicated donations table API
const express = require('express');
const router = express.Router();
const supabaseService = require('../services/supabaseService');

// =============================================
// DONATIONS ROUTES
// =============================================

// GET all donations
router.get('/', async (req, res) => {
  try {
    console.log('💰 Fetching donations...');

    const { data, error } = await supabaseService.client
      .from('donations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    console.error('Error fetching donations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch donations',
      error: error.message
    });
  }
});

// GET donation by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('💰 Fetching donation:', id);

    const { data, error } = await supabaseService.client
      .from('donations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error('Error fetching donation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch donation',
      error: error.message
    });
  }
});

// POST create donation
router.post('/', async (req, res) => {
  try {
    console.log('💰 Creating donation:', JSON.stringify(req.body, null, 2));

    // Validate required fields
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid amount is required'
      });
    }

    // Extract donor information from various possible field names
    const donorName = req.body.donor_name || req.body.name || 'Anonymous';
    const donorEmail = req.body.donor_email || req.body.email || 'not-provided@example.com';
    const donorPhone = req.body.donor_phone || req.body.phone || null;
    const purpose = req.body.purpose || req.body.campaign_name || req.body.message || req.body.notes || null;

    // Extract PayPal metadata if present
    const metadata = req.body.metadata || {};
    const currency = metadata.currency || req.body.currency || 'USD';

    // Prepare donation data - map to BOTH old and new column names for compatibility
    const donationData = {
      // Old columns (NOT NULL - must have values)
      name: donorName,
      email: donorEmail,
      phone: donorPhone,
      message: purpose,
      amount: parseFloat(amount),

      // New columns (nullable)
      donor_name: donorName,
      donor_email: donorEmail !== 'not-provided@example.com' ? donorEmail : null,
      donor_phone: donorPhone,
      purpose: purpose,
      notes: req.body.notes || null,

      // Additional fields
      payment_status: req.body.status || 'completed',
      donation_type: req.body.donation_type || 'general',
      // Map payment methods to allowed values: cash, upi, bank_transfer, card, cheque, online
      payment_method: (['cash', 'upi', 'bank_transfer', 'card', 'cheque', 'online'].includes(req.body.payment_method))
        ? req.body.payment_method
        : (req.body.payment_method === 'paypal' ? 'online' : 'cash'),
      currency: currency,
      donation_date: new Date().toISOString().split('T')[0],

      // PayPal specific fields (if present)
      ...(metadata.paypal_order_id && { paypal_order_id: metadata.paypal_order_id }),
      ...(metadata.paypal_capture_id && { transaction_id: metadata.paypal_capture_id }),
      ...(metadata.paypal_payer_id && { paypal_payer_id: metadata.paypal_payer_id }),
      ...(metadata.paypal_payer_email && { paypal_payer_email: metadata.paypal_payer_email }),

      // Timestamps
      updated_at: new Date().toISOString()
    };

    console.log('💰 Prepared donation data:', donationData);

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

    res.status(201).json({
      success: true,
      data: data,
      message: 'Donation created successfully'
    });
  } catch (error) {
    console.error('❌ Error creating donation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create donation',
      error: error.message
    });
  }
});

// PUT update donation
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('💰 Updating donation:', id);

    // Allowlist fields to prevent mass assignment
    const allowedFields = [
      'donor_name', 'donor_email', 'donor_phone', 'amount',
      'donation_type', 'payment_method', 'payment_status',
      'purpose', 'notes', 'donation_date',
      // Legacy columns (for backward compatibility)
      'name', 'email', 'phone', 'message'
    ];
    const safeData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        safeData[field] = req.body[field];
      }
    }
    // Parse amount if provided
    if (safeData.amount !== undefined) {
      safeData.amount = parseFloat(safeData.amount);
    }
    safeData.updated_at = new Date().toISOString();

    const { data, error } = await supabaseService.client
      .from('donations')
      .update(safeData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data: data,
      message: 'Donation updated successfully'
    });
  } catch (error) {
    console.error('Error updating donation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update donation',
      error: error.message
    });
  }
});

// DELETE donation
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('💰 Deleting donation:', id);

    const { data, error } = await supabaseService.client
      .from('donations')
      .delete()
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Donation deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting donation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete donation',
      error: error.message
    });
  }
});

// =============================================
// DONATION CATEGORIES ROUTES
// =============================================

// GET all donation categories
router.get('/categories/all', async (req, res) => {
  try {
    console.log('📁 Fetching donation categories...');

    const { data, error } = await supabaseService.client
      .from('donation_categories')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    console.error('Error fetching donation categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch donation categories',
      error: error.message
    });
  }
});

// POST create donation category
router.post('/categories', async (req, res) => {
  try {
    console.log('📁 Creating donation category:', req.body);

    const { data, error } = await supabaseService.client
      .from('donation_categories')
      .insert(req.body)
      .select('*')
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data: data,
      message: 'Donation category created successfully'
    });
  } catch (error) {
    console.error('Error creating donation category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create donation category',
      error: error.message
    });
  }
});

// =============================================
// REPORTS ROUTES
// =============================================

// GET donations summary
router.get('/reports/summary', async (req, res) => {
  try {
    console.log('📊 Fetching donations summary...');

    // Get all donations (no status field, all are considered completed)
    const { data: donations, error: donationsError } = await supabaseService.client
      .from('donations')
      .select('amount, created_at');

    if (donationsError) throw donationsError;

    // Calculate summary
    const totalAmount = donations.reduce((sum, d) => sum + parseFloat(d.amount || 0), 0);
    const totalCount = donations.length;
    const averageAmount = totalCount > 0 ? totalAmount / totalCount : 0;

    // Get this month's donations
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const thisMonthDonations = donations.filter(d =>
      d.created_at && d.created_at.startsWith(currentMonth)
    );
    const thisMonthAmount = thisMonthDonations.reduce((sum, d) => sum + parseFloat(d.amount || 0), 0);

    // Group by month for trends
    const monthlyData = donations.reduce((acc, d) => {
      const date = new Date(d.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!acc[monthKey]) {
        acc[monthKey] = { amount: 0, count: 0 };
      }
      acc[monthKey].amount += parseFloat(d.amount || 0);
      acc[monthKey].count += 1;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        totalAmount,
        totalCount,
        averageAmount,
        thisMonthAmount,
        thisMonthCount: thisMonthDonations.length,
        statusCounts: {
          completed: totalCount,
          pending: 0,
          failed: 0
        },
        monthlyData: Object.entries(monthlyData).map(([month, data]) => ({
          month,
          ...data
        })).sort((a, b) => a.month.localeCompare(b.month))
      }
    });
  } catch (error) {
    console.error('Error fetching donations summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch donations summary',
      error: error.message
    });
  }
});

// GET daily donations
router.get('/reports/daily', async (req, res) => {
  try {
    console.log('📅 Fetching daily donations...');

    const { data, error } = await supabaseService.client
      .from('daily_donations_summary')
      .select('*')
      .order('donation_date', { ascending: false })
      .limit(30);

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    console.error('Error fetching daily donations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch daily donations',
      error: error.message
    });
  }
});

// GET monthly donations
router.get('/reports/monthly', async (req, res) => {
  try {
    console.log('📅 Fetching monthly donations...');

    const { data, error } = await supabaseService.client
      .from('monthly_donations_summary')
      .select('*')
      .order('month', { ascending: false })
      .limit(12);

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    console.error('Error fetching monthly donations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch monthly donations',
      error: error.message
    });
  }
});

// GET top donors
router.get('/reports/top-donors', async (req, res) => {
  try {
    console.log('🏆 Fetching top donors...');

    const { data, error } = await supabaseService.client
      .from('top_donors')
      .select('*')
      .limit(10);

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    console.error('Error fetching top donors:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch top donors',
      error: error.message
    });
  }
});

// =============================================
// HELPER FUNCTIONS
// =============================================

async function updateCategoryCollectedAmount(donationType) {
  try {
    // Map donation types to category names
    const typeToCategory = {
      'general': 'General Donations',
      'temple_construction': 'Temple Construction',
      'festival': 'Festival Celebrations',
      'puja_sponsorship': 'Puja Sponsorship',
      'annadanam': 'Annadanam',
      'education': 'Education Fund',
      'medical': 'Medical Aid',
      'other': 'General Donations'
    };

    const categoryName = typeToCategory[donationType];
    if (!categoryName) return;

    // Calculate total collected for this type
    // Note: payment_status might not exist in all tables, so we handle both cases
    let query = supabaseService.client
      .from('donations')
      .select('amount')
      .eq('donation_type', donationType);

    // Try to filter by payment_status if column exists
    try {
      query = query.eq('payment_status', 'completed');
    } catch (e) {
      // If payment_status column doesn't exist, just get all donations
      console.log('payment_status column not found, using all donations');
    }

    const { data: donations } = await query;

    const totalCollected = donations?.reduce((sum, d) => sum + parseFloat(d.amount), 0) || 0;

    // Update category
    await supabaseService.client
      .from('donation_categories')
      .update({ collected_amount: totalCollected })
      .eq('name', categoryName);

  } catch (error) {
    console.error('Error updating category collected amount:', error);
  }
}

module.exports = router;