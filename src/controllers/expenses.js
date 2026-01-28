// Expenses Controller - MongoDB
const Expense = require('../models/Expense');
const { body, validationResult } = require('express-validator');

// Get all expenses with filtering and pagination
const getExpenses = async (req, res) => {
  try {
    const {
      status,
      category,
      community_id,
      start_date,
      end_date,
      page = 1,
      limit = 50
    } = req.query;

    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (category && category !== 'all') {
      query.category = category;
    }

    if (community_id && community_id !== 'all') {
      query.community_id = community_id;
    }

    if (start_date || end_date) {
      query.expense_date = {};
      if (start_date) query.expense_date.$gte = new Date(start_date);
      if (end_date) query.expense_date.$lte = new Date(end_date);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const expenses = await Expense.find(query)
      .populate('community_id', 'name')
      .populate('event_id', 'title')
      .populate('approved_by', 'full_name')
      .populate('created_by', 'full_name')
      .sort({ expense_date: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Expense.countDocuments(query);

    res.json({
      success: true,
      data: expenses,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expenses'
    });
  }
};

// Get expense by ID
const getExpenseById = async (req, res) => {
  try {
    const { id } = req.params;

    const expense = await Expense.findById(id)
      .populate('community_id', 'name')
      .populate('event_id', 'title')
      .populate('approved_by', 'full_name')
      .populate('created_by', 'full_name');

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    res.json({
      success: true,
      data: expense
    });
  } catch (error) {
    console.error('Error fetching expense:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expense'
    });
  }
};

// Create new expense
const createExpense = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const expenseData = {
      ...req.body,
      created_by: req.user?.id || req.body.created_by,
      expense_date: req.body.expense_date || new Date(),
      entry_date: new Date()
    };

    const expense = new Expense(expenseData);
    await expense.save();

    // Populate the created expense
    await expense.populate('community_id', 'name');
    await expense.populate('event_id', 'title');
    await expense.populate('created_by', 'full_name');

    res.status(201).json({
      success: true,
      message: 'Expense created successfully',
      data: expense
    });
  } catch (error) {
    console.error('Error creating expense:', error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Receipt number already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create expense'
    });
  }
};

// Update expense
const updateExpense = async (req, res) => {
  try {
    const { id } = req.params;

    const expense = await Expense.findByIdAndUpdate(
      id,
      {
        ...req.body,
        updated_at: new Date()
      },
      { new: true, runValidators: true }
    ).populate('community_id', 'name')
     .populate('event_id', 'title')
     .populate('approved_by', 'full_name')
     .populate('created_by', 'full_name');

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    res.json({
      success: true,
      message: 'Expense updated successfully',
      data: expense
    });
  } catch (error) {
    console.error('Error updating expense:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update expense'
    });
  }
};

// Approve expense
const approveExpense = async (req, res) => {
  try {
    const { id } = req.params;

    const expense = await Expense.findByIdAndUpdate(
      id,
      {
        status: 'approved',
        approved_by: req.user?.id,
        approved_at: new Date(),
        updated_at: new Date()
      },
      { new: true, runValidators: true }
    ).populate('community_id', 'name')
     .populate('event_id', 'title')
     .populate('approved_by', 'full_name')
     .populate('created_by', 'full_name');

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    res.json({
      success: true,
      message: 'Expense approved successfully',
      data: expense
    });
  } catch (error) {
    console.error('Error approving expense:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve expense'
    });
  }
};

// Reject expense
const rejectExpense = async (req, res) => {
  try {
    const { id } = req.params;

    const expense = await Expense.findByIdAndUpdate(
      id,
      {
        status: 'rejected',
        approved_by: req.user?.id,
        approved_at: new Date(),
        updated_at: new Date()
      },
      { new: true, runValidators: true }
    ).populate('community_id', 'name')
     .populate('event_id', 'title')
     .populate('approved_by', 'full_name')
     .populate('created_by', 'full_name');

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    res.json({
      success: true,
      message: 'Expense rejected successfully',
      data: expense
    });
  } catch (error) {
    console.error('Error rejecting expense:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject expense'
    });
  }
};

// Delete expense
const deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;

    const expense = await Expense.findByIdAndDelete(id);

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    res.json({
      success: true,
      message: 'Expense deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete expense'
    });
  }
};

// Get expense statistics
const getExpenseStats = async (req, res) => {
  try {
    const { community_id, start_date, end_date } = req.query;

    const matchStage = {};

    if (community_id) {
      matchStage.community_id = mongoose.Types.ObjectId(community_id);
    }

    if (start_date || end_date) {
      matchStage.expense_date = {};
      if (start_date) matchStage.expense_date.$gte = new Date(start_date);
      if (end_date) matchStage.expense_date.$lte = new Date(end_date);
    }

    const stats = await Expense.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          totalCount: { $sum: 1 },
          avgAmount: { $avg: '$amount' },
          byCategory: {
            $push: {
              category: '$category',
              amount: '$amount',
              count: 1
            }
          },
          byStatus: {
            $push: {
              status: '$status',
              amount: '$amount',
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
          byCategory: {
            $reduce: {
              input: '$byCategory',
              initialValue: {},
              in: {
                $mergeObjects: [
                  '$$value',
                  {
                    $arrayToObject: [[{
                      k: '$$this.category',
                      v: {
                        amount: { $sum: '$$this.amount' },
                        count: { $sum: '$$this.count' }
                      }
                    }]]
                  }
                ]
              }
            }
          },
          byStatus: {
            $reduce: {
              input: '$byStatus',
              initialValue: {},
              in: {
                $mergeObjects: [
                  '$$value',
                  {
                    $arrayToObject: [[{
                      k: '$$this.status',
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
        byCategory: {},
        byStatus: {}
      }
    });
  } catch (error) {
    console.error('Error fetching expense stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expense statistics'
    });
  }
};

module.exports = {
  getExpenses,
  getExpenseById,
  createExpense,
  updateExpense,
  approveExpense,
  rejectExpense,
  deleteExpense,
  getExpenseStats
};
