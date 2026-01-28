const { supabase } = require('../config/supabase');

class ActivityLogger {
  async logCommunityActivity(communityId, userId, activityType, description, metadata = {}) {
    try {
      await supabase
        .from('activity_timeline')
        .insert([{
          community_id: communityId,
          user_id: userId || null,
          activity_type: activityType,
          description,
          metadata
        }]);
    } catch (error) {
      // Swallow errors to avoid breaking primary flows
      // Consider wiring to a real logger later
      // eslint-disable-next-line no-console
      console.error('Failed to log activity:', error.message);
    }
  }
}

module.exports = new ActivityLogger();


