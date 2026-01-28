// Hybrid User Service - Saves to both memory and attempts Supabase
const { randomUUID } = require('crypto');
const supabaseService = require('./supabaseService');

// In-memory storage as fallback
const users = new Map();
const usersByEmail = new Map();

class HybridUserService {

  // Priority order for determining primary role
  static ROLE_PRIORITY = ['admin', 'board', 'chair_board', 'chairman', 'community_owner', 'volunteer_head', 'finance_team', 'priest', 'community_lead', 'community_member', 'volunteer', 'user'];

  static getPrimaryRole(roles) {
    if (!roles || !Array.isArray(roles) || roles.length === 0) return 'user';
    for (const priorityRole of this.ROLE_PRIORITY) {
      if (roles.includes(priorityRole)) return priorityRole;
    }
    return roles[0] || 'user';
  }

  static async createUser(userData) {
    const userId = randomUUID();
    const now = new Date().toISOString();

    // Handle both 'role' (string) and 'roles' (array) inputs for backward compatibility
    let roles = userData.roles;
    if (!roles || !Array.isArray(roles) || roles.length === 0) {
      roles = userData.role ? [userData.role] : ['user'];
    }
    const primaryRole = this.getPrimaryRole(roles);

    // Normalize email - for Gmail, remove dots from local part for consistency
    const normalizedEmail = this.normalizeGmailAddress(userData.email);
    console.log('📧 Email normalization - input:', userData.email, '| stored as:', normalizedEmail);

    const user = {
      id: userId,
      email: normalizedEmail,
      full_name: userData.full_name,
      phone: userData.phone || null,
      avatar_url: userData.avatar_url || null,
      status: userData.status || 'active',
      role: primaryRole, // Primary role for backward compatibility
      roles: roles, // Full list of roles
      metadata: { ...(userData.metadata || {}), roles: roles }, // Store roles in metadata for Supabase
      preferences: userData.preferences || {
        notifications: { push: true, email: true, whatsapp: true }
      },
      created_at: now,
      updated_at: now,
      last_login_at: null,
      password_hash: userData.password_hash
    };

    // CRITICAL: Save to Supabase FIRST (mandatory - must succeed)
    let supabaseUser = null;
    try {
      console.log('💾 Attempting to save user to Supabase:', user.email);
      supabaseUser = await supabaseService.createUser(user);

      if (!supabaseUser) {
        throw new Error('Supabase returned null - user was not created');
      }

      console.log('✅ User saved to Supabase successfully:', supabaseUser.id);

      // Verify user exists in database
      const { data: verifyUser, error: verifyError } = await supabaseService.client
        .from('users')
        .select('id, email')
        .eq('id', supabaseUser.id)
        .single();

      if (verifyError || !verifyUser) {
        console.error('❌ User verification failed:', verifyError);
        throw new Error('User was not found in database after creation');
      }

      console.log('✅ User verified in database:', verifyUser.email);

    } catch (error) {
      console.error('❌ CRITICAL: Supabase save FAILED:', error.message);
      console.error('❌ User will NOT be created - database persistence required');
      // DO NOT save to memory if Supabase fails - this causes the "phantom user" bug
      throw new Error(`Failed to create user in database: ${error.message}`);
    }

    // Only save to memory cache AFTER successful Supabase save
    users.set(userId, { ...user, id: supabaseUser.id });
    usersByEmail.set(user.email, { ...user, id: supabaseUser.id });
    console.log('✅ User also cached in memory:', user.email);

    return { ...user, id: supabaseUser.id };
  }

  // Helper to normalize user data with roles array
  static normalizeUserData(user) {
    if (!user) return null;
    // Extract roles from metadata, or default to [role]
    const roles = user.metadata?.roles ||
      (user.roles && Array.isArray(user.roles) ? user.roles : null) ||
      (user.role ? [user.role] : ['user']);
    return {
      ...user,
      roles: roles,
      role: user.role || this.getPrimaryRole(roles)
    };
  }

  // Helper to normalize Gmail addresses (remove dots from local part)
  static normalizeGmailAddress(email) {
    const emailLower = email.toLowerCase().trim();
    const [localPart, domain] = emailLower.split('@');

    // Only normalize for Gmail addresses
    if (domain === 'gmail.com' || domain === 'googlemail.com') {
      // Gmail ignores dots in the local part (before any + alias)
      const [mainPart, aliasPart] = localPart.split('+');
      const normalizedMain = mainPart.replace(/\./g, '');
      return aliasPart ? `${normalizedMain}+${aliasPart}@${domain}` : `${normalizedMain}@${domain}`;
    }

    return emailLower;
  }

  static async findUserByEmail(email) {
    const emailLower = email.toLowerCase().trim();
    const normalizedEmail = this.normalizeGmailAddress(email);

    console.log('🔍 Email lookup - original:', emailLower, '| normalized:', normalizedEmail);

    // Try exact match in Supabase first
    try {
      const { data, error } = await supabaseService.client
        .from('users')
        .select('*')
        .eq('email', emailLower)
        .maybeSingle();

      if (!error && data) {
        console.log('✅ User found in Supabase (exact match):', data.email);
        return this.normalizeUserData(data);
      }
    } catch (error) {
      console.log('⚠️ Supabase exact match failed:', error.message);
    }

    // If Gmail, try normalized lookup (search through all Gmail users)
    if (normalizedEmail !== emailLower) {
      try {
        // Get all users with gmail.com domain and check normalized versions
        const { data: gmailUsers, error } = await supabaseService.client
          .from('users')
          .select('*')
          .or('email.ilike.%@gmail.com,email.ilike.%@googlemail.com');

        if (!error && gmailUsers) {
          for (const user of gmailUsers) {
            if (this.normalizeGmailAddress(user.email) === normalizedEmail) {
              console.log('✅ User found in Supabase (Gmail normalized match):', user.email);
              return this.normalizeUserData(user);
            }
          }
        }
      } catch (error) {
        console.log('⚠️ Gmail normalized lookup failed:', error.message);
      }
    }

    // Fallback to memory (exact match)
    const memoryUser = usersByEmail.get(emailLower);
    if (memoryUser) {
      console.log('✅ User found in memory:', memoryUser.email);
      return this.normalizeUserData(memoryUser);
    }

    // Try normalized match in memory for Gmail
    if (normalizedEmail !== emailLower) {
      for (const [storedEmail, user] of usersByEmail.entries()) {
        if (this.normalizeGmailAddress(storedEmail) === normalizedEmail) {
          console.log('✅ User found in memory (Gmail normalized):', user.email);
          return this.normalizeUserData(user);
        }
      }
    }

    return null;
  }

  static async findUserById(id) {
    // Try Supabase first
    try {
      const { data, error } = await supabaseService.client
        .from('users')
        .select('*')
        .eq('id', String(id))
        .maybeSingle();

      if (!error && data) {
        console.log('✅ User found in Supabase by ID:', data.id);
        return this.normalizeUserData(data);
      }

      if (error) {
        console.log('⚠️ Supabase findUserById error:', error.message);
      }
    } catch (error) {
      console.log('⚠️ Supabase query failed, checking memory:', error.message);
    }

    // Fallback to memory
    const memoryUser = users.get(String(id));
    if (memoryUser) {
      console.log('✅ User found in memory by ID:', memoryUser.id);
      return this.normalizeUserData(memoryUser);
    }

    return null;
  }

  static async updateUserLastLogin(id) {
    const now = new Date().toISOString();

    // Update in memory
    const memoryUser = users.get(String(id));
    if (memoryUser) {
      memoryUser.last_login_at = now;
      memoryUser.updated_at = now;
      users.set(String(id), memoryUser);
      usersByEmail.set(memoryUser.email, memoryUser);
    }

    // Attempt to update in Supabase
    try {
      const { data, error } = await supabaseService.client
        .from('users')
        .update({
          last_login_at: now,
          updated_at: now
        })
        .eq('id', String(id))
        .select('*')
        .single();

      if (!error && data) {
        console.log('✅ Login time updated in Supabase');
        return data;
      }
    } catch (error) {
      console.log('⚠️ Supabase update failed (memory updated):', error.message);
    }

    return memoryUser;
  }

  static async getAllUsers() {
    // Try Supabase first
    try {
      const { data, error } = await supabaseService.client
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        console.log('✅ Users loaded from Supabase:', data.length);
        return data;
      }
    } catch (error) {
      console.log('⚠️ Supabase query failed, using memory:', error.message);
    }

    // Fallback to memory
    const memoryUsers = Array.from(users.values());
    console.log('✅ Users loaded from memory:', memoryUsers.length);
    return memoryUsers;
  }

  static async updateUser(id, updateData) {
    const now = new Date().toISOString();

    // Remove password from update data (use changePassword instead)
    const { password, password_hash, ...safeUpdateData } = updateData;

    // First, find the user to ensure they exist
    const existingUser = await this.findUserById(id);
    if (!existingUser) {
      console.log('❌ User not found for update:', id);
      return null;
    }

    // Update in memory
    const memoryUser = users.get(String(id));
    if (memoryUser) {
      Object.assign(memoryUser, safeUpdateData, { updated_at: now });
      users.set(String(id), memoryUser);
      usersByEmail.set(memoryUser.email, memoryUser);
      console.log('✅ User updated in memory:', memoryUser.email);
    }

    // Attempt to update in Supabase
    try {
      const { data, error } = await supabaseService.client
        .from('users')
        .update({
          ...safeUpdateData,
          updated_at: now
        })
        .eq('id', String(id))
        .select('*')
        .maybeSingle();

      if (error) {
        console.log('❌ Supabase update error:', error);
      }

      if (!error && data) {
        console.log('✅ User updated in Supabase:', data.email);
        return data;
      }
    } catch (error) {
      console.log('⚠️ Supabase update failed:', error.message);
    }

    // Return the updated existing user data if Supabase failed
    return memoryUser || { ...existingUser, ...safeUpdateData, updated_at: now };
  }

  static async updateUserPassword(id, hashedPassword) {
    const now = new Date().toISOString();

    // Update in memory
    const memoryUser = users.get(String(id));
    if (memoryUser) {
      memoryUser.password_hash = hashedPassword;
      memoryUser.password_changed_at = now; // For session invalidation
      memoryUser.updated_at = now;
      users.set(String(id), memoryUser);
      usersByEmail.set(memoryUser.email, memoryUser);
      console.log('✅ Password updated in memory');
    }

    // Attempt to update in Supabase
    try {
      const { data, error } = await supabaseService.client
        .from('users')
        .update({
          password_hash: hashedPassword,
          password_changed_at: now, // For session invalidation
          updated_at: now
        })
        .eq('id', String(id))
        .select('id, email')
        .maybeSingle();

      if (error) {
        console.log('⚠️ Supabase password update error:', error.message);
      }

      if (!error && data) {
        console.log('✅ Password updated in Supabase (sessions invalidated)');
        return true;
      }
    } catch (error) {
      console.log('⚠️ Supabase password update failed:', error.message);
    }

    // Return true if we at least updated memory, or if user exists in Supabase
    return true;
  }

  static async deleteUser(id) {
    const userId = String(id);

    // Delete from memory
    const memoryUser = users.get(userId);
    if (memoryUser) {
      users.delete(userId);
      usersByEmail.delete(memoryUser.email);
      console.log('✅ User deleted from memory:', memoryUser.email);
    }

    // Attempt to delete from Supabase
    try {
      const { error } = await supabaseService.client
        .from('users')
        .delete()
        .eq('id', userId);

      if (!error) {
        console.log('✅ User deleted from Supabase');
        return true;
      }
    } catch (error) {
      console.log('⚠️ Supabase delete failed (memory deleted):', error.message);
    }

    return !!memoryUser;
  }
}

module.exports = HybridUserService;