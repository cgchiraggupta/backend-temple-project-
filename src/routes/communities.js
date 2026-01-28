// routes/communities.js - COMPLETE WORKING VERSION
const express = require('express');
const router = express.Router();
const Community = require('../models/Community');
const HybridCommunityService = require('../services/hybridCommunityService');
const supabaseService = require('../services/supabaseService');
const mongoose = require('mongoose');

// GET all communities
router.get('/', async (req, res) => {
  try {
    const { status, search, owner_id, page = 1, limit = 50 } = req.query;

    console.log('📋 Fetching communities with filters:', { status, search, owner_id, limit });

    // Use hybrid service to get communities from Supabase + memory
    const communities = await HybridCommunityService.getAllCommunities({
      status,
      search,
      owner_id,
      limit: parseInt(limit)
    });

    const total = communities.length;
    const pages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      data: communities,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages
      }
    });
  } catch (error) {
    console.error('Error fetching communities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch communities',
      error: error.message
    });
  }
});

// GET single community
router.get('/:id', async (req, res) => {
  try {
    console.log('🔍 Fetching community by ID:', req.params.id);

    const community = await HybridCommunityService.getCommunityById(req.params.id);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found'
      });
    }

    res.json({
      success: true,
      data: community
    });
  } catch (error) {
    console.error('Error fetching community:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch community',
      error: error.message
    });
  }
});

// POST create community
router.post('/', async (req, res) => {
  try {
    console.log('📥 Creating community:', req.body);

    const { name, description, owner_id, logo_url, status, slug } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Community name is required'
      });
    }

    // ✅ Use provided owner_id or generate UUID
    let ownerId = owner_id;
    if (!ownerId || !ownerId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      const { randomUUID } = require('crypto');
      ownerId = randomUUID();
      console.log('⚠️ No valid owner_id provided, using temporary:', ownerId);
    }

    // Generate slug if not provided
    const communitySlug = slug || name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    // Create community using hybrid service (saves to Supabase + memory)
    const community = await HybridCommunityService.createCommunity({
      name,
      slug: communitySlug,
      description: description || '',
      owner_id: ownerId,
      logo_url: logo_url || '/placeholder.svg',
      status: status || 'active'
    });

    console.log('✅ Community created:', community.id);

    res.status(201).json({
      success: true,
      data: community,
      message: 'Community created successfully'
    });
  } catch (error) {
    console.error('❌ Error creating community:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create community',
      error: error.message
    });
  }
});

// PUT update community
router.put('/:id', async (req, res) => {
  try {
    console.log('📝 Updating community:', req.params.id, req.body);

    const { name, description, logo_url, status, owner_id } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (logo_url !== undefined) updateData.logo_url = logo_url;
    if (status) updateData.status = status;
    if (owner_id) {
      updateData.owner_id = owner_id;
      console.log('🔄 Transferring ownership to:', owner_id);
    }

    // Use hybrid service to update in Supabase + memory
    const community = await HybridCommunityService.updateCommunity(req.params.id, updateData);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found'
      });
    }

    res.json({
      success: true,
      data: community,
      message: owner_id ? 'Community ownership transferred successfully' : 'Community updated successfully'
    });
  } catch (error) {
    console.error('Error updating community:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update community',
      error: error.message
    });
  }
});

// DELETE community permanently
router.delete('/:id', async (req, res) => {
  try {
    console.log('🗑️ Permanently deleting community:', req.params.id);

    // Use hybrid service to delete from Supabase + memory
    const community = await HybridCommunityService.deleteCommunity(req.params.id);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found'
      });
    }

    res.json({
      success: true,
      data: community,
      message: 'Community deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting community:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete community',
      error: error.message
    });
  }
});

// GET community stats
router.get('/:id/stats', async (req, res) => {
  try {
    console.log('📊 Fetching community stats:', req.params.id);

    const stats = await HybridCommunityService.getCommunityStats(req.params.id);

    if (!stats) {
      return res.status(404).json({
        success: false,
        message: 'Community not found'
      });
    }

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stats',
      error: error.message
    });
  }
});

// ============================================
// MEMBER MANAGEMENT ROUTES
// ============================================

const {
  getCommunityMembers,
  addMember,
  updateMember,
  updateMemberRole,
  removeMember
} = require('../controllers/community/memberController');

console.log('🔧 communities.js: Registering member routes');

router.get('/:id/members', getCommunityMembers);
router.post('/:id/members', addMember);
router.put('/:id/members/:memberId', updateMember);
router.delete('/:id/members/:memberId', removeMember);

// GET community finances
router.get('/:id/finances', async (req, res) => {
  try {
    const communityId = req.params.id;
    console.log('💰 Fetching finances for community:', communityId);

    // Fetch donations for this community
    let totalDonations = 0;
    let donationCount = 0;
    try {
      const { data: donations, error } = await supabaseService.client
        .from('donations')
        .select('amount')
        .eq('community_id', communityId);

      if (!error && donations) {
        donationCount = donations.length;
        totalDonations = donations.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
      }
    } catch (err) {
      console.log('⚠️ Could not fetch donations:', err.message);
    }

    // Fetch expenses for this community
    let totalExpenses = 0;
    let expenseCount = 0;
    try {
      const { data: expenses, error } = await supabaseService.client
        .from('expenses')
        .select('amount')
        .eq('community_id', communityId);

      if (!error && expenses) {
        expenseCount = expenses.length;
        totalExpenses = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
      }
    } catch (err) {
      console.log('⚠️ Could not fetch expenses:', err.message);
    }

    res.json({
      success: true,
      data: {
        total_donations: totalDonations,
        donation_count: donationCount,
        total_expenses: totalExpenses,
        expense_count: expenseCount,
        net_balance: totalDonations - totalExpenses
      }
    });
  } catch (error) {
    console.error('Error fetching finances:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch finances',
      error: error.message
    });
  }
});

// GET community leads
router.get('/:id/leads', async (req, res) => {
  try {
    const communityId = req.params.id;
    console.log('👥 Fetching leads for community:', communityId);

    const { data, error } = await supabaseService.client
      .from('community_members')
      .select('*, user:user_id(id, full_name, email, avatar_url)')
      .eq('community_id', communityId)
      .eq('is_lead', true);

    if (error) {
      console.error('Error fetching leads:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch leads',
        error: error.message
      });
    }

    // Map the data to include user info at top level
    const leads = (data || []).map(lead => ({
      ...lead,
      full_name: lead.user?.full_name || lead.full_name || lead.name,
      email: lead.user?.email || lead.email,
      avatar_url: lead.user?.avatar_url || lead.avatar_url
    }));

    console.log('✅ Found leads:', leads.length);

    res.json({
      success: true,
      data: leads
    });
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leads',
      error: error.message
    });
  }
});

console.log('✅ communities.js: Member routes registered');

module.exports = router;
