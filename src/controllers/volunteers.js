// Volunteers Controller - MongoDB
const Volunteer = require('../models/Volunteer');
const { body, validationResult } = require('express-validator');

// Get all volunteers with filtering and pagination
const getVolunteers = async (req, res) => {
  try {
    const {
      community_id,
      skills,
      status,
      page = 1,
      limit = 50
    } = req.query;

    const query = {};

    if (community_id && community_id !== 'all') {
      query.community_id = community_id;
    }

    // Support both 'status' field and legacy 'background_check_status'
    if (status && status !== 'all') {
      query.$or = [
        { status: status },
        { background_check_status: status }
      ];
    }

    if (skills && skills !== 'all') {
      query.skills = { $in: Array.isArray(skills) ? skills : [skills] };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const volunteers = await Volunteer.find(query)
      .populate('user_id', 'full_name email phone avatar_url')
      .populate('community_id', 'name')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Transform volunteers to include direct fields or user fields
    const transformedVolunteers = volunteers.map(v => {
      const volunteer = v.toObject();
      // Use direct fields if available, otherwise use user fields
      if (!volunteer.first_name && volunteer.user_id) {
        const nameParts = (volunteer.user_id.full_name || '').split(' ');
        volunteer.first_name = nameParts[0] || '';
        volunteer.last_name = nameParts.slice(1).join(' ') || '';
        volunteer.email = volunteer.user_id.email;
        volunteer.phone = volunteer.user_id.phone;
      }
      // Map _id to id for frontend compatibility
      volunteer.id = volunteer._id;
      return volunteer;
    });

    const total = await Volunteer.countDocuments(query);

    console.log(`📊 Returning ${transformedVolunteers.length} volunteers`);

    res.json({
      success: true,
      data: transformedVolunteers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching volunteers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch volunteers'
    });
  }
};

// Get volunteer by ID
const getVolunteerById = async (req, res) => {
  try {
    const { id } = req.params;

    const volunteer = await Volunteer.findById(id)
      .populate('user_id', 'full_name email phone avatar_url')
      .populate('community_id', 'name');

    if (!volunteer) {
      return res.status(404).json({
        success: false,
        message: 'Volunteer not found'
      });
    }

    res.json({
      success: true,
      data: volunteer
    });
  } catch (error) {
    console.error('Error fetching volunteer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch volunteer'
    });
  }
};

// Create new volunteer profile
const createVolunteer = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    console.log('📝 Creating volunteer with data:', req.body);

    const volunteerData = {
      ...req.body,
      status: req.body.status || 'active',
      background_check_status: 'pending',
      onboarding_completed: false,
      total_hours_volunteered: 0,
      rating: 0
    };

    const volunteer = new Volunteer(volunteerData);
    await volunteer.save();

    console.log('✅ Volunteer created:', volunteer._id);

    // Populate if user_id exists
    if (volunteer.user_id) {
      await volunteer.populate('user_id', 'full_name email phone avatar_url');
    }
    if (volunteer.community_id) {
      await volunteer.populate('community_id', 'name');
    }

    res.status(201).json({
      success: true,
      message: 'Volunteer profile created successfully',
      data: volunteer
    });
  } catch (error) {
    console.error('Error creating volunteer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create volunteer profile',
      error: error.message
    });
  }
};

// Update volunteer profile
const updateVolunteer = async (req, res) => {
  try {
    const { id } = req.params;

    const volunteer = await Volunteer.findByIdAndUpdate(
      id,
      {
        ...req.body,
        updated_at: new Date()
      },
      { new: true, runValidators: true }
    ).populate('user_id', 'full_name email phone avatar_url')
      .populate('community_id', 'name');

    if (!volunteer) {
      return res.status(404).json({
        success: false,
        message: 'Volunteer not found'
      });
    }

    res.json({
      success: true,
      message: 'Volunteer profile updated successfully',
      data: volunteer
    });
  } catch (error) {
    console.error('Error updating volunteer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update volunteer profile'
    });
  }
};

// Approve volunteer background check
const approveVolunteer = async (req, res) => {
  try {
    const { id } = req.params;

    const volunteer = await Volunteer.findByIdAndUpdate(
      id,
      {
        background_check_status: 'approved',
        updated_at: new Date()
      },
      { new: true, runValidators: true }
    ).populate('user_id', 'full_name email phone avatar_url')
      .populate('community_id', 'name');

    if (!volunteer) {
      return res.status(404).json({
        success: false,
        message: 'Volunteer not found'
      });
    }

    res.json({
      success: true,
      message: 'Volunteer approved successfully',
      data: volunteer
    });
  } catch (error) {
    console.error('Error approving volunteer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve volunteer'
    });
  }
};

// Reject volunteer background check
const rejectVolunteer = async (req, res) => {
  try {
    const { id } = req.params;

    const volunteer = await Volunteer.findByIdAndUpdate(
      id,
      {
        background_check_status: 'rejected',
        updated_at: new Date()
      },
      { new: true, runValidators: true }
    ).populate('user_id', 'full_name email phone avatar_url')
      .populate('community_id', 'name');

    if (!volunteer) {
      return res.status(404).json({
        success: false,
        message: 'Volunteer not found'
      });
    }

    res.json({
      success: true,
      message: 'Volunteer rejected',
      data: volunteer
    });
  } catch (error) {
    console.error('Error rejecting volunteer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject volunteer'
    });
  }
};

// Update volunteer hours
const updateVolunteerHours = async (req, res) => {
  try {
    const { id } = req.params;
    const { hours } = req.body;

    if (typeof hours !== 'number' || hours < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid hours value is required'
      });
    }

    const volunteer = await Volunteer.findByIdAndUpdate(
      id,
      {
        $inc: { total_hours_volunteered: hours },
        updated_at: new Date()
      },
      { new: true, runValidators: true }
    ).populate('user_id', 'full_name email phone avatar_url')
      .populate('community_id', 'name');

    if (!volunteer) {
      return res.status(404).json({
        success: false,
        message: 'Volunteer not found'
      });
    }

    res.json({
      success: true,
      message: 'Volunteer hours updated successfully',
      data: volunteer
    });
  } catch (error) {
    console.error('Error updating volunteer hours:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update volunteer hours'
    });
  }
};

// Delete volunteer
const deleteVolunteer = async (req, res) => {
  try {
    const { id } = req.params;

    const volunteer = await Volunteer.findByIdAndDelete(id);

    if (!volunteer) {
      return res.status(404).json({
        success: false,
        message: 'Volunteer not found'
      });
    }

    res.json({
      success: true,
      message: 'Volunteer deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting volunteer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete volunteer'
    });
  }
};

// Get volunteer statistics
const getVolunteerStats = async (req, res) => {
  try {
    const { community_id } = req.query;

    const matchStage = {};

    if (community_id) {
      matchStage.community_id = mongoose.Types.ObjectId(community_id);
    }

    const stats = await Volunteer.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalVolunteers: { $sum: 1 },
          approvedVolunteers: {
            $sum: { $cond: [{ $eq: ['$background_check_status', 'approved'] }, 1, 0] }
          },
          pendingVolunteers: {
            $sum: { $cond: [{ $eq: ['$background_check_status', 'pending'] }, 1, 0] }
          },
          rejectedVolunteers: {
            $sum: { $cond: [{ $eq: ['$background_check_status', 'rejected'] }, 1, 0] }
          },
          onboardedVolunteers: {
            $sum: { $cond: ['$onboarding_completed', 1, 0] }
          },
          totalHours: { $sum: '$total_hours_volunteered' },
          avgHours: { $avg: '$total_hours_volunteered' },
          avgRating: { $avg: '$rating' }
        }
      }
    ]);

    res.json({
      success: true,
      data: stats[0] || {
        totalVolunteers: 0,
        approvedVolunteers: 0,
        pendingVolunteers: 0,
        rejectedVolunteers: 0,
        onboardedVolunteers: 0,
        totalHours: 0,
        avgHours: 0,
        avgRating: 0
      }
    });
  } catch (error) {
    console.error('Error fetching volunteer stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch volunteer statistics'
    });
  }
};

module.exports = {
  getVolunteers,
  getVolunteerById,
  createVolunteer,
  updateVolunteer,
  approveVolunteer,
  rejectVolunteer,
  updateVolunteerHours,
  deleteVolunteer,
  getVolunteerStats
};
