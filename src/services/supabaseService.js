// Supabase Service with Proper RLS Handling
const { createClient } = require('@supabase/supabase-js');

class SupabaseService {
  constructor() {
    // Try to use service key first, fallback to anon key
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;
    const anonKey = process.env.SUPABASE_ANON_KEY;

    // Check if service key is valid (different from anon key)
    const hasValidServiceKey = serviceKey && serviceKey !== anonKey && serviceKey.length > 100;

    // Use service key only if it's valid, otherwise use anon key
    this.useServiceKey = hasValidServiceKey;
    this.supabaseKey = hasValidServiceKey ? serviceKey : anonKey;

    console.log('🔑 Supabase Service initialized');
    console.log('   - Service key same as anon?', serviceKey === anonKey);
    console.log('   - Has valid service key?', hasValidServiceKey);
    console.log('   - Using:', this.useServiceKey ? 'SERVICE_ROLE' : 'ANON');

    this.client = createClient(
      process.env.SUPABASE_URL,
      this.supabaseKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        },
        db: { schema: 'public' }
      }
    );
  }

  // Create user with proper error handling
  async createUser(userData) {
    try {
      console.log('👤 Creating user in Supabase:', userData.email);

      // Filter out fields that don't exist in the database schema
      // Database has 'role' (singular), not 'roles' (plural)
      const { roles, preferences, ...dbFields } = userData;

      // Store roles in metadata if provided
      const insertData = {
        ...dbFields,
        // Ensure role is a string (singular), not an array
        role: userData.role || (roles && roles[0]) || 'user',
        // Store additional data in metadata
        metadata: {
          ...(userData.metadata || {}),
          roles: roles || [userData.role || 'user']
        }
      };

      console.log('📝 Insert data:', {
        email: insertData.email,
        role: insertData.role,
        metadata: insertData.metadata
      });

      const { data, error } = await this.client
        .from('users')
        .insert(insertData)
        .select('*')
        .single();

      if (error) {
        console.error('❌ Supabase user creation error:', error);
        throw error;
      }

      console.log('✅ User created in Supabase:', data.id);
      return data;
    } catch (error) {
      console.error('❌ User creation failed:', error.message);
      throw error;
    }
  }

  // Find user by email
  async findUserByEmail(email) {
    try {
      const { data, error } = await this.client
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase())
        .maybeSingle();

      if (error) {
        console.error('❌ Supabase user query error:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('❌ User query failed:', error.message);
      throw error;
    }
  }

  // Find user by ID
  async findUserById(id) {
    try {
      const { data, error } = await this.client
        .from('users')
        .select('*')
        .eq('id', String(id))
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // No rows found
        console.error('❌ Supabase user query error:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('❌ User query failed:', error.message);
      throw error;
    }
  }

  // Update user
  async updateUser(id, updates) {
    try {
      const { data, error } = await this.client
        .from('users')
        .update(updates)
        .eq('id', String(id))
        .select('*')
        .single();

      if (error) {
        console.error('❌ Supabase user update error:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('❌ User update failed:', error.message);
      throw error;
    }
  }

  // Create community with enhanced RLS error handling
  async createCommunity(communityData) {
    try {
      console.log('🏛️ Creating community in Supabase:', communityData.name);
      console.log('🔑 Using key type:', this.useServiceKey ? 'SERVICE_ROLE' : 'ANON');

      // Add debugging info
      console.log('📝 Community data:', {
        name: communityData.name,
        slug: communityData.slug,
        owner_id: communityData.owner_id,
        status: communityData.status
      });

      const { data, error } = await this.client
        .from('communities')
        .insert(communityData)
        .select('*')
        .single();

      if (error) {
        console.error('❌ Supabase community creation error:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });

        // Check if it's an RLS policy error
        if (error.code === '42501' || error.message?.includes('policy')) {
          console.error('🚫 RLS Policy Error - Check your Supabase RLS policies!');
          console.error('💡 Run the fix-rls-community-insert.sql in Supabase Dashboard');
        }

        throw error;
      }

      console.log('✅ Community created in Supabase:', data.id);
      return data;
    } catch (error) {
      console.error('❌ Community creation failed:', error.message);
      throw error;
    }
  }

  // Get all communities
  async getAllCommunities(filters = {}) {
    try {
      let query = this.client.from('communities').select('*');

      // Apply filters
      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      if (filters.owner_id && filters.owner_id !== 'all') {
        query = query.eq('owner_id', filters.owner_id);
      }

      query = query.order('created_at', { ascending: false });

      if (filters.limit) {
        query = query.limit(parseInt(filters.limit));
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Supabase communities query error:', error);
        throw error;
      }

      console.log('✅ Communities loaded from Supabase:', data?.length || 0);
      return data || [];
    } catch (error) {
      console.error('❌ Communities query failed:', error.message);
      throw error;
    }
  }

  // Get community by ID
  async getCommunityById(id) {
    try {
      const { data, error } = await this.client
        .from('communities')
        .select('*')
        .eq('id', String(id))
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // No rows found
        console.error('❌ Supabase community query error:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('❌ Community query failed:', error.message);
      throw error;
    }
  }

  // Update community
  async updateCommunity(id, updates) {
    try {
      const { data, error } = await this.client
        .from('communities')
        .update(updates)
        .eq('id', String(id))
        .select('*')
        .single();

      if (error) {
        console.error('❌ Supabase community update error:', error);
        throw error;
      }

      console.log('✅ Community updated in Supabase:', data.id);
      return data;
    } catch (error) {
      console.error('❌ Community update failed:', error.message);
      throw error;
    }
  }

  // Archive community
  async archiveCommunity(id) {
    try {
      const { data, error } = await this.client
        .from('communities')
        .update({
          status: 'archived',
          updated_at: new Date().toISOString()
        })
        .eq('id', String(id))
        .select('*')
        .single();

      if (error) {
        console.error('❌ Supabase community archive error:', error);
        throw error;
      }

      console.log('✅ Community archived in Supabase:', data.id);
      return data;
    } catch (error) {
      console.error('❌ Community archive failed:', error.message);
      throw error;
    }
  }

  // Test connection
  async testConnection() {
    try {
      console.log('🧪 Testing Supabase connection...');

      const { data, error } = await this.client
        .from('communities')
        .select('id, name')
        .limit(1);

      if (error) {
        console.error('❌ Connection test failed:', error);
        return false;
      }

      console.log('✅ Supabase connection successful');
      return true;
    } catch (error) {
      console.error('❌ Connection test error:', error.message);
      return false;
    }
  }
}

// Export singleton instance
module.exports = new SupabaseService();