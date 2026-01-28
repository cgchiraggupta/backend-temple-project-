// Hybrid Community Service - Fetches from and saves to Supabase
const { randomUUID } = require('crypto');
const supabaseService = require('./supabaseService');

// In-memory storage as fallback
const communities = new Map();

class HybridCommunityService {

  static async createCommunity(communityData) {
    const communityId = randomUUID();
    const now = new Date().toISOString();

    const community = {
      id: communityId,
      name: communityData.name,
      slug: communityData.slug || communityData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      description: communityData.description || '',
      owner_id: communityData.owner_id,
      logo_url: communityData.logo_url || '/placeholder.svg',
      cover_image_url: communityData.cover_image_url || null,
      status: communityData.status || 'active',
      settings: communityData.settings || { public_visible: true, allow_join_requests: true },
      metadata: communityData.metadata || {},
      created_at: now,
      updated_at: now
    };

    // Always save to memory first (guaranteed to work)
    communities.set(communityId, community);
    console.log('✅ Community saved to memory:', community.name);

    // Attempt to save to Supabase (best effort)
    try {
      const supabaseData = await supabaseService.createCommunity(community);
      if (supabaseData) {
        console.log('✅ Community also saved to Supabase:', supabaseData.id);
        // Update memory with Supabase data (in case of any differences)
        communities.set(communityId, { ...supabaseData, _id: supabaseData.id });
      }
    } catch (error) {
      console.log('⚠️ Supabase save failed (using memory):', error.message);
    }

    return { ...community, _id: community.id };
  }

  static async getAllCommunities(filters = {}) {
    let supabaseData = [];

    // Try Supabase first
    try {
      const data = await supabaseService.getAllCommunities(filters);
      if (data && data.length >= 0) {
        console.log('✅ Communities loaded from Supabase:', data.length);

        // Fetch owner details and stats for each community
        const communitiesWithDetails = await Promise.all(data.map(async (item) => {
          let ownerData = null;
          let memberCount = 0;
          let leadCount = 0;
          let activeEvents = 0;
          let pendingTasks = 0;
          let totalDonations = 0;

          // Fetch owner details
          if (item.owner_id) {
            try {
              const { data: owner, error: ownerError } = await supabaseService.client
                .from('users')
                .select('id, full_name, email, avatar_url')
                .eq('id', item.owner_id)
                .single();

              if (!ownerError && owner) {
                ownerData = owner;
              }
            } catch (err) {
              // Silently fail for individual owner lookups
            }
          }

          // Fetch member count
          try {
            const { count } = await supabaseService.client
              .from('community_members')
              .select('*', { count: 'exact', head: true })
              .eq('community_id', item.id)
              .eq('status', 'active');
            memberCount = count || 0;
          } catch (err) {
            // Silently fail
          }

          // Fetch lead count
          try {
            const { count } = await supabaseService.client
              .from('community_members')
              .select('*', { count: 'exact', head: true })
              .eq('community_id', item.id)
              .eq('is_lead', true);
            leadCount = count || 0;
          } catch (err) {
            // Silently fail
          }

          // Fetch active events count
          try {
            const { count } = await supabaseService.client
              .from('events')
              .select('*', { count: 'exact', head: true })
              .eq('community_id', item.id)
              .gte('end_date', new Date().toISOString());
            activeEvents = count || 0;
          } catch (err) {
            // Silently fail
          }

          // Fetch pending tasks count
          try {
            const { count } = await supabaseService.client
              .from('community_tasks')
              .select('*', { count: 'exact', head: true })
              .eq('community_id', item.id)
              .in('status', ['todo', 'in_progress', 'in-progress']);
            pendingTasks = count || 0;
          } catch (err) {
            // Silently fail
          }

          // Fetch total donations
          try {
            const { data: donations } = await supabaseService.client
              .from('donations')
              .select('amount')
              .eq('community_id', item.id);
            if (donations) {
              totalDonations = donations.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
            }
          } catch (err) {
            // Silently fail
          }

          return {
            ...item,
            _id: item.id,
            owner: ownerData,
            member_count: memberCount,
            lead_count: leadCount,
            active_events: activeEvents,
            pending_tasks: pendingTasks,
            total_donations: totalDonations
          };
        }));

        supabaseData = communitiesWithDetails;
      }
    } catch (error) {
      console.log('⚠️ Supabase connection failed, using memory:', error.message);
    }

    // Get memory data as fallback
    const memoryData = Array.from(communities.values());

    // Combine data (Supabase takes priority, memory as fallback)
    const allCommunities = supabaseData.length > 0 ? supabaseData : memoryData;

    // Apply memory-based filters if needed
    let filteredCommunities = allCommunities;

    if (filters.search && supabaseData.length === 0) {
      const searchLower = filters.search.toLowerCase();
      filteredCommunities = allCommunities.filter(c =>
        c.name.toLowerCase().includes(searchLower) ||
        (c.description || '').toLowerCase().includes(searchLower)
      );
    }

    if (filters.status && filters.status !== 'all' && supabaseData.length === 0) {
      filteredCommunities = filteredCommunities.filter(c => c.status === filters.status);
    }

    if (filters.owner_id && filters.owner_id !== 'all' && supabaseData.length === 0) {
      filteredCommunities = filteredCommunities.filter(c => c.owner_id === filters.owner_id);
    }

    console.log('📊 Total communities returned:', filteredCommunities.length);
    return filteredCommunities;
  }

  static async getCommunityById(id) {
    // Try Supabase first
    try {
      // Fetch community with owner details
      const { data, error } = await supabaseService.client
        .from('communities')
        .select('*')
        .eq('id', String(id))
        .single();

      if (!error && data) {
        console.log('✅ Community found in Supabase by ID:', data.id);

        // Fetch owner details if owner_id exists
        let ownerData = null;
        if (data.owner_id) {
          try {
            const { data: owner, error: ownerError } = await supabaseService.client
              .from('users')
              .select('id, full_name, email, avatar_url')
              .eq('id', data.owner_id)
              .single();

            if (!ownerError && owner) {
              ownerData = owner;
              console.log('✅ Owner found:', owner.full_name);
            }
          } catch (ownerErr) {
            console.log('⚠️ Could not fetch owner details:', ownerErr.message);
          }
        }

        // Fetch member count
        let memberCount = 0;
        try {
          const { count, error: countError } = await supabaseService.client
            .from('community_members')
            .select('*', { count: 'exact', head: true })
            .eq('community_id', data.id)
            .eq('status', 'active');

          if (!countError) {
            memberCount = count || 0;
          }
        } catch (countErr) {
          console.log('⚠️ Could not fetch member count:', countErr.message);
        }

        // Fetch lead count
        let leadCount = 0;
        try {
          const { count, error: leadError } = await supabaseService.client
            .from('community_members')
            .select('*', { count: 'exact', head: true })
            .eq('community_id', data.id)
            .eq('is_lead', true);

          if (!leadError) {
            leadCount = count || 0;
          }
        } catch (leadErr) {
          console.log('⚠️ Could not fetch lead count:', leadErr.message);
        }

        return {
          ...data,
          _id: data.id,
          owner: ownerData,
          member_count: memberCount,
          lead_count: leadCount
        };
      }
    } catch (error) {
      console.log('⚠️ Supabase query failed, checking memory:', error.message);
    }

    // Fallback to memory
    const memoryCommunity = communities.get(String(id));
    if (memoryCommunity) {
      console.log('✅ Community found in memory by ID:', memoryCommunity.id);
      return memoryCommunity;
    }

    return null;
  }

  static async updateCommunity(id, updateData) {
    const now = new Date().toISOString();
    const updates = { ...updateData, updated_at: now };

    console.log('📝 HybridCommunityService.updateCommunity called');
    console.log('📝 Community ID:', id);
    console.log('📝 Update data:', JSON.stringify(updates, null, 2));

    // Update in memory
    const memoryCommunity = communities.get(String(id));
    if (memoryCommunity) {
      const updatedCommunity = { ...memoryCommunity, ...updates };
      communities.set(String(id), updatedCommunity);
      console.log('✅ Community updated in memory:', id);
    }

    // Attempt to update in Supabase
    try {
      console.log('📤 Sending update to Supabase...');
      const { data, error } = await supabaseService.client
        .from('communities')
        .update(updates)
        .eq('id', String(id))
        .select('*')
        .single();

      if (!error && data) {
        console.log('✅ Community updated in Supabase:', data.id);
        console.log('✅ Updated owner_id:', data.owner_id);
        return { ...data, _id: data.id };
      } else {
        console.log('⚠️ Supabase update failed:', error?.message);
        console.log('⚠️ Error details:', JSON.stringify(error, null, 2));
      }
    } catch (error) {
      console.log('⚠️ Supabase connection failed:', error.message);
    }

    return memoryCommunity ? { ...memoryCommunity, ...updates } : null;
  }

  static async deleteCommunity(id) {
    // Remove from memory
    const memoryCommunity = communities.get(String(id));
    if (memoryCommunity) {
      communities.delete(String(id));
      console.log('✅ Community removed from memory:', id);
    }

    // Permanently delete from Supabase database
    try {
      const { data, error } = await supabaseService.client
        .from('communities')
        .delete()
        .eq('id', String(id))
        .select('*')
        .single();

      if (!error && data) {
        console.log('✅ Community permanently deleted from Supabase:', data.id);
        return { ...data, _id: data.id };
      } else {
        console.log('⚠️ Supabase delete failed (memory removed):', error?.message);
      }
    } catch (error) {
      console.log('⚠️ Supabase connection failed (memory removed):', error.message);
    }

    return memoryCommunity;
  }

  static async getCommunityStats(id) {
    // Try to get from Supabase first
    try {
      const { data, error } = await supabaseService.client
        .from('communities')
        .select('*')
        .eq('id', String(id))
        .single();

      if (!error && data) {
        // Fetch member count
        let memberCount = 0;
        try {
          const { count } = await supabaseService.client
            .from('community_members')
            .select('*', { count: 'exact', head: true })
            .eq('community_id', id)
            .eq('status', 'active');
          memberCount = count || 0;
        } catch (err) {
          console.log('⚠️ Could not fetch member count:', err.message);
        }

        // Fetch lead count
        let leadCount = 0;
        try {
          const { count } = await supabaseService.client
            .from('community_members')
            .select('*', { count: 'exact', head: true })
            .eq('community_id', id)
            .eq('is_lead', true);
          leadCount = count || 0;
        } catch (err) {
          console.log('⚠️ Could not fetch lead count:', err.message);
        }

        // Fetch active events count
        let activeEvents = 0;
        try {
          const { count } = await supabaseService.client
            .from('events')
            .select('*', { count: 'exact', head: true })
            .eq('community_id', id)
            .gte('end_date', new Date().toISOString());
          activeEvents = count || 0;
        } catch (err) {
          console.log('⚠️ Could not fetch events count:', err.message);
        }

        // Fetch pending tasks count from community_tasks table
        let pendingTasks = 0;
        try {
          const { count } = await supabaseService.client
            .from('community_tasks')
            .select('*', { count: 'exact', head: true })
            .eq('community_id', id)
            .in('status', ['todo', 'in_progress', 'in-progress']);
          pendingTasks = count || 0;
        } catch (err) {
          console.log('⚠️ Could not fetch tasks count:', err.message);
        }

        // Fetch total donations
        let totalDonations = 0;
        try {
          const { data: donations } = await supabaseService.client
            .from('donations')
            .select('amount')
            .eq('community_id', id);
          if (donations) {
            totalDonations = donations.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
          }
        } catch (err) {
          console.log('⚠️ Could not fetch donations:', err.message);
        }

        const stats = {
          member_count: memberCount,
          lead_count: leadCount,
          active_events: activeEvents,
          pending_tasks: pendingTasks,
          total_donations: totalDonations,
          status: data.status,
          created_at: data.created_at,
          active_days: Math.floor((new Date() - new Date(data.created_at)) / (1000 * 60 * 60 * 24))
        };
        return stats;
      }
    } catch (error) {
      console.log('⚠️ Supabase stats query failed:', error.message);
    }

    // Fallback to memory
    const memoryCommunity = communities.get(String(id));
    if (memoryCommunity) {
      return {
        member_count: 0,
        lead_count: 0,
        active_events: 0,
        pending_tasks: 0,
        total_donations: 0,
        status: memoryCommunity.status,
        created_at: memoryCommunity.created_at,
        active_days: Math.floor((new Date() - new Date(memoryCommunity.created_at)) / (1000 * 60 * 60 * 24))
      };
    }

    return null;
  }

  // initializeDefaultCommunities method removed

}

module.exports = HybridCommunityService;