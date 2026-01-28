// Expense Model
const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true,
    trim: true
  },
  vendor_name: {
    type: String,
    required: true,
    trim: true
  },
  receipt_number: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'INR'
  },
  category: {
    type: String,
    enum: ['maintenance', 'utilities', 'salaries', 'materials', 'events', 'other'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'paid'],
    default: 'pending'
  },
  approved_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approved_at: {
    type: Date
  },
  expense_date: {
    type: Date,
    required: true
  },
  entry_date: {
    type: Date,
    default: Date.now
  },
  receipt_attached: {
    type: Boolean,
    default: false
  },
  receipt_url: {
    type: String
  },
  notes: {
    type: String,
    trim: true
  },
  community_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Community'
  },
  event_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event'
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
expenseSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

// Indexes for better query performance
expenseSchema.index({ receipt_number: 1 });
expenseSchema.index({ vendor_name: 1 });
expenseSchema.index({ category: 1 });
expenseSchema.index({ status: 1 });
expenseSchema.index({ expense_date: -1 });
expenseSchema.index({ community_id: 1 });
expenseSchema.index({ event_id: 1 });

module.exports = mongoose.model('Expense', expenseSchema);
