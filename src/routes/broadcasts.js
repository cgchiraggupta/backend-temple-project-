// Broadcasts Routes
const express = require('express');
const router = express.Router();
const {
  getBroadcasts,
  getBroadcastById,
  createBroadcast,
  updateBroadcast,
  sendBroadcast,
  cancelBroadcast,
  deleteBroadcast,
  getBroadcastStats
} = require('../controllers/broadcasts');
const { body } = require('express-validator');

// Validation rules
const broadcastValidation = [
  body('channel')
    .isIn(['email', 'sms', 'push', 'whatsapp'])
    .withMessage('Invalid channel'),
  body('audience_type')
    .isIn(['all_users', 'community_members', 'donors', 'volunteers', 'event_attendees', 'custom'])
    .withMessage('Invalid audience type'),
  body('subject')
    .optional()
    .trim(),
  body('content')
    .isLength({ min: 1, max: 10000 })
    .withMessage('Content must be between 1 and 10000 characters'),
  body('scheduled_at')
    .optional()
    .isISO8601()
    .withMessage('Valid scheduled date is required'),
  body('template_id')
    .optional()
    .isMongoId()
    .withMessage('Valid template ID is required')
];

// Routes
router.get('/', getBroadcasts);
router.get('/stats', getBroadcastStats);
router.get('/:id', getBroadcastById);
router.post('/', broadcastValidation, createBroadcast);
router.put('/:id', broadcastValidation, updateBroadcast);
router.post('/:id/send', sendBroadcast);
router.post('/:id/cancel', cancelBroadcast);
router.delete('/:id', deleteBroadcast);

module.exports = router;
