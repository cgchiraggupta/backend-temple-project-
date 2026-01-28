// Donations Controller - MongoDB
const Donation = require('../models/Donation');
const { body, validationResult } = require('express-validator');

// Get all donations with filtering and pagination
const getDonations = async (req, res) => {
  try {
    const {
      status,
      source,
      start_date,
      end_date,
      community_id,
      page = 1,
      limit = 50
    } = req.query;

    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (source && source !== 'all') {
      query.source = source;
    }

    if (community_id && community_id !== 'all') {
      query.community_id = community_id;
    }

    if (start_date || end_date) {
      query.received_at = {};
      if (start_date) query.received_at.$gte = new Date(start_date);
      if (end_date) query.received_at.$lte = new Date(end_date);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const donations = await Donation.find(query)
      .populate('community_id', 'name')
      .populate('event_id', 'title')
      .sort({ received_at: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Donation.countDocuments(query);

    res.json({
      success: true,
      data: donations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching donations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch donations'
    });
  }
};

// Get donation by ID
const getDonationById = async (req, res) => {
  try {
    const { id } = req.params;

    const donation = await Donation.findById(id)
      .populate('community_id', 'name')
      .populate('event_id', 'title');

    if (!donation) {
      return res.status(404).json({
        success: false,
        message: 'Donation not found'
      });
    }

    res.json({
      success: true,
      data: donation
    });
  } catch (error) {
    console.error('Error fetching donation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch donation'
    });
  }
};

// Create new donation
const createDonation = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const donationData = {
      ...req.body,
      created_by: req.user?.id || req.body.created_by,
      received_at: req.body.received_at || new Date()
    };

    const donation = new Donation(donationData);
    await donation.save();

    // Populate the created donation
    await donation.populate('community_id', 'name');
    await donation.populate('event_id', 'title');

    res.status(201).json({
      success: true,
      message: 'Donation created successfully',
      data: donation
    });
  } catch (error) {
    console.error('Error creating donation:', error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Receipt number or transaction ID already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create donation'
    });
  }
};

// Update donation
const updateDonation = async (req, res) => {
  try {
    const { id } = req.params;

    const donation = await Donation.findByIdAndUpdate(
      id,
      {
        ...req.body,
        updated_at: new Date()
      },
      { new: true, runValidators: true }
    ).populate('community_id', 'name')
     .populate('event_id', 'title');

    if (!donation) {
      return res.status(404).json({
        success: false,
        message: 'Donation not found'
      });
    }

    res.json({
      success: true,
      message: 'Donation updated successfully',
      data: donation
    });
  } catch (error) {
    console.error('Error updating donation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update donation'
    });
  }
};

// Delete donation
const deleteDonation = async (req, res) => {
  try {
    const { id } = req.params;

    const donation = await Donation.findByIdAndDelete(id);

    if (!donation) {
      return res.status(404).json({
        success: false,
        message: 'Donation not found'
      });
    }

    res.json({
      success: true,
      message: 'Donation deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting donation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete donation'
    });
  }
};

// Get donation statistics
const getDonationStats = async (req, res) => {
  try {
    const { community_id, start_date, end_date } = req.query;

    const matchStage = {};

    if (community_id) {
      matchStage.community_id = mongoose.Types.ObjectId(community_id);
    }

    if (start_date || end_date) {
      matchStage.received_at = {};
      if (start_date) matchStage.received_at.$gte = new Date(start_date);
      if (end_date) matchStage.received_at.$lte = new Date(end_date);
    }

    const stats = await Donation.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$net_amount' },
          totalCount: { $sum: 1 },
          avgAmount: { $avg: '$net_amount' },
          bySource: {
            $push: {
              source: '$source',
              amount: '$net_amount',
              count: 1
            }
          }
        }
      },
      {
        $project: {
          totalAmount: 1,
          totalCount: 1,
          avgAmount: 1,
          bySource: {
            $reduce: {
              input: '$bySource',
              initialValue: {},
              in: {
                $mergeObjects: [
                  '$$value',
                  {
                    $arrayToObject: [[{
                      k: '$$this.source',
                      v: {
                        amount: { $sum: '$$this.amount' },
                        count: { $sum: '$$this.count' }
                      }
                    }]]
                  }
                ]
              }
            }
          }
        }
      }
    ]);

    res.json({
      success: true,
      data: stats[0] || {
        totalAmount: 0,
        totalCount: 0,
        avgAmount: 0,
        bySource: {}
      }
    });
  } catch (error) {
    console.error('Error fetching donation stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch donation statistics'
    });
  }
};

module.exports = {
  getDonations,
  getDonationById,
  createDonation,
  updateDonation,
  deleteDonation,
  getDonationStats
};
