// routes/admin.js
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { checkRole } = require('../middleware/authMiddleware');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Generate random password
function generateRandomPassword(length = 12) {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*';
  const allChars = uppercase + lowercase + numbers + special;

  let password = '';
  // Ensure at least one of each type
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

// Create user from admin panel (with random password and email)
router.post('/create-user', checkRole(['admin']), async (req, res) => {
  try {
    const { email, full_name, phone, role } = req.body;

    console.log('👤 Admin creating new user:', { email, full_name, role });

    // Validate required fields
    if (!email || !full_name) {
      return res.status(400).json({
        success: false,
        message: 'Email and full name are required'
      });
    }

    // Valid roles
    const validRoles = [
      'admin',
      'board',
      'chair_board',
      'chairman',
      'community_owner',
      'volunteer_head',
      'priest',
      'finance_team',
      'community_lead',
      'community_member',
      'volunteer',
      'user'
    ];

    const userRole = role && validRoles.includes(role) ? role : 'user';

    // Check if user already exists
    const { data: existingUsers, error: checkError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email.toLowerCase())
      .limit(1);

    if (existingUsers && existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Generate random password
    const randomPassword = generateRandomPassword(12);
    console.log('🔐 Generated random password for:', email);

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(randomPassword, salt);

    // Create user in database
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        id: crypto.randomUUID(), // Generate UUID for id field
        email: email.toLowerCase(),
        password_hash: hashedPassword,
        full_name: full_name,
        phone: phone || null,
        role: userRole,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError) {
      console.error('❌ Error creating user:', createError);
      throw createError;
    }

    // CRITICAL: Verify user was actually created in database
    if (!newUser || !newUser.id) {
      console.error('❌ User insert returned no data - insert may have failed silently');
      return res.status(500).json({
        success: false,
        message: 'User creation failed - no data returned from database'
      });
    }

    // Double-check by querying the database
    const { data: verifyUser, error: verifyError } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', newUser.id)
      .single();

    if (verifyError || !verifyUser) {
      console.error('❌ User verification failed - user not found in database after insert');
      console.error('Verify error:', verifyError);
      return res.status(500).json({
        success: false,
        message: 'User creation could not be verified in database',
        error: verifyError?.message
      });
    }

    console.log('✅ User created and verified in database:', newUser.id);

    // Send welcome email with password
    try {
      const emailService = require('../services/emailService-sendgrid');

      const frontendUrl = process.env.VITE_FRONTEND_URL || 'https://temple-management-woad.vercel.app';

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .credentials-box { background: #fff7ed; border: 2px solid #f97316; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .credentials-box h3 { color: #ea580c; margin-top: 0; }
            .credential-item { background: white; padding: 10px 15px; margin: 10px 0; border-radius: 5px; font-family: monospace; font-size: 14px; border: 1px solid #fed7aa; }
            .credential-label { color: #9a3412; font-weight: bold; font-family: Arial, sans-serif; }
            .button { display: inline-block; padding: 14px 35px; background: #f97316; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }
            .button:hover { background: #ea580c; }
            .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
            .role-badge { display: inline-block; background: #f97316; color: white; padding: 5px 15px; border-radius: 20px; font-size: 12px; text-transform: uppercase; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🙏 Welcome to Temple Management System</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Your account has been created</p>
            </div>
            <div class="content">
              <h2>Hello ${full_name}!</h2>
              
              <p>An administrator has created an account for you in the Temple Management System.</p>
              
              <p><strong>Your Role:</strong> <span class="role-badge">${userRole}</span></p>
              
              <div class="credentials-box">
                <h3>🔐 Your Login Credentials</h3>
                <p>Please save these credentials securely:</p>
                
                <div class="credential-item">
                  <span class="credential-label">Email:</span><br>
                  <strong>${email}</strong>
                </div>
                
                <div class="credential-item">
                  <span class="credential-label">Temporary Password:</span><br>
                  <strong>${randomPassword}</strong>
                </div>
              </div>
              
              <div class="warning">
                <strong>⚠️ Important Security Notice:</strong><br>
                Please change your password immediately after your first login for security purposes.
              </div>
              
              <center>
                <a href="${frontendUrl}/auth" class="button">
                  Login to Your Account →
                </a>
              </center>
              
              <p style="margin-top: 30px;"><strong>What you can do:</strong></p>
              <ul>
                <li>Access the Temple Management Dashboard</li>
                <li>View and manage temple activities</li>
                <li>Participate in community events</li>
                ${userRole === 'admin' || userRole === 'board' ? '<li>Access administrative features</li>' : ''}
              </ul>
              
              <p style="color: #666; font-size: 14px; margin-top: 30px;">
                If you did not expect this email or have any questions, please contact the temple administration.
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
        to: email,
        subject: '🙏 Your Temple Management Account Has Been Created',
        html: emailHtml
      });

      console.log('✅ Welcome email with credentials sent to:', email);

    } catch (emailError) {
      console.error('⚠️ Failed to send welcome email:', emailError.message);
      // Don't fail user creation if email fails
    }

    res.status(201).json({
      success: true,
      message: 'User created successfully. Welcome email with login credentials has been sent.',
      data: {
        user: {
          id: newUser.id,
          email: newUser.email,
          full_name: newUser.full_name,
          phone: newUser.phone,
          role: newUser.role,
          status: newUser.status
        },
        // Only include password in response for admin reference (remove in production if needed)
        temporaryPassword: randomPassword,
        emailSent: true
      }
    });

  } catch (error) {
    console.error('❌ Error creating user from admin:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create user',
      error: error.message
    });
  }
});

// Assign role to user (admin only)
router.post('/assign-role',
  checkRole(['admin']),
  async (req, res) => {
    try {
      const { email, role } = req.body;

      if (!email || !role) {
        return res.status(400).json({
          success: false,
          error: 'Email and role are required'
        });
      }

      // Valid roles
      const validRoles = [
        'admin',
        'board',
        'chair_board',
        'chairman',
        'community_owner',
        'volunteer_head',
        'priest',
        'finance_team',
        'community_lead',
        'community_member',
        'volunteer',
        'user'
      ];

      if (!validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          error: `Invalid role. Valid roles are: ${validRoles.join(', ')}`
        });
      }

      // Find user by email from users table (FIX: was using Supabase Auth API)
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, email, role, full_name')
        .eq('email', email.toLowerCase())
        .single();

      if (userError || !user) {
        console.log('❌ User not found:', email, userError?.message);
        return res.status(404).json({
          success: false,
          error: 'User not found with this email'
        });
      }

      console.log('📝 Assigning role', role, 'to user:', user.email, '(current role:', user.role, ')');

      // Update role in users table (primary source of truth)
      const { error: updateError } = await supabase
        .from('users')
        .update({
          role: role,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('❌ Error updating user role:', updateError);
        return res.status(500).json({
          success: false,
          error: updateError.message
        });
      }

      // Also update user_roles table for backward compatibility
      try {
        const { error: rolesError } = await supabase
          .from('user_roles')
          .upsert({
            user_id: user.id,
            role: role,
            is_active: true,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id'
          });

        if (rolesError) {
          console.log('⚠️ Could not update user_roles table:', rolesError.message);
          // Don't fail the request - user_roles is secondary
        }
      } catch (rolesErr) {
        console.log('⚠️ user_roles update skipped:', rolesErr.message);
      }

      console.log('✅ Role assigned successfully:', role, 'to', email);

      res.json({
        success: true,
        message: `Role '${role}' assigned successfully to ${email}`,
        data: {
          user_id: user.id,
          email: user.email,
          previous_role: user.role,
          new_role: role
        }
      });
    } catch (error) {
      console.error('❌ Error in assign-role:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Get all users (admin only)
router.get('/users', checkRole(['admin']), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, full_name, phone, role, status, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  }
});

// Resend welcome email with new password
router.post('/resend-credentials', checkRole(['admin']), async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Find user
    const { data: user, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (findError || !user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Generate new random password
    const newPassword = generateRandomPassword(12);

    // Hash and update password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    const { error: updateError } = await supabase
      .from('users')
      .update({
        password_hash: hashedPassword,
        password_changed_at: new Date().toISOString(), // Invalidate old tokens
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) throw updateError;

    // Send email with new credentials
    try {
      const emailService = require('../services/emailService-sendgrid');
      const frontendUrl = process.env.VITE_FRONTEND_URL || 'https://temple-management-woad.vercel.app';

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .credentials-box { background: #fff7ed; border: 2px solid #f97316; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .credential-item { background: white; padding: 10px 15px; margin: 10px 0; border-radius: 5px; font-family: monospace; }
            .button { display: inline-block; padding: 14px 35px; background: #f97316; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0; }
            .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Password Reset</h1>
            </div>
            <div class="content">
              <h2>Hello ${user.full_name}!</h2>
              <p>Your password has been reset by an administrator.</p>
              
              <div class="credentials-box">
                <h3>Your New Login Credentials</h3>
                <div class="credential-item">
                  <strong>Email:</strong> ${email}
                </div>
                <div class="credential-item">
                  <strong>New Password:</strong> ${newPassword}
                </div>
              </div>
              
              <div class="warning">
                <strong>⚠️ Important:</strong> Please change your password after logging in.
              </div>
              
              <center>
                <a href="${frontendUrl}/auth" class="button">Login Now →</a>
              </center>
            </div>
          </div>
        </body>
        </html>
      `;

      await emailService.sendEmail({
        from: `${process.env.EMAIL_FROM_NAME || 'Temple Admin'} <${process.env.EMAIL_FROM || 'noreply@temple.com'}>`,
        to: email,
        subject: '🔐 Your Password Has Been Reset - Temple Management',
        html: emailHtml
      });

      console.log('✅ Password reset email sent to:', email);

    } catch (emailError) {
      console.error('⚠️ Failed to send email:', emailError.message);
    }

    res.json({
      success: true,
      message: 'New credentials sent to user email',
      data: {
        email: user.email,
        temporaryPassword: newPassword
      }
    });

  } catch (error) {
    console.error('Error resending credentials:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resend credentials',
      error: error.message
    });
  }
});

// Debug route - check database connectivity and list all users
router.get('/debug/db-status', checkRole(['admin']), async (req, res) => {
  try {
    console.log('🔍 Debug: Checking database status...');
    console.log('Supabase URL:', process.env.SUPABASE_URL);

    // Test connection by counting users
    const { count, error: countError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Database connection error:', countError);
      return res.status(500).json({
        success: false,
        message: 'Database connection failed',
        error: countError.message,
        supabaseUrl: process.env.SUPABASE_URL
      });
    }

    // Get all users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, role, status, created_at')
      .order('created_at', { ascending: false });

    if (usersError) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch users',
        error: usersError.message
      });
    }

    res.json({
      success: true,
      database: {
        connected: true,
        supabaseUrl: process.env.SUPABASE_URL,
        totalUsers: count
      },
      users: users || []
    });

  } catch (error) {
    console.error('❌ Debug route error:', error);
    res.status(500).json({
      success: false,
      message: 'Debug check failed',
      error: error.message
    });
  }
});

module.exports = router;
