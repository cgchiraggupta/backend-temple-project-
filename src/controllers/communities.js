// Communities Controller - MongoDB
const Community = require('../models/Community');
const { body, validationResult } = require('express-validator');

// Get all communities with filtering and pagination
const getCommunities = async (req, res) => {
  try {
    const {
      status,
      search,
      owner_id,
      page = 1,
      limit = 50
    } = req.query;

    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (owner_id && owner_id !== 'all') {
      query.owner_id = owner_id;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const communities = await Community.find(query)
      .populate('owner_id', 'full_name email')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Community.countDocuments(query);

    res.json({
      success: true,
      data: communities,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching communities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch communities'
    });
  }
};

// Get community by ID
const getCommunityById = async (req, res) => {
  try {
    const { id } = req.params;

    const community = await Community.findById(id)
      .populate('owner_id', 'full_name email');

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
      message: 'Failed to fetch community'
    });
  }
};

// Create new community
const createCommunity = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const communityData = {
      ...req.body,
      owner_id: req.user?.id || req.body.owner_id,
      slug: req.body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    };

    const community = new Community(communityData);
    await community.save();

    // Populate the created community
    await community.populate('owner_id', 'full_name email');

    res.status(201).json({
      success: true,
      message: 'Community created successfully',
      data: community
    });
  } catch (error) {
    console.error('Error creating community:', error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Community slug already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create community'
    });
  }
};

// Update community
const updateCommunity = async (req, res) => {
  try {
    const { id } = req.params;

    const community = await Community.findByIdAndUpdate(
      id,
      {
        ...req.body,
        updated_at: new Date()
      },
      { new: true, runValidators: true }
    ).populate('owner_id', 'full_name email');

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found'
      });
    }

    res.json({
      success: true,
      message: 'Community updated successfully',
      data: community
    });
  } catch (error) {
    console.error('Error updating community:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update community'
    });
  }
};

// Delete community
const deleteCommunity = async (req, res) => {
  try {
    const { id } = req.params;

    const community = await Community.findByIdAndDelete(id);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found'
      });
    }

    res.json({
      success: true,
      message: 'Community deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting community:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete community'
    });
  }
};

// Get community statistics
const getCommunityStats = async (req, res) => {
  try {
    const { id } = req.params;

    // Get basic community info
    const community = await Community.findById(id);
    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found'
      });
    }

    // Get aggregated statistics
    const stats = await Promise.all([
      // Total donations
      require('../models/Donation').countDocuments({ community_id: id }),

      // Total expenses
      require('../models/Expense').countDocuments({ community_id: id }),

      // Total events
      require('../models/Event').countDocuments({ community_id: id }),

      // Total volunteers
      require('../models/Volunteer').countDocuments({ community_id: id }),

      // Active members count (users who are members of this community)
      require('../models/User').countDocuments({ communities: id })
    ]);

    res.json({
      success: true,
      data: {
        community: {
          id: community._id,
          name: community.name,
          status: community.status
        },
        statistics: {
          totalDonations: stats[0],
          totalExpenses: stats[1],
          totalEvents: stats[2],
          totalVolunteers: stats[3],
          activeMembers: stats[4]
        }
      }
    });
  } catch (error) {
    console.error('Error fetching community stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch community statistics'
    });
  }
};

module.exports = {
  getCommunities,
  getCommunityById,
  createCommunity,
  updateCommunity,
  deleteCommunity,
  getCommunityStats
};
