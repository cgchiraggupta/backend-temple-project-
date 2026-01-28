// models/EmailLog.js
const mongoose = require('mongoose');

const emailLogSchema = new mongoose.Schema({
  community_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Community',
    index: true
  },
  sent_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipients: [{
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    email: String,
    status: {
      type: String,
      enum: ['sent', 'delivered', 'failed', 'bounced'],
      default: 'sent'
    }
  }],
  subject: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  email_type: {
    type: String,
    enum: ['announcement', 'invitation', 'reminder', 'welcome', 'custom'],
    default: 'custom'
  },
  sent_at: {
    type: Date,
    default: Date.now,
    index: true
  },
  metadata: mongoose.Schema.Types.Mixed
}, {
  timestamps: { createdAt: 'sent_at' }
});

emailLogSchema.index({ community_id: 1, sent_at: -1 });

module.exports = mongoose.model('EmailLog', emailLogSchema);
