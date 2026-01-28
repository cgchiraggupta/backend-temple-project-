// Puja Series Model
const mongoose = require('mongoose');

const pujaSeriesSchema = new mongoose.Schema({
  community_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Community',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  deity: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    enum: ['aarti', 'havan', 'puja', 'special_ceremony', 'festival', 'other'],
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'cancelled', 'draft'],
    default: 'active'
  },
  schedule_config: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  start_date: {
    type: Date,
    required: true
  },
  end_date: {
    type: Date
  },
  max_participants: {
    type: Number,
    min: 1
  },
  registration_required: {
    type: Boolean,
    default: false
  },
  priest_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  location: {
    type: String,
    trim: true
  },
  duration_minutes: {
    type: Number,
    default: 60,
    min: 15
  },
  requirements: [{
    type: String,
    trim: true
  }],
  notes: {
    type: String,
    trim: true
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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
pujaSeriesSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

// Indexes for better query performance
pujaSeriesSchema.index({ community_id: 1 });
pujaSeriesSchema.index({ status: 1 });
pujaSeriesSchema.index({ type: 1 });
pujaSeriesSchema.index({ start_date: 1 });
pujaSeriesSchema.index({ priest_id: 1 });

module.exports = mongoose.model('PujaSeries', pujaSeriesSchema);
