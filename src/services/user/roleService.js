const { supabase, supabaseAdmin } = require('../../config/supabase');

class RoleService {
  async listUserRoles(userId) {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role, is_active')
      .eq('user_id', userId);
    if (error) throw error;
    return data;
  }

  async assignRole(userId, role) {
    // Upsert to avoid duplicates
    const { data, error } = await supabase
      .from('user_roles')
      .upsert({ user_id: userId, role, is_active: true }, { onConflict: 'user_id,role' })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async revokeRole(userId, role) {
    const { data, error } = await supabase
      .from('user_roles')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('role', role)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

module.exports = new RoleService();


