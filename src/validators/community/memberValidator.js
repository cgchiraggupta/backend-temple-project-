const { body, param } = require('express-validator');

const addMemberValidator = [
  param('id')
    .isUUID()
    .withMessage('Invalid community ID'),
  
  body('user_id')
    .notEmpty()
    .withMessage('User ID is required')
    .isUUID()
    .withMessage('Invalid user ID format'),
  
  body('role')
    .optional()
    .isIn(['lead', 'member'])
    .withMessage('Invalid role value')
];

const updateMemberRoleValidator = [
  param('id')
    .isUUID()
    .withMessage('Invalid community ID'),
  
  param('userId')
    .isUUID()
    .withMessage('Invalid user ID'),
  
  body('role')
    .notEmpty()
    .withMessage('Role is required')
    .isIn(['lead', 'member'])
    .withMessage('Invalid role value')
];

const updateMemberStatusValidator = [
  param('id')
    .isUUID()
    .withMessage('Invalid community ID'),
  
  param('userId')
    .isUUID()
    .withMessage('Invalid user ID'),
  
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['active', 'inactive', 'pending', 'suspended'])
    .withMessage('Invalid status value')
];

const importMembersValidator = [
  param('id')
    .isUUID()
    .withMessage('Invalid community ID'),
  
  body('members')
    .isArray({ min: 1 })
    .withMessage('Members array is required and must not be empty'),
  
  body('members.*.email')
    .isEmail()
    .withMessage('Valid email is required for each member'),
  
  body('members.*.role')
    .optional()
    .isIn(['lead', 'member'])
    .withMessage('Invalid role value')
];

module.exports = {
  addMemberValidator,
  updateMemberRoleValidator,
  updateMemberStatusValidator,
  importMembersValidator
};
