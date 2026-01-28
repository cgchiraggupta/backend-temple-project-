const { supabase, supabaseAdmin } = require('../../config/supabase');
const { COMMUNITY_STATUS, PAGINATION } = require('../../config/constants');
const ActivityLogger = require('../../utils/activityLogger');

class CommunityService {
  // Create a new community
  async createCommunity(communityData, userId) {
    console.log('🔵 Creating community:', { communityData, userId });

    // Validate required fields
    if (!communityData.name || !communityData.owner_id) {
      throw new Error('Name and owner_id are required');
    }

    const { data, error } = await supabase
      .from('communities')
      .insert([{
        name: communityData.name,
        slug: communityData.slug,
        description: communityData.description || null,
        owner_id: communityData.owner_id,
        logo_url: communityData.logo_url || null,
        cover_image_url: communityData.cover_image_url || null,
        status: COMMUNITY_STATUS.ACTIVE,
        settings: communityData.settings || {
          public_visible: true,
          allow_join_requests: true,
          require_approval: false
        },
        metadata: communityData.metadata || {}
      }])
      .select(`
        *,
        owner:users!communities_owner_id_fkey(
          id, 
          full_name, 
          email, 
          avatar_url
        )
      `)
      .single();

    if (error) {
      console.error('❌ Supabase error:', error);
      throw error;
    }

    console.log('✅ Community created:', data);

    // Add owner as a community lead
    const { error: memberError } = await supabase
      .from('community_members')
      .insert([{
        community_id: data.id,
        user_id: data.owner_id,
        role: 'lead',
        status: 'active'
      }]);

    if (memberError) {
      console.error('⚠️ Failed to add owner as member:', memberError);
    }

    // Log activity (don't let this fail the request)
    try {
      await ActivityLogger.logCommunityActivity(
        data.id,
        userId,
        'community_created',
        `Created community: ${data.name}`
      );
    } catch (logError) {
      console.error('⚠️ Failed to log activity:', logError);
    }

    return data;
  }

  // Get all communities with pagination and filters
  async listCommunities(filters = {}, userId, userRoles) {
    const {
      page = PAGINATION.DEFAULT_PAGE,
      limit = PAGINATION.DEFAULT_LIMIT,
      status,
      search,
      owner_id
    } = filters;

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('communities')
      .select(`
        *,
        owner:users!communities_owner_id_fkey(
          id, 
          full_name, 
          email, 
          avatar_url
        ),
        members_count:community_members(count)
      `, { count: 'exact' });

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }

    if (owner_id) {
      query = query.eq('owner_id', owner_id);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // If not admin, only show communities user has access to
    if (!userRoles.includes('admin')) {
      // Get user's community memberships
      const { data: memberships } = await supabase
        .from('community_members')
        .select('community_id')
        .eq('user_id', userId)
        .eq('status', 'active');

      const communityIds = memberships?.map(m => m.community_id) || [];

      if (communityIds.length > 0) {
        query = query.or(`owner_id.eq.${userId},id.in.(${communityIds.join(',')})`);
      } else {
        query = query.eq('owner_id', userId);
      }
    }

    query = query
      .order('created_at', { ascending: false })
      .range(from, to);

    const { data, error, count } = await query;

    if (error) throw error;

    // Get member counts for each community
    const enrichedData = await Promise.all(data.map(async (community) => {
      const { data: memberStats } = await supabase
        .from('community_members')
        .select('role, status')
        .eq('community_id', community.id);

      return {
        ...community,
        stats: {
          total_members: memberStats?.length || 0,
          active_members: memberStats?.filter(m => m.status === 'active').length || 0,
          leads: memberStats?.filter(m => m.role === 'lead' && m.status === 'active').length || 0
        }
      };
    }));

    return {
      communities: enrichedData,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count
      }
    };
  }

  // Get single community by ID
  async getCommunityById(communityId) {
    const { data, error } = await supabase
      .from('communities')
      .select(`
        *,
        owner:users!communities_owner_id_fkey(
          id, 
          full_name, 
          email, 
          avatar_url, 
          phone
        )
      `)
      .eq('id', communityId)
      .single();

    if (error) throw error;

    // Get member statistics
    const { data: memberStats } = await supabase
      .from('community_members')
      .select('role, status')
      .eq('community_id', communityId);

    // Get recent activity count
    const { count: activityCount } = await supabase
      .from('activity_timeline')
      .select('*', { count: 'exact', head: true })
      .eq('community_id', communityId);

    // Get active events count
    const { count: eventsCount } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('community_id', communityId)
      .eq('status', 'published');

    // Get pending tasks count
    const { count: tasksCount } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('community_id', communityId)
      .in('status', ['todo', 'in_progress']);

    return {
      ...data,
      stats: {
        total_members: memberStats?.length || 0,
        active_members: memberStats?.filter(m => m.status === 'active').length || 0,
        leads: memberStats?.filter(m => m.role === 'lead' && m.status === 'active').length || 0,
        recent_activities: activityCount || 0,
        active_events: eventsCount || 0,
        pending_tasks: tasksCount || 0
      }
    };
  }

  // Update community
  async updateCommunity(communityId, updateData, userId) {
    const allowedFields = [
      'name',
      'description',
      'logo_url',
      'cover_image_url',
      'status',
      'settings',
      'metadata'
    ];

    const filteredData = Object.keys(updateData)
      .filter(key => allowedFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = updateData[key];
        return obj;
      }, {});

    const { data, error } = await supabase
      .from('communities')
      .update(filteredData)
      .eq('id', communityId)
      .select()
      .single();

    if (error) throw error;

    // Log activity
    await ActivityLogger.logCommunityActivity(
      communityId,
      userId,
      'community_updated',
      `Updated community: ${data.name}`,
      { updated_fields: Object.keys(filteredData) }
    );

    return data;
  }

  // Delete/Archive community
  async deleteCommunity(communityId, userId) {
    const { data, error } = await supabase
      .from('communities')
      .update({ status: COMMUNITY_STATUS.ARCHIVED })
      .eq('id', communityId)
      .select()
      .single();

    if (error) throw error;

    // Log activity
    await ActivityLogger.logCommunityActivity(
      communityId,
      userId,
      'community_archived',
      `Archived community: ${data.name}`
    );

    return data;
  }

  // Get community calendar (events)
  async getCommunityCalendar(communityId, startDate, endDate) {
    let query = supabase
      .from('events')
      .select(`
        id,
        title,
        starts_at,
        ends_at,
        status,
        visibility,
        location,
        event_type,
        recurring_pattern
      `)
      .eq('community_id', communityId)
      .eq('status', 'published');

    if (startDate) {
      query = query.gte('starts_at', startDate);
    }

    if (endDate) {
      query = query.lte('starts_at', endDate);
    }

    query = query.order('starts_at', { ascending: true });

    const { data, error } = await query;
    if (error) throw error;

    return data;
  }

  // Get community financial summary
  async getCommunityFinances(communityId, startDate, endDate) {
    // Get donations
    let donationQuery = supabase
      .from('donations')
      .select('amount, received_at, status')
      .eq('community_id', communityId)
      .eq('status', 'completed');

    if (startDate) {
      donationQuery = donationQuery.gte('received_at', startDate);
    }
    if (endDate) {
      donationQuery = donationQuery.lte('received_at', endDate);
    }

    const { data: donations, error: donError } = await donationQuery;
    if (donError) throw donError;

    // Get expenses
    let expenseQuery = supabase
      .from('expenses')
      .select('amount, expense_date, category')
      .eq('community_id', communityId);

    if (startDate) {
      expenseQuery = expenseQuery.gte('expense_date', startDate);
    }
    if (endDate) {
      expenseQuery = expenseQuery.lte('expense_date', endDate);
    }

    const { data: expenses, error: expError } = await expenseQuery;
    if (expError) throw expError;

    const totalDonations = donations?.reduce((sum, d) => sum + parseFloat(d.amount), 0) || 0;
    const totalExpenses = expenses?.reduce((sum, e) => sum + parseFloat(e.amount), 0) || 0;

    return {
      donations: {
        total: totalDonations,
        count: donations?.length || 0,
        transactions: donations
      },
      expenses: {
        total: totalExpenses,
        count: expenses?.length || 0,
        transactions: expenses
      },
      balance: totalDonations - totalExpenses
    };
  }

  // Get community tasks
  async getCommunityTasks(communityId, filters = {}) {
    const { status, priority } = filters;

    let query = supabase
      .from('tasks')
      .select('*')
      .eq('community_id', communityId)
      .order('due_date', { ascending: true });

    if (status) {
      query = query.eq('status', status);
    }
    if (priority) {
      query = query.eq('priority', priority);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }
}

module.exports = new CommunityService();
