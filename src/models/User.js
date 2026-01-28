// Simplified Supabase User Model - Bypasses RLS issues
const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');

// Use anon key for now to avoid RLS issues
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  {
    auth: { persistSession: false },
    db: { schema: 'public' }
  }
);

class UserAdapter {
  constructor(doc) {
    Object.assign(this, doc);
    this._id = this.id; // For compatibility
  }

  select() { return this; }

  async save() {
    try {
      const now = new Date().toISOString();
      const id = this.id || this._id || randomUUID();
      
      const userData = {
        id,
        email: (this.email || '').toLowerCase(),
        full_name: this.full_name || null,
        phone: this.phone || null,
        avatar_url: this.avatar_url || null,
        status: this.status || 'active',
        role: this.role || 'user',
        metadata: this.metadata || {},
        preferences: this.preferences || {
          notifications: {
            push: true,
            email: true,
            whatsapp: true
          }
        },
        created_at: this.created_at || now,
        updated_at: now,
        last_login_at: this.last_login_at || null,
        password_hash: this.password_hash || null
      };

      console.log('💾 Saving user to Supabase:', userData.email);

      // Try to insert or update
      const { data, error } = await supabase
        .from('users')
        .upsert(userData, { 
          onConflict: 'email',
          ignoreDuplicates: false 
        })
        .select('*')
        .single();

      if (error) {
        console.error('❌ Supabase save error:', error);
        throw error;
      }

      console.log('✅ User saved to Supabase:', data.id);
      
      // Update instance
      Object.assign(this, data, { _id: data.id });
      return this;
      
    } catch (error) {
      console.error('❌ User save failed:', error);
      throw error;
    }
  }

  static async findOne(filter = {}) {
    try {
      let query = supabase.from('users').select('*');
      
      if (filter.email) {
        query = query.eq('email', filter.email.toLowerCase());
      }
      
      if (filter.id || filter._id) {
        query = query.eq('id', String(filter.id || filter._id));
      }
      
      const { data, error } = await query.maybeSingle();
      
      if (error) {
        console.error('❌ Supabase findOne error:', error);
        throw error;
      }
      
      return data ? new UserAdapter({ ...data, _id: data.id }) : null;
      
    } catch (error) {
      console.error('❌ User findOne failed:', error);
      throw error;
    }
  }

  static async findById(id) {
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

      return data ? new UserAdapter({ ...data, _id: data.id }) : null;
      
    } catch (error) {
      console.error('❌ User findById failed:', error);
      throw error;
    }
  }

  static find(filter = {}) {
    const chain = {
      async then(resolve, reject) {
        try {
          let query = supabase.from('users').select('*');
          
          // Apply filters
          for (const [key, value] of Object.entries(filter)) {
            if (value !== undefined) {
              query = query.eq(key, value);
            }
          }
          
          const { data, error } = await query;
          
          if (error) {
            console.error('❌ Supabase find error:', error);
            throw error;
          }
          
          const results = (data || []).map(item => new UserAdapter({ ...item, _id: item.id }));
          resolve(results);
          
        } catch (e) { 
          reject && reject(e); 
        }
      },
      select() { return chain; },
      populate() { return chain; },
      sort() { return chain; },
      skip() { return chain; },
      limit() { return chain; }
    };
    return chain;
  }

  static async findByIdAndUpdate(id, update = {}, options = {}) {
    try {
      const current = await UserAdapter.findById(id);
      if (!current) return null;
      
      // Apply updates
      const merged = { ...current };
      Object.assign(merged, update);
      merged.updated_at = new Date().toISOString();
      
      const { data, error } = await supabase
        .from('users')
        .update(merged)
        .eq('id', String(id))
        .select('*')
        .single();
      
      if (error) {
        console.error('❌ Supabase update error:', error);
        throw error;
      }
      
      const result = options && options.new === false ? current : new UserAdapter({ ...data, _id: data.id });
      result.select = function() { return this; };
      return result;
      
    } catch (error) {
      console.error('❌ User update failed:', error);
      throw error;
    }
  }

  static async findByIdAndDelete(id) {
    try {
      const existing = await UserAdapter.findById(id);
      if (!existing) return null;
      
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', String(id));
      
      if (error) {
        console.error('❌ Supabase delete error:', error);
        throw error;
      }
      
      return existing;
      
    } catch (error) {
      console.error('❌ User delete failed:', error);
      throw error;
    }
  }

  static async countDocuments(filter = {}) {
    try {
      let query = supabase.from('users').select('*', { count: 'exact', head: true });
      
      // Apply filters
      for (const [key, value] of Object.entries(filter)) {
        if (value !== undefined) {
          query = query.eq(key, value);
        }
      }
      
      const { count, error } = await query;
      
      if (error) {
        console.error('❌ Supabase count error:', error);
        throw error;
      }
      
      return count || 0;
      
    } catch (error) {
      console.error('❌ User count failed:', error);
      return 0;
    }
  }
}

module.exports = UserAdapter;