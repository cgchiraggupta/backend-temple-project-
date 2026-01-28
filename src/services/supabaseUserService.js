// Direct Supabase User Service
const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');

// Create Supabase client with service key to bypass RLS
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY,
  {
    auth: { persistSession: false },
    db: { schema: 'public' }
  }
);

class SupabaseUserService {
  
  static async createUser(userData) {
    try {
      const now = new Date().toISOString();
      const userId = randomUUID();
      
      const user = {
        id: userId,
        email: userData.email.toLowerCase(),
        full_name: userData.full_name,
        phone: userData.phone || null,
        avatar_url: userData.avatar_url || null,
        status: 'active',
        metadata: userData.metadata || {},
        preferences: userData.preferences || {
          notifications: {
            push: true,
            email: true,
            whatsapp: true
          }
        },
        created_at: now,
        updated_at: now,
        last_login_at: null,
        password_hash: userData.password_hash
      };

      console.log('💾 Creating user in Supabase:', user.email);

      // Insert user into Supabase
      const { data, error } = await supabase
        .from('users')
        .insert(user)
        .select('*')
        .single();

      if (error) {
        console.error('❌ Supabase insert error:', error);
        
        // Check if it's a duplicate email error
        if (error.code === '23505' && error.message.includes('email')) {
          throw new Error('User already exists with this email');
        }
        
        throw error;
      }

      console.log('✅ User created in Supabase:', data.id);
      return data;
      
    } catch (error) {
      console.error('❌ Create user failed:', error);
      throw error;
    }
  }

  static async findUserByEmail(email) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase())
        .maybeSingle();

      if (error) {
        console.error('❌ Supabase findByEmail error:', error);
        throw error;
      }

      return data;
      
    } catch (error) {
      console.error('❌ Find user by email failed:', error);
      throw error;
    }
  }

  static async findUserById(id) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', String(id))
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows found
          return null;
        }
        console.error('❌ Supabase findById error:', error);
        throw error;
      }

      return data;
      
    } catch (error) {
      console.error('❌ Find user by ID failed:', error);
      throw error;
    }
  }

  static async updateUserLastLogin(id) {
    try {
      const { data, error } = await supabase
        .from('users')
        .update({ 
          last_login_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', String(id))
        .select('*')
        .single();

      if (error) {
        console.error('❌ Supabase update login error:', error);
        throw error;
      }

      return data;
      
    } catch (error) {
      console.error('❌ Update user login failed:', error);
      throw error;
    }
  }

  static async getAllUsers() {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Supabase getAllUsers error:', error);
        throw error;
      }

      return data || [];
      
    } catch (error) {
      console.error('❌ Get all users failed:', error);
      throw error;
    }
  }
}

module.exports = SupabaseUserService;