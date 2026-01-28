// controllers/communityMembersController.js
const CommunityMember = require('../models/CommunityMember');
const CommunityApplication = require('../models/CommunityApplication');
const Community = require('../models/Community');
const User = require('../models/User');
const EmailLog = require('../models/EmailLog');

// Get all members of a community
exports.getCommunityMembers = async (req, res) => {
  try {
    const { id: communityId } = req.params;
    const { role, status = 'active', search } = req.query;

    const query = { community_id: communityId, status };
    if (role && role !== 'all') {
      query.role = role;
    }

    let members = await CommunityMember.find(query)
      .populate('user_id', 'full_name email avatar_url phone')
      .populate('community_id', 'name')
      .sort({ is_lead: -1, joined_at: -1 });

    // Search filter
    if (search) {
      members = members.filter(m =>
        m.user_id?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        m.user_id?.email?.toLowerCase().includes(search.toLowerCase())
      );
    }

    res.json({
      success: true,
      data: members,
      total: members.length
    });
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch members',
      error: error.message
    });
  }
};

// Add member to community
exports.addCommunityMember = async (req, res) => {
  try {
    const { id: communityId } = req.params;
    const { user_id, role = 'member' } = req.body;

    // Check if member already exists
    const existing = await CommunityMember.findOne({
      community_id: communityId,
      user_id
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'User is already a member'
      });
    }

    // Create member
    const member = new CommunityMember({
      community_id: communityId,
      user_id,
      role,
      joined_at: new Date()
    });

    await member.save();

    // Update community member count
    await Community.findByIdAndUpdate(communityId, {
      $inc: { member_count: 1 }
    });

    // Populate user data
    await member.populate('user_id', 'full_name email avatar_url');

    res.status(201).json({
      success: true,
      data: member,
      message: 'Member added successfully'
    });
  } catch (error) {
    console.error('Error adding member:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add member',
      error: error.message
    });
  }
};

// Update member role
exports.updateMemberRole = async (req, res) => {
  try {
    const { id: communityId, memberId } = req.params;
    const { role, is_lead, lead_position } = req.body;

    const updateData = { updated_at: new Date() };
    if (role) updateData.role = role;
    if (is_lead !== undefined) {
      updateData.is_lead = is_lead;
      if (!is_lead) updateData.lead_position = '';
    }
    if (lead_position) updateData.lead_position = lead_position;

    const member = await CommunityMember.findByIdAndUpdate(
      memberId,
      updateData,
      { new: true }
    ).populate('user_id', 'full_name email avatar_url');

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    res.json({
      success: true,
      data: member,
      message: 'Member updated successfully'
    });
  } catch (error) {
    console.error('Error updating member:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update member',
      error: error.message
    });
  }
};

// Remove member
exports.removeCommunityMember = async (req, res) => {
  try {
    const { id: communityId, memberId } = req.params;

    const member = await CommunityMember.findByIdAndDelete(memberId);

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    // Update community member count
    await Community.findByIdAndUpdate(communityId, {
      $inc: { member_count: -1 }
    });

    res.json({
      success: true,
      message: 'Member removed successfully'
    });
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove member',
      error: error.message
    });
  }
};

// Send email to members
exports.sendEmailToMembers = async (req, res) => {
  try {
    const { id: communityId } = req.params;
    const { subject, message, recipient_ids, send_to_all } = req.body;

    let recipients = [];

    if (send_to_all) {
      const members = await CommunityMember.find({
        community_id: communityId,
        status: 'active'
      }).populate('user_id', 'email full_name');

      recipients = members.map(m => ({
        user_id: m.user_id._id,
        email: m.user_id.email,
        status: 'sent'
      }));
    } else {
      const users = await User.find({ _id: { $in: recipient_ids } });
      recipients = users.map(u => ({
        user_id: u._id,
        email: u.email,
        status: 'sent'
      }));
    }

    // Log email (actual sending would use nodemailer/sendgrid)
    const emailLog = new EmailLog({
      community_id: communityId,
      sent_by: req.user.id, // Assuming auth middleware adds user
      recipients,
      subject,
      message,
      email_type: 'custom'
    });

    await emailLog.save();

    // TODO: Integrate actual email service (Nodemailer/SendGrid)

    res.json({
      success: true,
      message: `Email sent to ${recipients.length} members`,
      sent_count: recipients.length
    });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send email',
      error: error.message
    });
  }
};

// Get community leads
exports.getCommunityLeads = async (req, res) => {
  try {
    const { id: communityId } = req.params;

    const leads = await CommunityMember.find({
      community_id: communityId,
      is_lead: true,
      status: 'active'
    })
      .populate('user_id', 'full_name email avatar_url phone')
      .sort({ lead_position: 1 });

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
};
