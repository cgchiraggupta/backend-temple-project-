// controllers/communityApplicationsController.js
const CommunityApplication = require('../models/CommunityApplication');
const CommunityMember = require('../models/CommunityMember');
const Community = require('../models/Community');
const User = require('../models/User');

// Get all applications for a community
exports.getApplications = async (req, res) => {
  try {
    const { id: communityId } = req.params;
    const { status = 'pending' } = req.query;

    const query = { community_id: communityId };
    if (status !== 'all') {
      query.status = status;
    }

    const applications = await CommunityApplication.find(query)
      .populate('user_id', 'full_name email avatar_url phone')
      .populate('reviewed_by', 'full_name')
      .sort({ applied_at: -1 });

    res.json({
      success: true,
      data: applications,
      total: applications.length
    });
  } catch (error) {
    console.error('Error fetching applications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch applications',
      error: error.message
    });
  }
};

// Submit application
exports.submitApplication = async (req, res) => {
  try {
    const { id: communityId } = req.params;
    const { name, email, phone, message, why_join, additional_message, skills, experience, user_id } = req.body;

    // Check if already applied
    const existing = await CommunityApplication.findOne({
      community_id: communityId,
      user_id: user_id || null,
      email: email
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'You have already applied to this community'
      });
    }

    const application = new CommunityApplication({
      community_id: communityId,
      user_id: user_id || null,
      name,
      email,
      phone,
      message: message || additional_message, // Support both field names
      why_join,
      skills: skills || [],
      experience
    });

    await application.save();

    res.status(201).json({
      success: true,
      data: application,
      message: 'Application submitted successfully'
    });
  } catch (error) {
    console.error('Error submitting application:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit application',
      error: error.message
    });
  }
};

// Approve application
exports.approveApplication = async (req, res) => {
  try {
    const { id: communityId, applicationId } = req.params;
    const { role = 'member', review_notes } = req.body;

    const application = await CommunityApplication.findById(applicationId);

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Update application status
    application.status = 'approved';
    application.reviewed_by = req.user?.id; // From auth middleware
    application.reviewed_at = new Date();
    application.review_notes = review_notes;
    await application.save();

    // Create member
    const member = new CommunityMember({
      community_id: communityId,
      user_id: application.user_id,
      role,
      joined_at: new Date()
    });

    await member.save();

    // Update community member count
    await Community.findByIdAndUpdate(communityId, {
      $inc: { member_count: 1 }
    });

    // TODO: Send welcome email

    res.json({
      success: true,
      data: { application, member },
      message: 'Application approved and member added'
    });
  } catch (error) {
    console.error('Error approving application:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve application',
      error: error.message
    });
  }
};

// Reject application
exports.rejectApplication = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { review_notes } = req.body;

    const application = await CommunityApplication.findByIdAndUpdate(
      applicationId,
      {
        status: 'rejected',
        reviewed_by: req.user?.id,
        reviewed_at: new Date(),
        review_notes
      },
      { new: true }
    );

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // TODO: Send rejection email

    res.json({
      success: true,
      data: application,
      message: 'Application rejected'
    });
  } catch (error) {
    console.error('Error rejecting application:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject application',
      error: error.message
    });
  }
};
