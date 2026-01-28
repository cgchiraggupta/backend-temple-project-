// Templates Routes
const express = require('express');
const router = express.Router();
const {
  getTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  toggleTemplateStatus,
  deleteTemplate,
  incrementUsageCount
} = require('../controllers/templates');
const { body } = require('express-validator');

// Validation rules
const templateValidation = [
  body('name')
    .isLength({ min: 1, max: 200 })
    .withMessage('Name must be between 1 and 200 characters')
    .trim(),
  body('type')
    .isIn(['email', 'sms', 'push', 'whatsapp'])
    .withMessage('Invalid template type'),
  body('subject')
    .optional()
    .trim(),
  body('content')
    .isLength({ min: 1, max: 10000 })
    .withMessage('Content must be between 1 and 10000 characters'),
  body('category')
    .optional()
    .isIn(['welcome', 'event', 'donation', 'volunteer', 'general'])
    .withMessage('Invalid category'),
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean')
];

// Routes
router.get('/', getTemplates);
router.get('/:id', getTemplateById);
router.post('/', templateValidation, createTemplate);
router.put('/:id', templateValidation, updateTemplate);
router.post('/:id/toggle', toggleTemplateStatus);
router.post('/:id/usage', incrementUsageCount);
router.delete('/:id', deleteTemplate);

module.exports = router;
