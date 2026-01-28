const roleService = require('../services/user/roleService');
const ApiResponse = require('../utils/response');

const me = async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Not authenticated' });
    const roles = await roleService.listUserRoles(req.user.id);
    return ApiResponse.success(res, { id: req.user.id, email: req.user.email, roles: roles.map(r => r.role) }, 'Authenticated user');
  } catch (err) {
    next(err);
  }
};

const listUserRoles = async (req, res, next) => {
  try {
    const roles = await roleService.listUserRoles(req.params.userId);
    return ApiResponse.success(res, roles, 'User roles');
  } catch (err) {
    next(err);
  }
};

const assignRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    const data = await roleService.assignRole(req.params.userId, role);
    return ApiResponse.success(res, data, 'Role assigned');
  } catch (err) {
    next(err);
  }
};

const revokeRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    const data = await roleService.revokeRole(req.params.userId, role);
    return ApiResponse.success(res, data, 'Role revoked');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  me,
  listUserRoles,
  assignRole,
  revokeRole
};


