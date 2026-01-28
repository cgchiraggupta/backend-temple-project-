const memberService = require('../../services/community/memberService');
const ApiResponse = require('../../utils/response');

const addMember = async (req, res, next) => {
  try {
    const { user_id, role, name, email, phone, full_name, why_join, skills, experience } = req.body;
    console.log('🔍 addMember received:', { user_id, role, name, email, phone, full_name, why_join, skills, experience });
    const memberInfo = {
      name: name || full_name,
      email,
      phone,
      why_join,
      skills,
      experience
    };
    console.log('📦 memberInfo:', memberInfo);
    const member = await memberService.addMember(
      req.params.id,
      user_id,
      role || 'member',
      req.user?.id || 'system',
      memberInfo
    );
    console.log('✅ Member created:', member);
    return ApiResponse.success(res, member, 'Member added successfully', 201);
  } catch (error) {
    next(error);
  }
};

const removeMember = async (req, res, next) => {
  try {
    // Support both userId (old) and memberId (new) parameters
    const memberId = req.params.memberId || req.params.userId;
    await memberService.removeMember(req.params.id, memberId, req.user?.id || 'system');
    return ApiResponse.success(res, null, 'Member removed successfully');
  } catch (error) {
    next(error);
  }
};

const updateMemberRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    // Support both userId (old) and memberId (new) parameters
    const memberId = req.params.memberId || req.params.userId;
    const member = await memberService.updateMemberRole(req.params.id, memberId, role, req.user?.id || 'system');
    return ApiResponse.success(res, member, 'Member role updated successfully');
  } catch (error) {
    next(error);
  }
};

const updateMember = async (req, res, next) => {
  try {
    const { full_name, email, phone, role, status } = req.body;
    // Support both userId (old) and memberId (new) parameters
    const memberId = req.params.memberId || req.params.userId;
    const member = await memberService.updateMember(
      req.params.id,
      memberId,
      { full_name, email, phone, role, status },
      req.user?.id || 'system'
    );
    return ApiResponse.success(res, member, 'Member updated successfully');
  } catch (error) {
    next(error);
  }
};

const updateMemberStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    // Support both userId (old) and memberId (new) parameters
    const memberId = req.params.memberId || req.params.userId;
    const member = await memberService.updateMemberStatus(req.params.id, memberId, status, req.user?.id || 'system');
    return ApiResponse.success(res, member, 'Member status updated successfully');
  } catch (error) {
    next(error);
  }
};

const getCommunityMembers = async (req, res, next) => {
  try {
    const members = await memberService.getCommunityMembers(req.params.id, req.query);
    return ApiResponse.success(res, members, 'Members retrieved successfully');
  } catch (error) {
    next(error);
  }
};

const getMemberDetails = async (req, res, next) => {
  try {
    const member = await memberService.getMemberDetails(req.params.id, req.params.userId);
    return ApiResponse.success(res, member, 'Member details retrieved successfully');
  } catch (error) {
    next(error);
  }
};

const importMembers = async (req, res, next) => {
  try {
    const { members } = req.body;
    const results = await memberService.importMembers(req.params.id, members, req.user?.id || 'system');
    return ApiResponse.success(res, results, 'Members import completed');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  addMember,
  removeMember,
  updateMember,
  updateMemberRole,
  updateMemberStatus,
  getCommunityMembers,
  getMemberDetails,
  importMembers
};
