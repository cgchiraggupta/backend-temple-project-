// Temporary In-Memory Community Model for Testing
const { randomUUID } = require('crypto');

// In-memory storage
const communities = new Map();

// Pre-populate with test communities
const testCommunities = [
  {
    id: randomUUID(),
    name: 'Main Temple Community',
    slug: 'main-temple',
    description: 'Primary temple community for all devotees and activities',
    owner_id: 'admin-user-id',
    logo_url: '/placeholder.svg',
    status: 'active',
    member_count: 150,
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    id: randomUUID(),
    name: 'Youth Community',
    slug: 'youth-community',
    description: 'Community for young devotees and cultural activities',
    owner_id: 'admin-user-id',
    logo_url: '/placeholder.svg',
    status: 'active',
    member_count: 75,
    created_at: new Date(),
    updated_at: new Date()
  }
];

// Initialize with test communities
testCommunities.forEach(community => {
  communities.set(community.id, community);
});

class CommunityAdapter {
  constructor(doc) {
    Object.assign(this, doc);
    this._id = this.id; // For compatibility
  }

  async save() {
    const now = new Date();
    const id = this.id || this._id || randomUUID();

    const communityData = {
      id,
      name: this.name,
      slug: this.slug || this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      description: this.description || '',
      owner_id: this.owner_id,
      logo_url: this.logo_url || '/placeholder.svg',
      cover_image_url: this.cover_image_url || null,
      status: this.status || 'active',
      member_count: this.member_count || 0,
      settings: this.settings || {},
      metadata: this.metadata || {},
      created_at: this.created_at || now,
      updated_at: now
    };

    // Store in memory
    communities.set(id, communityData);

    // Update instance
    Object.assign(this, communityData, { _id: id });
    return this;
  }

  static async findOne(filter = {}) {
    for (const community of communities.values()) {
      let matches = true;
      for (const [key, value] of Object.entries(filter)) {
        if (community[key] !== value) {
          matches = false;
          break;
        }
      }
      if (matches) {
        return new CommunityAdapter(community);
      }
    }
    return null;
  }

  static async findById(id) {
    const community = communities.get(String(id));
    return community ? new CommunityAdapter({ ...community, _id: community.id }) : null;
  }

  static find(filter = {}) {
    const chain = {
      async then(resolve, reject) {
        try {
          const results = [];
          for (const community of communities.values()) {
            let matches = true;

            // Handle search filter
            if (filter.$or) {
              let orMatch = false;
              for (const orCondition of filter.$or) {
                for (const [key, condition] of Object.entries(orCondition)) {
                  if (condition.$regex) {
                    const regex = new RegExp(condition.$regex, condition.$options || '');
                    if (regex.test(community[key] || '')) {
                      orMatch = true;
                      break;
                    }
                  }
                }
                if (orMatch) break;
              }
              if (!orMatch) matches = false;
            }

            // Handle other filters
            for (const [key, value] of Object.entries(filter)) {
              if (key === '$or') continue; // Already handled
              if (community[key] !== value) {
                matches = false;
                break;
              }
            }

            if (matches) {
              results.push(new CommunityAdapter(community));
            }
          }
          resolve(results);
        } catch (e) {
          reject && reject(e);
        }
      },
      populate() { return chain; },
      sort() { return chain; },
      skip() { return chain; },
      limit() { return chain; }
    };
    return chain;
  }

  static async findByIdAndUpdate(id, update = {}, options = {}) {
    const current = await CommunityAdapter.findById(id);
    if (!current) return null;

    // Apply updates
    const merged = { ...current };

    // Handle $inc operations
    if (update.$inc) {
      for (const [key, value] of Object.entries(update.$inc)) {
        merged[key] = (merged[key] || 0) + value;
      }
    }

    // Apply direct updates
    for (const [key, value] of Object.entries(update)) {
      if (!key.startsWith('$')) {
        merged[key] = value;
      }
    }

    merged.updated_at = new Date();

    // Save back
    communities.set(String(id), merged);

    const result = options && options.new === false ? current : new CommunityAdapter({ ...merged, _id: merged.id });
    result.populate = function () { return this; };
    return result;
  }

  static async findByIdAndDelete(id) {
    const existing = await CommunityAdapter.findById(id);
    if (!existing) return null;

    communities.delete(String(id));
    return existing;
  }

  static async countDocuments(filter = {}) {
    let count = 0;
    for (const community of communities.values()) {
      let matches = true;

      // Handle search filter
      if (filter.$or) {
        let orMatch = false;
        for (const orCondition of filter.$or) {
          for (const [key, condition] of Object.entries(orCondition)) {
            if (condition.$regex) {
              const regex = new RegExp(condition.$regex, condition.$options || '');
              if (regex.test(community[key] || '')) {
                orMatch = true;
                break;
              }
            }
          }
          if (orMatch) break;
        }
        if (!orMatch) matches = false;
      }

      // Handle other filters
      for (const [key, value] of Object.entries(filter)) {
        if (key === '$or') continue;
        if (community[key] !== value) {
          matches = false;
          break;
        }
      }

      if (matches) count++;
    }
    return count;
  }
}

module.exports = CommunityAdapter;