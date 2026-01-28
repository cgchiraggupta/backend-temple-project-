const { supabase } = require('../../config/supabase');

class TimelineService {
  // Get community activity timeline
  async getCommunityTimeline(communityId, filters = {}) {
    const {
      limit = 50,
      offset = 0,
      activity_type,
      user_id
    } = filters;

    let query = supabase
      .from('activity_timeline')
      .select(`
        *,
        user:users(id, full_name, avatar_url),
        event:events(id, title)
      `)
      .eq('community_id', communityId);

    if (activity_type) {
      query = query.eq('activity_type', activity_type);
    }

    if (user_id) {
      query = query.eq('user_id', user_id);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error } = await query;
    if (error) throw error;

    return data;
  }

  // Get timeline statistics
  async getTimelineStats(communityId, startDate, endDate) {
    let query = supabase
      .from('activity_timeline')
      .select('activity_type, created_at')
      .eq('community_id', communityId);

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Group by activity type
    const stats = data.reduce((acc, activity) => {
      acc[activity.activity_type] = (acc[activity.activity_type] || 0) + 1;
      return acc;
    }, {});

    return {
      total: data.length,
      by_type: stats
    };
  }
}

module.exports = new TimelineService();
