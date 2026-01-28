const { supabase } = require('../../config/supabase');
const { startOfMonth, endOfMonth, subMonths, format } = require('date-fns');

class StatsService {
  // Get comprehensive community statistics
  async getCommunityStats(communityId) {
    // Get member statistics
    const { data: memberStats } = await supabase
      .from('community_members')
      .select('role, status, joined_at')
      .eq('community_id', communityId);

    // Get active events count
    const { count: activeEventsCount } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('community_id', communityId)
      .eq('status', 'published');

    // Get pending tasks count
    const { count: pendingTasksCount } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('community_id', communityId)
      .in('status', ['todo', 'in_progress']);

    // Get donation summary for current month
    const startOfCurrentMonth = startOfMonth(new Date()).toISOString();
    const endOfCurrentMonth = endOfMonth(new Date()).toISOString();

    const { data: donations } = await supabase
      .from('donations')
      .select('amount')
      .eq('community_id', communityId)
      .eq('status', 'completed')
      .gte('received_at', startOfCurrentMonth)
      .lte('received_at', endOfCurrentMonth);

    const totalDonations = donations?.reduce((sum, d) => sum + parseFloat(d.amount), 0) || 0;

    // Get recent activity count
    const { count: recentActivityCount } = await supabase
      .from('activity_timeline')
      .select('*', { count: 'exact', head: true })
      .eq('community_id', communityId)
      .gte('created_at', subMonths(new Date(), 1).toISOString());

    return {
      members: {
        total: memberStats?.length || 0,
        active: memberStats?.filter(m => m.status === 'active').length || 0,
        leads: memberStats?.filter(m => m.role === 'lead' && m.status === 'active').length || 0,
        pending: memberStats?.filter(m => m.status === 'pending').length || 0
      },
      events: {
        active: activeEventsCount || 0
      },
      tasks: {
        pending: pendingTasksCount || 0
      },
      donations: {
        current_month: totalDonations,
        count: donations?.length || 0
      },
      activity: {
        last_30_days: recentActivityCount || 0
      }
    };
  }

  // Get member growth trend
  async getMemberGrowthTrend(communityId, months = 6) {
    const trends = [];
    
    for (let i = months - 1; i >= 0; i--) {
      const monthStart = startOfMonth(subMonths(new Date(), i)).toISOString();
      const monthEnd = endOfMonth(subMonths(new Date(), i)).toISOString();

      const { count } = await supabase
        .from('community_members')
        .select('*', { count: 'exact', head: true })
        .eq('community_id', communityId)
        .lte('joined_at', monthEnd);

      trends.push({
        month: format(subMonths(new Date(), i), 'MMM yyyy'),
        count: count || 0
      });
    }

    return trends;
  }

  // Get activity breakdown
  async getActivityBreakdown(communityId, days = 30) {
    const startDate = subMonths(new Date(), days / 30).toISOString();

    const { data: activities } = await supabase
      .from('activity_timeline')
      .select('activity_type, created_at')
      .eq('community_id', communityId)
      .gte('created_at', startDate);

    const breakdown = activities?.reduce((acc, activity) => {
      acc[activity.activity_type] = (acc[activity.activity_type] || 0) + 1;
      return acc;
    }, {}) || {};

    return breakdown;
  }
}

module.exports = new StatsService();
