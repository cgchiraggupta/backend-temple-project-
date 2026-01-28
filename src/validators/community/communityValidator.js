const { body, param, query } = require('express-validator');

const createCommunityValidator = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Community name is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Name must be between 3 and 100 characters'),
  
  body('slug')
    .trim()
    .notEmpty()
    .withMessage('Slug is required')
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Slug must contain only lowercase letters, numbers, and hyphens'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
  
  body('owner_id')
    .notEmpty()
    .withMessage('Owner ID is required')
    .isUUID()
    .withMessage('Invalid owner ID format'),
  
  body('settings.public_visible')
    .optional()
    .isBoolean()
    .withMessage('public_visible must be a boolean'),
  
  body('settings.allow_join_requests')
    .optional()
    .isBoolean()
    .withMessage('allow_join_requests must be a boolean')
];

const updateCommunityValidator = [
  param('id')
    .isUUID()
    .withMessage('Invalid community ID'),
  
  body('name')
    .optional()
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Name must be between 3 and 100 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
  
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'archived'])
    .withMessage('Invalid status value')
];

const getCommunityValidator = [
  param('id')
    .isUUID()
    .withMessage('Invalid community ID')
];

const listCommunitiesValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('status')
    .optional()
    .isIn(['active', 'inactive', 'archived'])
    .withMessage('Invalid status value'),
  
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search query too long')
];

module.exports = {
  createCommunityValidator,
  updateCommunityValidator,
  getCommunityValidator,
  listCommunitiesValidator
};
