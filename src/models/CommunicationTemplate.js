// Communication Template Model
const mongoose = require('mongoose');

const communicationTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['email', 'sms', 'push', 'whatsapp'],
    required: true
  },
  subject: {
    type: String,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  variables: [{
    name: {
      type: String,
      required: true
    },
    description: {
      type: String,
      trim: true
    },
    default_value: {
      type: String
    }
  }],
  is_active: {
    type: Boolean,
    default: true
  },
  category: {
    type: String,
    enum: ['welcome', 'event', 'donation', 'volunteer', 'general'],
    default: 'general'
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  usage_count: {
    type: Number,
    default: 0
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
communicationTemplateSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

// Indexes for better query performance
communicationTemplateSchema.index({ type: 1 });
communicationTemplateSchema.index({ is_active: 1 });
communicationTemplateSchema.index({ category: 1 });
communicationTemplateSchema.index({ created_by: 1 });

module.exports = mongoose.model('CommunicationTemplate', communicationTemplateSchema);
