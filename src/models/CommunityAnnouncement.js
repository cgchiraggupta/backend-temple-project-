// Supabase-backed CommunityAnnouncement adapter (maps to announcements table)
const { supabase } = require('../config/supabase');
const { randomUUID } = require('crypto');

const TABLE = 'announcements';

class CommunityAnnouncementAdapter {
  constructor(doc) { Object.assign(this, doc); }
  select() { return this; }
  populate() { return this; }

  async save() {
    const now = new Date();
    const id = this.id || this._id || randomUUID();
    const row = {
      id,
      community_id: this.community_id ? String(this.community_id) : null,
      title: this.title,
      body: this.content || this.body,
      priority: this.priority || 0,
      created_by: this.created_by ? String(this.created_by) : null,
      published: this.is_active ?? true,
      publish_at: this.created_at || now,
      expires_at: this.expires_at || null,
      created_at: this.created_at || now,
      updated_at: now
    };
    const { data, error } = await supabase.from(TABLE).upsert(row).select('*').single();
    if (error) throw error;
    Object.assign(this, data, { _id: data.id });
    return this;
  }

  static async findById(id) {
    const { data, error } = await supabase.from(TABLE).select('*').eq('id', String(id)).single();
    if (error && error.code !== 'PGRST116') throw error;
    return data ? new CommunityAnnouncementAdapter({ ...data, _id: data.id }) : null;
  }

  static find(filter = {}) {
    let query = applyFilter(supabase.from(TABLE).select('*'), filter);
    const chain = {
      sort() { return chain; },
      skip() { return chain; },
      limit() { return chain; },
      select() { return chain; },
      populate() { return chain; },
      async then(resolve, reject) {
        try {
          const { data, error } = await query;
          if (error) throw error;
          resolve((data || []).map(d => new CommunityAnnouncementAdapter({ ...d, _id: d.id })));
        } catch (e) { reject && reject(e); }
      }
    };
    return chain;
  }

  static async findOne(filter = {}) {
    const { data, error } = await applyFilter(supabase.from(TABLE).select('*'), filter).limit(1).maybeSingle();
    if (error) throw error;
    return data ? new CommunityAnnouncementAdapter({ ...data, _id: data.id }) : null;
  }

  static async findByIdAndUpdate(id, update = {}, options = {}) {
    const current = await CommunityAnnouncementAdapter.findById(id);
    if (!current) return null;
    const merged = applyMongoUpdate(current, update);
    merged.updated_at = new Date();
    const { data, error } = await supabase.from(TABLE).update(merged).eq('id', String(id)).select('*').single();
    if (error) throw error;
    const result = options && options.new === false ? current : new CommunityAnnouncementAdapter({ ...data, _id: data.id });
    result.select = function() { return this; };
    result.populate = function() { return this; };
    return result;
  }

  static async findByIdAndDelete(id) {
    const existing = await CommunityAnnouncementAdapter.findById(id);
    if (!existing) return null;
    const { error } = await supabase.from(TABLE).delete().eq('id', String(id));
    if (error) throw error;
    return existing;
  }
}

function applyFilter(q, filter) {
  const f = { ...filter };
  if (f._id) { f.id = String(f._id); delete f._id; }
  let query = q;
  for (const [k, v] of Object.entries(f)) {
    if (v && typeof v === 'object' && ('$in' in v)) {
      query = query.in(k, v.$in.map(String));
    } else {
      query = query.eq(k, typeof v === 'object' ? JSON.stringify(v) : v);
    }
  }
  return query;
}

function applyMongoUpdate(doc, update) {
  const out = { ...doc };
  if (update.$set) Object.assign(out, update.$set);
  if (update.$inc) for (const [k, v] of Object.entries(update.$inc)) out[k] = Number(out[k] || 0) + Number(v);
  for (const [k, v] of Object.entries(update)) if (!k.startsWith('$')) out[k] = v;
  return out;
}

module.exports = CommunityAnnouncementAdapter;
