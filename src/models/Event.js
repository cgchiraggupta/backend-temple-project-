// Event Model
const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  community_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Community'
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  location: {
    type: String,
    trim: true
  },
  location_coords: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: [0, 0]
    }
  },
  starts_at: {
    type: Date,
    required: true
  },
  ends_at: {
    type: Date,
    required: true
  },
  timezone: {
    type: String,
    default: 'Asia/Kolkata'
  },
  visibility: {
    type: String,
    enum: ['public', 'community', 'private'],
    default: 'public'
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'cancelled', 'completed'],
    default: 'draft'
  },
  capacity: {
    type: Number,
    min: 1
  },
  registration_required: {
    type: Boolean,
    default: false
  },
  registration_deadline: {
    type: Date
  },
  current_registrations: {
    type: Number,
    default: 0
  },
  is_recurring: {
    type: Boolean,
    default: false
  },
  recurring_pattern: {
    type: String,
    enum: ['none', 'daily', 'weekly', 'monthly', 'yearly'],
    default: 'none'
  },
  recurring_frequency: {
    type: Number,
    default: 1
  },
  recurring_days_of_week: [{
    type: Number,
    min: 0,
    max: 6
  }],
  recurring_day_of_month: {
    type: Number,
    min: 1,
    max: 31
  },
  recurring_week_of_month: {
    type: Number,
    min: 1,
    max: 5
  },
  recurring_end_date: {
    type: Date
  },
  recurring_count: {
    type: Number,
    min: 1
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updated_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  published_at: {
    type: Date
  },
  cancelled_at: {
    type: Date
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
eventSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

// Indexes for better query performance
eventSchema.index({ community_id: 1 });
eventSchema.index({ status: 1 });
eventSchema.index({ starts_at: 1 });
eventSchema.index({ ends_at: 1 });
eventSchema.index({ visibility: 1 });
eventSchema.index({ location: 'text', title: 'text', description: 'text' });
eventSchema.index({ location_coords: '2dsphere' });

module.exports = mongoose.model('Event', eventSchema);
