const timelineService = require('../../services/community/timelineService');
const ApiResponse = require('../../utils/response');

const getCommunityTimeline = async (req, res, next) => {
  try {
    const timeline = await timelineService.getCommunityTimeline(req.params.id, req.query);
    return ApiResponse.success(res, timeline, 'Timeline retrieved successfully');
  } catch (error) {
    next(error);
  }
};

const getTimelineStats = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    const stats = await timelineService.getTimelineStats(req.params.id, start_date, end_date);
    return ApiResponse.success(res, stats, 'Timeline statistics retrieved successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCommunityTimeline,
  getTimelineStats
};
