const statsService = require('../../services/community/statsService');
const ApiResponse = require('../../utils/response');

const getCommunityStats = async (req, res, next) => {
  try {
    const stats = await statsService.getCommunityStats(req.params.id);
    return ApiResponse.success(res, stats, 'Statistics retrieved successfully');
  } catch (error) {
    next(error);
  }
};

const getMemberGrowthTrend = async (req, res, next) => {
  try {
    const { months } = req.query;
    const trend = await statsService.getMemberGrowthTrend(req.params.id, months ? parseInt(months) : 6);
    return ApiResponse.success(res, trend, 'Growth trend retrieved successfully');
  } catch (error) {
    next(error);
  }
};

const getActivityBreakdown = async (req, res, next) => {
  try {
    const { days } = req.query;
    const breakdown = await statsService.getActivityBreakdown(req.params.id, days ? parseInt(days) : 30);
    return ApiResponse.success(res, breakdown, 'Activity breakdown retrieved successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCommunityStats,
  getMemberGrowthTrend,
  getActivityBreakdown
};
