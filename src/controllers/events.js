// Events Controller - MongoDB
const Event = require('../models/Event');
const { body, validationResult } = require('express-validator');

// Get all events with filtering and pagination
const getEvents = async (req, res) => {
  try {
    const {
      community_id,
      status,
      type,
      start_date,
      end_date,
      page = 1,
      limit = 50
    } = req.query;

    const query = {};

    if (community_id && community_id !== 'all') {
      query.community_id = community_id;
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (start_date || end_date) {
      query.starts_at = {};
      if (start_date) query.starts_at.$gte = new Date(start_date);
      if (end_date) query.starts_at.$lte = new Date(end_date);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const events = await Event.find(query)
      .populate('community_id', 'name')
      .populate('created_by', 'full_name')
      .sort({ starts_at: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Event.countDocuments(query);

    res.json({
      success: true,
      data: events,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch events'
    });
  }
};

// Get event by ID
const getEventById = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findById(id)
      .populate('community_id', 'name')
      .populate('created_by', 'full_name');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    res.json({
      success: true,
      data: event
    });
  } catch (error) {
    console.error('Error fetching event:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch event'
    });
  }
};

// Create new event
const createEvent = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const eventData = {
      ...req.body,
      created_by: req.user?.id || req.body.created_by,
      starts_at: req.body.starts_at || new Date(),
      ends_at: req.body.ends_at || new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours default
      status: 'draft',
      timezone: 'Asia/Kolkata',
      is_recurring: false
    };

    const event = new Event(eventData);
    await event.save();

    // Populate the created event
    await event.populate('community_id', 'name');
    await event.populate('created_by', 'full_name');

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: event
    });
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create event'
    });
  }
};

// Update event
const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findByIdAndUpdate(
      id,
      {
        ...req.body,
        updated_by: req.user?.id,
        updated_at: new Date()
      },
      { new: true, runValidators: true }
    ).populate('community_id', 'name')
     .populate('created_by', 'full_name');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    res.json({
      success: true,
      message: 'Event updated successfully',
      data: event
    });
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update event'
    });
  }
};

// Publish event
const publishEvent = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findByIdAndUpdate(
      id,
      {
        status: 'published',
        published_at: new Date(),
        updated_by: req.user?.id,
        updated_at: new Date()
      },
      { new: true, runValidators: true }
    ).populate('community_id', 'name')
     .populate('created_by', 'full_name');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    res.json({
      success: true,
      message: 'Event published successfully',
      data: event
    });
  } catch (error) {
    console.error('Error publishing event:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish event'
    });
  }
};

// Cancel event
const cancelEvent = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findByIdAndUpdate(
      id,
      {
        status: 'cancelled',
        cancelled_at: new Date(),
        updated_by: req.user?.id,
        updated_at: new Date()
      },
      { new: true, runValidators: true }
    ).populate('community_id', 'name')
     .populate('created_by', 'full_name');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    res.json({
      success: true,
      message: 'Event cancelled successfully',
      data: event
    });
  } catch (error) {
    console.error('Error cancelling event:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel event'
    });
  }
};

// Delete event
const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findByIdAndDelete(id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    res.json({
      success: true,
      message: 'Event deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete event'
    });
  }
};

// Get event statistics
const getEventStats = async (req, res) => {
  try {
    const { community_id, start_date, end_date } = req.query;

    const matchStage = {};

    if (community_id) {
      matchStage.community_id = mongoose.Types.ObjectId(community_id);
    }

    if (start_date || end_date) {
      matchStage.starts_at = {};
      if (start_date) matchStage.starts_at.$gte = new Date(start_date);
      if (end_date) matchStage.starts_at.$lte = new Date(end_date);
    }

    const stats = await Event.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalEvents: { $sum: 1 },
          publishedEvents: {
            $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] }
          },
          draftEvents: {
            $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] }
          },
          cancelledEvents: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
          },
          completedEvents: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          totalCapacity: { $sum: '$capacity' },
          totalRegistrations: { $sum: '$current_registrations' }
        }
      }
    ]);

    res.json({
      success: true,
      data: stats[0] || {
        totalEvents: 0,
        publishedEvents: 0,
        draftEvents: 0,
        cancelledEvents: 0,
        completedEvents: 0,
        totalCapacity: 0,
        totalRegistrations: 0
      }
    });
  } catch (error) {
    console.error('Error fetching event stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch event statistics'
    });
  }
};

module.exports = {
  getEvents,
  getEventById,
  createEvent,
  updateEvent,
  publishEvent,
  cancelEvent,
  deleteEvent,
  getEventStats
};
