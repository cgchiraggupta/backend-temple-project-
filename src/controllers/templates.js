// Communication Templates Controller - MongoDB
const CommunicationTemplate = require('../models/CommunicationTemplate');
const { body, validationResult } = require('express-validator');

// Get all templates with filtering and pagination
const getTemplates = async (req, res) => {
  try {
    const {
      type,
      category,
      is_active,
      page = 1,
      limit = 50
    } = req.query;

    const query = {};

    if (type && type !== 'all') {
      query.type = type;
    }

    if (category && category !== 'all') {
      query.category = category;
    }

    if (is_active !== undefined) {
      query.is_active = is_active === 'true';
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const templates = await CommunicationTemplate.find(query)
      .populate('created_by', 'full_name email')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await CommunicationTemplate.countDocuments(query);

    res.json({
      success: true,
      data: templates,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch templates'
    });
  }
};

// Get template by ID
const getTemplateById = async (req, res) => {
  try {
    const { id } = req.params;

    const template = await CommunicationTemplate.findById(id)
      .populate('created_by', 'full_name email');

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch template'
    });
  }
};

// Create new template
const createTemplate = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const templateData = {
      ...req.body,
      created_by: req.user?.id || req.body.created_by,
      usage_count: 0
    };

    const template = new CommunicationTemplate(templateData);
    await template.save();

    // Populate the created template
    await template.populate('created_by', 'full_name email');

    res.status(201).json({
      success: true,
      message: 'Template created successfully',
      data: template
    });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create template'
    });
  }
};

// Update template
const updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    const template = await CommunicationTemplate.findByIdAndUpdate(
      id,
      {
        ...req.body,
        updated_at: new Date()
      },
      { new: true, runValidators: true }
    ).populate('created_by', 'full_name email');

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    res.json({
      success: true,
      message: 'Template updated successfully',
      data: template
    });
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update template'
    });
  }
};

// Toggle template active status
const toggleTemplateStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const template = await CommunicationTemplate.findById(id);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    template.is_active = !template.is_active;
    template.updated_at = new Date();
    await template.save();

    await template.populate('created_by', 'full_name email');

    res.json({
      success: true,
      message: `Template ${template.is_active ? 'activated' : 'deactivated'} successfully`,
      data: template
    });
  } catch (error) {
    console.error('Error toggling template status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle template status'
    });
  }
};

// Delete template
const deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    const template = await CommunicationTemplate.findByIdAndDelete(id);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    res.json({
      success: true,
      message: 'Template deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete template'
    });
  }
};

// Increment template usage count
const incrementUsageCount = async (req, res) => {
  try {
    const { id } = req.params;

    const template = await CommunicationTemplate.findByIdAndUpdate(
      id,
      { $inc: { usage_count: 1 }, updated_at: new Date() },
      { new: true, runValidators: true }
    ).populate('created_by', 'full_name email');

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    res.json({
      success: true,
      message: 'Usage count updated',
      data: template
    });
  } catch (error) {
    console.error('Error incrementing usage count:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update usage count'
    });
  }
};

module.exports = {
  getTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  toggleTemplateStatus,
  deleteTemplate,
  incrementUsageCount
};
