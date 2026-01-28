// controllers/community/communityController.js
const communityService = require('../../services/community/communityService');
const ApiResponse = require('../../utils/response');

const createCommunity = async (req, res, next) => {
  try {
    console.log('📥 Create Community Request:', {
      body: req.body,
      user: req.user,
      hasAuth: !!req.headers.authorization
    });
    
    // Use the authenticated user's ID, or allow override for super_admin
    const userId = req.user?.id;
    
    if (!userId) {
      return ApiResponse.error(res, 'Authentication required', 401);
    }
    
    const community = await communityService.createCommunity(req.body, userId);
    
    console.log('✅ Community Created Successfully:', community.id);
    
    return ApiResponse.success(res, community, 'Community created successfully', 201);
  } catch (error) {
    console.error('❌ Create Community Error:', {
      message: error.message,
      stack: error.stack
    });
    next(error);
  }
};

const listCommunities = async (req, res, next) => {
  try {
    // ✅ FIX: Handle no user case properly
    const userId = req.user?.id || null;
    const userRoles = req.user?.roles || [];
    
    const result = await communityService.listCommunities(
      req.query,
      userId,
      userRoles
    );
    return ApiResponse.paginated(res, result.communities, result.pagination, 'Communities retrieved successfully');
  } catch (error) {
    next(error);
  }
};

const getCommunity = async (req, res, next) => {
  try {
    const community = await communityService.getCommunityById(req.params.id);
    return ApiResponse.success(res, community, 'Community retrieved successfully');
  } catch (error) {
    next(error);
  }
};

const updateCommunity = async (req, res, next) => {
  try {
    const userId = req.user?.id || null;
    const community = await communityService.updateCommunity(req.params.id, req.body, userId);
    return ApiResponse.success(res, community, 'Community updated successfully');
  } catch (error) {
    next(error);
  }
};

const deleteCommunity = async (req, res, next) => {
  try {
    const userId = req.user?.id || null;
    const community = await communityService.deleteCommunity(req.params.id, userId);
    return ApiResponse.success(res, community, 'Community archived successfully');
  } catch (error) {
    next(error);
  }
};

const getCommunityCalendar = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    const calendar = await communityService.getCommunityCalendar(req.params.id, start_date, end_date);
    return ApiResponse.success(res, calendar, 'Calendar retrieved successfully');
  } catch (error) {
    next(error);
  }
};

const getCommunityFinances = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    const finances = await communityService.getCommunityFinances(req.params.id, start_date, end_date);
    return ApiResponse.success(res, finances, 'Financial data retrieved successfully');
  } catch (error) {
    next(error);
  }
};

const getCommunityTasks = async (req, res, next) => {
  try {
    const { status, priority } = req.query;
    const tasks = await communityService.getCommunityTasks(req.params.id, { status, priority });
    return ApiResponse.success(res, tasks, 'Tasks retrieved successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCommunity,
  listCommunities,
  getCommunity,
  updateCommunity,
  deleteCommunity,
  getCommunityCalendar,
  getCommunityFinances,
  getCommunityTasks
};
