// Pujas Controller - Supabase Compatible
const supabaseService = require('../services/supabaseService');
const { body, validationResult } = require('express-validator');

// Get all puja series with filtering and pagination
const getPujaSeries = async (req, res) => {
  try {
    const {
      community_id,
      status,
      type,
      page = 1,
      limit = 50
    } = req.query;

    console.log('📿 Fetching puja series with filters:', { community_id, status, type, limit, page });

    try {
      let query = supabaseService.client
        .from('puja_series')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply filters
      if (community_id && community_id !== 'all') {
        query = query.eq('community_id', community_id);
      }

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      if (type && type !== 'all') {
        query = query.eq('type', type);
      }

      // Pagination
      const offset = (parseInt(page) - 1) * parseInt(limit);
      query = query.range(offset, offset + parseInt(limit) - 1);

      const { data, error, count } = await query;

      if (error) {
        console.error('Supabase error:', error);

        // If table doesn't exist, return empty data instead of failing
        if (error.message.includes('puja_series') || error.message.includes('relationship')) {
          console.log('⚠️ Puja series table not found, returning empty data');
          return res.json({
            success: true,
            data: [],
            pagination: {
              page: parseInt(page),
              limit: parseInt(limit),
              total: 0,
              totalPages: 0
            },
            message: 'Puja series table not found. Please apply database schema.'
          });
        }

        throw error;
      }

      console.log('✅ Found', data?.length || 0, 'puja series');

      res.json({
        success: true,
        data: data || [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count || data?.length || 0,
          totalPages: Math.ceil((count || data?.length || 0) / parseInt(limit))
        }
      });

    } catch (supabaseError) {
      // Fallback: return empty data if table doesn't exist
      console.log('⚠️ Puja series table not available, providing fallback data');

      res.json({
        success: true,
        data: [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 0,
          totalPages: 0
        },
        message: 'Puja series functionality requires database setup'
      });
    }
  } catch (error) {
    console.error('Error fetching puja series:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch puja series',
      error: error.message
    });
  }
};

// Get puja series by ID
const getPujaSeriesById = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('📿 Fetching puja series by ID:', id);

    const { data, error } = await supabaseService.client
      .from('puja_series')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Supabase error:', error);
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          message: 'Puja series not found'
        });
      }
      throw error;
    }

    console.log('✅ Found puja series:', data.name);

    res.json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error('Error fetching puja series:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch puja series',
      error: error.message
    });
  }
};

// Create new puja series
const createPujaSeries = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array());
      console.log('📝 Request body:', req.body);
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const pujaSeriesData = {
      ...req.body,
      created_by: req.user?.id || req.body.created_by,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log('📿 Creating puja series:', pujaSeriesData.name);

    const { data, error } = await supabaseService.client
      .from('puja_series')
      .insert(pujaSeriesData)
      .select('*')
      .single();

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    console.log('✅ Puja series created:', data.id);

    res.status(201).json({
      success: true,
      message: 'Puja series created successfully',
      data: data
    });
  } catch (error) {
    console.error('Error creating puja series:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create puja series',
      error: error.message
    });
  }
};

// Update puja series
const updatePujaSeries = async (req, res) => {
  try {
    const { id } = req.params;

    const updateData = {
      ...req.body,
      updated_at: new Date().toISOString()
    };

    console.log('📿 Updating puja series:', id);

    const { data, error } = await supabaseService.client
      .from('puja_series')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('Supabase error:', error);
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          message: 'Puja series not found'
        });
      }
      throw error;
    }

    console.log('✅ Puja series updated:', data.name);

    res.json({
      success: true,
      message: 'Puja series updated successfully',
      data: data
    });
  } catch (error) {
    console.error('Error updating puja series:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update puja series'
    });
  }
};

// Cancel puja series
const cancelPujaSeries = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('📿 Cancelling puja series:', id);

    const { data, error } = await supabaseService.client
      .from('puja_series')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('Supabase error:', error);
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          message: 'Puja series not found'
        });
      }
      throw error;
    }

    console.log('✅ Puja series cancelled:', data.name);

    res.json({
      success: true,
      message: 'Puja series cancelled successfully',
      data: data
    });
  } catch (error) {
    console.error('Error cancelling puja series:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel puja series'
    });
  }
};

// Delete puja series
const deletePujaSeries = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('📿 Deleting puja series:', id);

    const { data, error } = await supabaseService.client
      .from('puja_series')
      .delete()
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          message: 'Puja series not found'
        });
      }
      throw error;
    }

    console.log('✅ Puja series deleted:', data.name);

    res.json({
      success: true,
      message: 'Puja series deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting puja series:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete puja series',
      error: error.message
    });
  }
};

module.exports = {
  getPujaSeries,
  getPujaSeriesById,
  createPujaSeries,
  updatePujaSeries,
  cancelPujaSeries,
  deletePujaSeries
};
