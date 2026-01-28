const { PERMISSIONS, ROLES } = require('../config/constants');

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required' });
  next();
}

function allowRoles(allowed = []) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required' });
    if (req.user.roles.includes(ROLES.ADMIN)) return next();
    const has = req.user.roles.some(r => allowed.includes(r));
    if (!has) return res.status(403).json({ success: false, message: 'Forbidden' });
    next();
  };
}

module.exports = {
  requireAuth,
  allowRoles,
  PERMISSIONS,
  ROLES
};


