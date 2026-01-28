// Donation Model
const mongoose = require('mongoose');

const donationSchema = new mongoose.Schema({
  receipt_number: {
    type: String,
    required: true,
    unique: true
  },
  transaction_id: {
    type: String,
    required: true
  },
  donor_name: {
    type: String,
    trim: true
  },
  donor_email: {
    type: String,
    trim: true,
    lowercase: true
  },
  donor_phone: {
    type: String,
    trim: true
  },
  gross_amount: {
    type: Number,
    required: true,
    min: 0
  },
  provider_fees: {
    type: Number,
    default: 0,
    min: 0
  },
  net_amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'INR'
  },
  source: {
    type: String,
    enum: ['web', 'hundi', 'in-temple', 'bank-transfer'],
    required: true
  },
  provider: {
    type: String,
    enum: ['stripe', 'razorpay', 'manual', 'other'],
    required: true
  },
  payment_method: {
    type: String,
    enum: ['card', 'upi', 'netbanking', 'wallet', 'cash', 'cheque'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded', 'cancelled'],
    default: 'pending'
  },
  received_at: {
    type: Date,
    default: Date.now
  },
  reconciled: {
    type: Boolean,
    default: false
  },
  community_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Community'
  },
  event_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event'
  },
  notes: {
    type: String,
    trim: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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
donationSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

// Indexes for better query performance
donationSchema.index({ transaction_id: 1 });
donationSchema.index({ donor_email: 1 });
donationSchema.index({ status: 1 });
donationSchema.index({ received_at: -1 });
donationSchema.index({ community_id: 1 });
donationSchema.index({ event_id: 1 });

module.exports = mongoose.model('Donation', donationSchema);
