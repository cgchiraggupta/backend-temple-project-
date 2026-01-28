const supabaseService = require('../supabaseService');
const ActivityLogger = require('../../utils/activityLogger');
const HybridUserService = require('../hybridUserService');
const bcrypt = require('bcryptjs');

class MemberService {
  // Generate a random temporary password
  generateTemporaryPassword(length = 12) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  // Send welcome email to NEW user (with login credentials)
  async sendNewUserWelcomeEmail(memberEmail, memberName, communityName, role, temporaryPassword) {
    try {
      const emailService = require('../emailService-sendgrid');
      const frontendUrl = process.env.VITE_FRONTEND_URL || 'https://temple-management-woad.vercel.app';

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .welcome-box { background: #f0f4ff; border: 2px solid #667eea; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
            .welcome-box h2 { color: #667eea; margin-top: 0; }
            .credentials-box { background: #fff3cd; border: 2px solid #ffc107; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .credentials-box h3 { color: #856404; margin-top: 0; }
            .credential-item { background: white; padding: 10px 15px; margin: 10px 0; border-radius: 5px; font-family: monospace; font-size: 14px; }
            .info-item { background: #f0fdf4; padding: 12px 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #10b981; }
            .button { display: inline-block; padding: 14px 35px; background: #667eea; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }
            .button:hover { background: #5a67d8; }
            .warning { background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 5px; }
            .warning strong { color: #dc2626; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Welcome to Temple Management System!</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Your account has been created</p>
            </div>
            <div class="content">
              <div class="welcome-box">
                <h2>Hello ${memberName}!</h2>
                <p>An account has been created for you and you've been added to <strong>${communityName}</strong></p>
              </div>
              
              <div class="credentials-box">
                <h3>🔐 Your Login Credentials</h3>
                <p>Use these credentials to log in to the Temple Management Portal:</p>
                <div class="credential-item">
                  <strong>📧 Email:</strong> ${memberEmail}
                </div>
                <div class="credential-item">
                  <strong>🔑 Temporary Password:</strong> ${temporaryPassword}
                </div>
              </div>
              
              <div class="warning">
                <strong>⚠️ Important:</strong> Please change your password after your first login for security purposes.
              </div>
              
              <div class="info-item">
                <strong>🏛️ Community:</strong> ${communityName}
              </div>
              
              <div class="info-item">
                <strong>👤 Your Role:</strong> ${role}
              </div>
              
              <center>
                <a href="${frontendUrl}/login" class="button">
                  Login to Your Account →
                </a>
              </center>
              
              <p style="color: #666; font-size: 14px; margin-top: 30px;">
                If you did not expect this email, please contact the temple administrator.
              </p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Temple Management System. All rights reserved.</p>
              <p>This is an automated email. Please do not reply to this message.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await emailService.sendEmail({
        from: `${process.env.EMAIL_FROM_NAME || 'Temple Admin'} <${process.env.EMAIL_FROM || 'noreply@temple.com'}>`,
        to: memberEmail,
        subject: `🎉 Your Temple Management Account - Welcome to ${communityName}!`,
        html: emailHtml
      });

      console.log('✅ New user welcome email with credentials sent to:', memberEmail);
      return true;
    } catch (emailError) {
      console.error('⚠️ Failed to send new user welcome email:', emailError.message);
      return false;
    }
  }

  // Send welcome email to EXISTING user (no credentials, just community welcome)
  async sendMemberWelcomeEmail(memberEmail, memberName, communityName, role) {
    try {
      const emailService = require('../emailService-sendgrid');
      const frontendUrl = process.env.VITE_FRONTEND_URL || 'https://temple-management-woad.vercel.app';

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .welcome-box { background: #ecfdf5; border: 2px solid #10b981; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
            .welcome-box h2 { color: #059669; margin-top: 0; }
            .info-item { background: #f0fdf4; padding: 12px 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #10b981; }
            .button { display: inline-block; padding: 14px 35px; background: #10b981; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }
            .button:hover { background: #059669; }
            .role-badge { display: inline-block; background: #10b981; color: white; padding: 5px 15px; border-radius: 20px; font-size: 12px; text-transform: uppercase; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
            .features { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .features ul { margin: 0; padding-left: 20px; }
            .features li { margin: 8px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Welcome to the Community!</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">You've been added as a member</p>
            </div>
            <div class="content">
              <div class="welcome-box">
                <h2>Hello ${memberName}!</h2>
                <p>You have been added to <strong>${communityName}</strong></p>
              </div>
              
              <div class="info-item">
                <strong>🏛️ Community:</strong> ${communityName}
              </div>
              
              <div class="info-item">
                <strong>👤 Your Role:</strong> <span class="role-badge">${role}</span>
              </div>
              
              <div class="info-item">
                <strong>📧 Your Email:</strong> ${memberEmail}
              </div>
              
              <div class="features">
                <h3 style="margin-top: 0;">🌟 What you can do:</h3>
                <ul>
                  <li>View community events and activities</li>
                  <li>Participate in community discussions</li>
                  <li>Access community resources</li>
                  <li>Connect with other members</li>
                  <li>Stay updated with announcements</li>
                </ul>
              </div>
              
              <center>
                <a href="${frontendUrl}/communities" class="button">
                  View Your Community →
                </a>
              </center>
              
              <p style="color: #666; font-size: 14px; margin-top: 30px;">
                If you have any questions, please contact the community administrator.
              </p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Temple Management System. All rights reserved.</p>
              <p>This is an automated email. Please do not reply to this message.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await emailService.sendEmail({
        from: `${process.env.EMAIL_FROM_NAME || 'Temple Admin'} <${process.env.EMAIL_FROM || 'noreply@temple.com'}>`,
        to: memberEmail,
        subject: `🎉 Welcome to ${communityName}!`,
        html: emailHtml
      });

      console.log('✅ Welcome email sent to new member:', memberEmail);
      return true;
    } catch (emailError) {
      console.error('⚠️ Failed to send member welcome email:', emailError.message);
      return false;
    }
  }

  // Add member to community - NOW ALSO CREATES USER IF NOT EXISTS
  async addMember(communityId, userId, role = 'member', addedBy, memberInfo = {}) {
    let actualUserId = userId;
    let isNewUser = false;
    let temporaryPassword = null;

    // Check if member already exists in THIS community by user_id or email
    let existingMember = null;
    if (userId) {
      const { data } = await supabaseService.client
        .from('community_members')
        .select('*')
        .eq('community_id', communityId)
        .eq('user_id', userId)
        .single();
      existingMember = data;
    } else if (memberInfo.email) {
      const { data } = await supabaseService.client
        .from('community_members')
        .select('*')
        .eq('community_id', communityId)
        .eq('email', memberInfo.email.toLowerCase())
        .single();
      existingMember = data;
    }

    if (existingMember) {
      throw new Error('User is already a member of this community');
    }

    // If no user_id provided and we have an email, check if user exists or create one
    if (!actualUserId && memberInfo.email) {
      console.log('🔍 Checking if user exists with email:', memberInfo.email);

      const existingUser = await HybridUserService.findUserByEmail(memberInfo.email);

      if (existingUser) {
        console.log('✅ Found existing user:', existingUser.id);
        actualUserId = existingUser.id;
      } else {
        console.log('📝 Creating new user account for:', memberInfo.email);

        // Generate temporary password
        temporaryPassword = this.generateTemporaryPassword();
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(temporaryPassword, salt);

        // Create new user
        const newUser = await HybridUserService.createUser({
          email: HybridUserService.normalizeGmailAddress(memberInfo.email),
          full_name: memberInfo.name || memberInfo.full_name || 'Community Member',
          phone: memberInfo.phone || null,
          password_hash: hashedPassword,
          role: 'user', // Portal access role
          status: 'active',
          metadata: {
            skills: memberInfo.skills ? memberInfo.skills.split(',').map(s => s.trim()) : [],
            about: memberInfo.experience || '',
            why_join: memberInfo.why_join || ''
          }
        });

        actualUserId = newUser.id;
        isNewUser = true;
        console.log('✅ New user created:', newUser.id, newUser.email);
      }
    }

    // Get community name for email
    let communityName = 'the community';
    try {
      const { data: community } = await supabaseService.client
        .from('communities')
        .select('name')
        .eq('id', communityId)
        .single();
      if (community) {
        communityName = community.name;
      }
    } catch (e) {
      console.log('Could not fetch community name:', e.message);
    }

    // Prepare member data
    const memberData = {
      community_id: communityId,
      user_id: actualUserId || null,
      role: role,
      status: 'active',
      joined_at: new Date().toISOString(),
      full_name: memberInfo.name || memberInfo.full_name || null,
      email: memberInfo.email ? HybridUserService.normalizeGmailAddress(memberInfo.email) : null,
      phone: memberInfo.phone || null,
      // Map application fields to member metadata
      metadata: {
        skills: memberInfo.skills ? memberInfo.skills.split(',').map(s => s.trim()) : [],
        bio: memberInfo.experience || null,
        interests: memberInfo.why_join || null
      }
    };

    console.log('💾 Inserting member data:', memberData);

    const { data, error } = await supabaseService.client
      .from('community_members')
      .insert([memberData])
      .select(`
        *,
        user:users(id, full_name, email, avatar_url, phone)
      `)
      .single();

    if (error) {
      console.error('❌ Insert error:', error);
      throw error;
    }

    console.log('✅ Insert result:', data);

    // Send appropriate welcome email
    const memberEmail = data.email || data.user?.email;
    const memberName = data.full_name || data.user?.full_name || 'Member';

    if (memberEmail) {
      if (isNewUser && temporaryPassword) {
        // Send email with login credentials to new user
        await this.sendNewUserWelcomeEmail(memberEmail, memberName, communityName, role, temporaryPassword);
      } else {
        // Send community welcome email to existing user
        await this.sendMemberWelcomeEmail(memberEmail, memberName, communityName, role);
      }
    }

    // Log activity
    await ActivityLogger.logCommunityActivity(
      communityId,
      addedBy,
      'member_added',
      `Added ${memberName} as ${role}${isNewUser ? ' (new user account created)' : ''}`,
      { member_id: actualUserId, role, is_new_user: isNewUser }
    );

    return {
      ...data,
      is_new_user: isNewUser,
      user_created: isNewUser
    };
  }

  // Remove member from community
  async removeMember(communityId, memberId, removedBy) {
    // Get member info before deletion
    const { data: member } = await supabaseService.client
      .from('community_members')
      .select('*, user:users(full_name)')
      .eq('id', memberId)
      .eq('community_id', communityId)
      .single();

    if (!member) {
      throw new Error('Member not found');
    }

    const memberEmail = member.email;

    const { data, error } = await supabaseService.client
      .from('community_members')
      .delete()
      .eq('id', memberId)
      .eq('community_id', communityId)
      .select()
      .single();

    if (error) throw error;

    // Soft delete the community application (mark as 'deleted' instead of removing)
    if (memberEmail) {
      const { data: updatedApp, error: appError } = await supabaseService.client
        .from('community_applications')
        .update({
          status: 'deleted',
          updated_at: new Date().toISOString()
        })
        .eq('community_id', communityId)
        .eq('email', memberEmail.toLowerCase())
        .select('id')
        .maybeSingle();

      if (!appError && updatedApp) {
        console.log('✅ Community application marked as deleted:', updatedApp.id);
      }
    }


    // Log activity
    const memberName = member.full_name || member.user?.full_name || 'member';
    await ActivityLogger.logCommunityActivity(
      communityId,
      removedBy,
      'member_removed',
      `Removed ${memberName} from community`,
      { member_id: memberId }
    );

    return data;
  }


  // Update member role
  async updateMemberRole(communityId, memberId, newRole, updatedBy) {
    const { data, error } = await supabaseService.client
      .from('community_members')
      .update({ role: newRole })
      .eq('id', memberId)
      .eq('community_id', communityId)
      .select(`
        *,
        user:users(id, full_name, email, avatar_url)
      `)
      .single();

    if (error) throw error;

    // Log activity
    const memberName = data.full_name || data.user?.full_name || 'member';
    await ActivityLogger.logCommunityActivity(
      communityId,
      updatedBy,
      'member_role_updated',
      `Updated ${memberName}'s role to ${newRole}`,
      { member_id: memberId, new_role: newRole }
    );

    return data;
  }

  // Update member info (name, email, phone)
  async updateMember(communityId, memberId, updateData, updatedBy) {
    const allowedFields = ['full_name', 'email', 'phone', 'role', 'status'];
    const filteredData = {};

    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key) && updateData[key] !== undefined) {
        filteredData[key] = updateData[key];
      }
    });

    const { data, error } = await supabaseService.client
      .from('community_members')
      .update(filteredData)
      .eq('id', memberId)
      .eq('community_id', communityId)
      .select(`
        *,
        user:users(id, full_name, email, avatar_url)
      `)
      .single();

    if (error) throw error;

    // Log activity
    const memberName = data.full_name || data.user?.full_name || 'member';
    await ActivityLogger.logCommunityActivity(
      communityId,
      updatedBy,
      'member_updated',
      `Updated ${memberName}'s information`,
      { member_id: memberId, updated_fields: Object.keys(filteredData) }
    );

    return data;
  }

  // Update member status
  async updateMemberStatus(communityId, memberId, newStatus, updatedBy) {
    const { data, error } = await supabaseService.client
      .from('community_members')
      .update({ status: newStatus })
      .eq('id', memberId)
      .eq('community_id', communityId)
      .select(`
        *,
        user:users(id, full_name, email, avatar_url)
      `)
      .single();

    if (error) throw error;

    // Log activity
    const memberName = data.full_name || data.user?.full_name || 'member';
    await ActivityLogger.logCommunityActivity(
      communityId,
      updatedBy,
      'member_status_updated',
      `Updated ${memberName}'s status to ${newStatus}`,
      { member_id: memberId, new_status: newStatus }
    );

    return data;
  }

  // Get community members
  async getCommunityMembers(communityId, filters = {}) {
    const { role, status, search } = filters;

    let query = supabaseService.client
      .from('community_members')
      .select(`
        *,
        user:users(id, full_name, email, avatar_url, phone, status)
      `)
      .eq('community_id', communityId);

    if (role) query = query.eq('role', role);
    if (status) query = query.eq('status', status);

    query = query.order('joined_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    // Merge user data with member data (prefer member table data)
    const members = data.map(member => ({
      ...member,
      full_name: member.full_name || member.user?.full_name || 'Unknown Member',
      email: member.email || member.user?.email || '',
      phone: member.phone || member.user?.phone || '',
      avatar_url: member.user?.avatar_url || null
    }));

    // Filter by search if provided
    if (search && members) {
      return members.filter(member =>
        member.full_name.toLowerCase().includes(search.toLowerCase()) ||
        member.email.toLowerCase().includes(search.toLowerCase())
      );
    }

    return members;
  }

  // Get member details
  async getMemberDetails(communityId, userId) {
    const { data, error } = await supabase
      .from('community_members')
      .select(`
        *,
        user:users(id, full_name, email, avatar_url, phone, status)
      `)
      .eq('community_id', communityId)
      .eq('user_id', userId)
      .single();

    if (error) throw error;

    // Get member's task statistics
    const { data: tasks } = await supabase
      .from('tasks')
      .select('status')
      .eq('community_id', communityId)
      .contains('assignees', [userId]);

    const taskStats = {
      total: tasks?.length || 0,
      completed: tasks?.filter(t => t.status === 'done').length || 0,
      in_progress: tasks?.filter(t => t.status === 'in_progress').length || 0
    };

    // Get member's event registrations
    const { count: eventCount } = await supabase
      .from('event_registrations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    return {
      ...data,
      stats: {
        tasks: taskStats,
        events_attended: eventCount || 0
      }
    };
  }

  // Import members from CSV
  async importMembers(communityId, membersData, importedBy) {
    const results = {
      success: [],
      failed: []
    };

    for (const memberData of membersData) {
      try {
        // Check if user exists by email
        const { data: user } = await supabase
          .from('users')
          .select('id')
          .eq('email', memberData.email)
          .single();

        if (!user) {
          results.failed.push({
            email: memberData.email,
            reason: 'User not found'
          });
          continue;
        }

        // Add member
        await this.addMember(
          communityId,
          user.id,
          memberData.role || 'member',
          importedBy
        );

        results.success.push({
          email: memberData.email,
          user_id: user.id
        });
      } catch (error) {
        results.failed.push({
          email: memberData.email,
          reason: error.message
        });
      }
    }

    // Log activity
    await ActivityLogger.logCommunityActivity(
      communityId,
      importedBy,
      'members_imported',
      `Imported ${results.success.length} members (${results.failed.length} failed)`,
      { results }
    );

    return results;
  }
}

module.exports = new MemberService();
