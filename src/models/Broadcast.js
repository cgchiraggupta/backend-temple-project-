// Broadcast Model
const mongoose = require('mongoose');

const broadcastSchema = new mongoose.Schema({
  template_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CommunicationTemplate'
  },
  channel: {
    type: String,
    enum: ['email', 'sms', 'push', 'whatsapp'],
    required: true
  },
  audience_type: {
    type: String,
    enum: ['all_users', 'community_members', 'donors', 'volunteers', 'event_attendees', 'custom'],
    required: true
  },
  audience_filters: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  subject: {
    type: String,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  scheduled_at: {
    type: Date
  },
  sent_at: {
    type: Date
  },
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled'],
    default: 'draft'
  },
  total_recipients: {
    type: Number,
    default: 0
  },
  sent_count: {
    type: Number,
    default: 0
  },
  failed_count: {
    type: Number,
    default: 0
  },
  delivered_count: {
    type: Number,
    default: 0
  },
  opened_count: {
    type: Number,
    default: 0
  },
  clicked_count: {
    type: Number,
    default: 0
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
});

// Update the updated_at field before saving
broadcastSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

// Indexes for better query performance
broadcastSchema.index({ status: 1 });
broadcastSchema.index({ scheduled_at: 1 });
broadcastSchema.index({ created_by: 1 });
broadcastSchema.index({ channel: 1 });

module.exports = mongoose.model('Broadcast', broadcastSchema);
