const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Optional auth middleware - sets req.user if token is valid, but doesn't block
 * Use this for routes that work differently for authenticated vs anonymous users
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.split(' ')[1];

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database
    const user = await User.findById(decoded.id);

    if (!user) {
      req.user = null;
      return next();
    }

    // Session invalidation check: Reject tokens issued before password change
    if (user.password_changed_at && decoded.iat) {
      const passwordChangedAtTimestamp = Math.floor(new Date(user.password_changed_at).getTime() / 1000);

      if (decoded.iat <= passwordChangedAtTimestamp) {
        console.log('❌ Token invalidated (optional auth): issued before password change');
        req.user = null;
        return next();
      }
    }

    // Use roles from user data if available, otherwise fallback to [role]
    const roles = user.roles || (user.role ? [user.role] : ['user']);
    req.user = {
      id: user.id || user._id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      roles: roles
    };

    console.log('✅ Auth middleware: User authenticated:', req.user.email);
    next();
  } catch (error) {
    console.error('❌ Auth middleware error:', error.message);
    req.user = null;
    next();
  }
};

/**
 * Required auth middleware - BLOCKS requests without valid token
 * Use this for protected routes that require authentication
 */
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const token = authHeader.split(' ')[1];

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. User not found.'
      });
    }

    // Session invalidation check: Reject tokens issued before password change
    // The 'iat' (issued at) claim in JWT is in seconds, password_changed_at is a Date
    if (user.password_changed_at && decoded.iat) {
      const passwordChangedAtTimestamp = Math.floor(new Date(user.password_changed_at).getTime() / 1000);

      // Use <= to handle same-second edge case (tokens issued at or before password change are invalid)
      if (decoded.iat <= passwordChangedAtTimestamp) {
        console.log('❌ Token invalidated: issued before password change');
        console.log(`   Token iat: ${decoded.iat}, Password changed: ${passwordChangedAtTimestamp}`);
        return res.status(401).json({
          success: false,
          message: 'Access denied. Your password was changed. Please login again.'
        });
      }
    }

    // Use roles from user data if available, otherwise fallback to [role]
    const roles = user.roles || (user.role ? [user.role] : ['user']);
    req.user = {
      id: user.id || user._id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      roles: roles
    };

    console.log('✅ Auth required: User authenticated:', req.user.email);
    next();
  } catch (error) {
    console.error('❌ Auth required error:', error.message);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Invalid token.'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Token expired.'
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Access denied. Authentication failed.'
    });
  }
};

/**
 * Role-based auth middleware - requires specific roles
 * Usage: requireRole(['admin', 'board'])
 */
const requireRole = (allowedRoles) => {
  return async (req, res, next) => {
    // First, ensure user is authenticated
    await requireAuth(req, res, () => {
      if (!req.user) {
        return; // requireAuth already sent response
      }

      // Check if user has ANY of the required roles (multi-role support)
      const hasAccess = req.user.roles.some(r => allowedRoles.includes(r));
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required role: ${allowedRoles.join(' or ')}`
        });
      }

      next();
    });
  };
};

module.exports = authMiddleware;
module.exports.requireAuth = requireAuth;
module.exports.requireRole = requireRole;
module.exports.checkRole = requireRole; // Alias for backward compatibility
