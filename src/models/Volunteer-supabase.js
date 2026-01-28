// Supabase-backed Volunteer model adapter
const { supabase } = require('../config/supabase');
const { randomUUID } = require('crypto');

const TABLE = 'volunteers';

class VolunteerAdapter {
  constructor(doc) {
    // Expose fields directly on the instance like a Mongoose document
    Object.assign(this, doc);
  }

  async save() {
    const now = new Date();
    const row = {
      id: this.id || this._id || randomUUID(),
      user_id: this.user_id,
      skills: this.skills || [],
      interests: this.interests || [],
      availability: this.availability || {},
      emergency_contact: this.emergency_contact || {
        name: null,
        phone: null,
        relationship: null
      },
      background_check_status: this.background_check_status || 'pending',
      onboarding_completed: this.onboarding_completed || false,
      total_hours_volunteered: this.total_hours_volunteered || 0,
      rating: this.rating || 0,
      preferences: this.preferences || {},
      community_id: this.community_id,
      created_at: this.created_at || now,
      updated_at: now
    };
    
    const { data, error } = await supabase.from(TABLE).upsert(row).select('*').single();
    if (error) throw error;
    
    // Update instance fields to mimic mongoose post-save behavior
    Object.assign(this, data, { _id: data.id });
    return this;
  }

  static async findOne(filter = {}) {
    const { data, error } = await supabase.from(TABLE).select('*').match(filter).limit(1).maybeSingle();
    if (error) throw error;
    return data ? new VolunteerAdapter(data) : null;
  }

  static async findById(id) {
    const { data, error } = await supabase.from(TABLE).select('*').eq('id', String(id)).single();
    if (error && error.code !== 'PGRST116') throw error;
    return data ? new VolunteerAdapter(data) : null;
  }

  static find(filter = {}) {
    let query = supabase.from(TABLE).select('*');
    
    // Apply filters
    Object.entries(filter).forEach(([key, value]) => {
      if (key === 'skills' && Array.isArray(value)) {
        // Handle array contains for skills
        query = query.contains('skills', value);
      } else {
        query = query.eq(key, value);
      }
    });
    
    let skipValue = 0;
    let limitValue = 100;
    
    const chain = {
      async then(resolve, reject) {
        try {
          const finalQuery = query.range(skipValue, skipValue + limitValue - 1);
          const { data, error } = await finalQuery;
          if (error) throw error;
          resolve((data || []).map(d => new VolunteerAdapter({ ...d, _id: d.id })));
        } catch (e) { reject && reject(e); }
      },
      select() { return chain; },
      populate() { return chain; },
      sort(sortObj) {
        const [field, order] = Object.entries(sortObj)[0] || [];
        if (field) {
          query = query.order(field, { ascending: order === 1 });
        }
        return chain;
      },
      skip(offset) { 
        skipValue = offset;
        return chain; 
      },
      limit(count) { 
        limitValue = count;
        return chain; 
      }
    };
    return chain;
  }

  static async countDocuments(filter = {}) {
    let query = supabase.from(TABLE).select('*', { count: 'exact', head: true });
    
    // Apply filters
    Object.entries(filter).forEach(([key, value]) => {
      query = query.eq(key, value);
    });
    
    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
  }
}

module.exports = VolunteerAdapter;