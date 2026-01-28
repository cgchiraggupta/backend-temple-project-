const express = require('express');
const router = express.Router();
const supabaseService = require('../services/supabaseService');

// GET all tasks (general endpoint)
router.get('/tasks', async (req, res) => {
    try {
        const { status, priority, community_id, assigned_to, limit = 50, page = 1 } = req.query;

        console.log('📋 Fetching all tasks with filters:', { status, priority, community_id, assigned_to, limit, page });

        let query = supabaseService.client
            .from('community_tasks')
            .select(`
        *,
        communities:community_id (
          id,
          name,
          slug
        )
      `)
            .order('created_at', { ascending: false });

        // Apply filters
        if (status && status !== 'all') {
            query = query.eq('status', status);
        }
        if (priority && priority !== 'all') {
            query = query.eq('priority', priority);
        }
        if (community_id && community_id !== 'all') {
            query = query.eq('community_id', community_id);
        }
        if (assigned_to && assigned_to !== 'all') {
            query = query.filter('assigned_to', 'cs', `{${assigned_to}}`);
        }

        // Pagination
        const offset = (parseInt(page) - 1) * parseInt(limit);
        query = query.range(offset, offset + parseInt(limit) - 1);

        const { data, error } = await query;

        if (error) throw error;

        // Map the data to include community name
        const mappedData = (data || []).map(task => ({
            ...task,
            community_name: task.communities?.name || 'Unknown Community',
            community_slug: task.communities?.slug || '',
        }));

        res.json({
            success: true,
            data: mappedData,
            total: mappedData.length,
            page: parseInt(page),
            limit: parseInt(limit)
        });

    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch tasks',
            error: error.message
        });
    }
});

// POST create new task (general endpoint)
router.post('/tasks', async (req, res) => {
    try {
        const {
            community_id,
            title,
            description,
            status = 'todo',
            priority = 'medium',
            assigned_to = [],
            due_date,
            tags = []
        } = req.body;

        console.log('📋 Creating new task:', { title, community_id, status, priority });

        // Validate required fields
        if (!title || !community_id) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: title, community_id'
            });
        }

        const taskData = {
            community_id,
            title,
            description: description || '',
            status,
            priority,
            assigned_to: Array.isArray(assigned_to) ? assigned_to : [],
            due_date: due_date || null,
            tags: Array.isArray(tags) ? tags : [],
            created_by: req.user?.id || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const { data, error } = await supabaseService.client
            .from('community_tasks')
            .insert(taskData)
            .select(`
        *,
        communities:community_id (
          id,
          name,
          slug
        )
      `)
            .single();

        if (error) throw error;

        console.log('✅ Task created:', data.id);

        // Map the response to include community name
        const mappedResponse = {
            ...data,
            community_name: data.communities?.name || 'Unknown Community',
            community_slug: data.communities?.slug || '',
        };

        res.status(201).json({
            success: true,
            data: mappedResponse,
            message: 'Task created successfully'
        });

    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create task',
            error: error.message
        });
    }
});

// PUT update task (general endpoint)
router.put('/tasks/:id', async (req, res) => {
    try {
        const taskId = req.params.id;
        const updateData = { ...req.body };
        updateData.updated_at = new Date().toISOString();

        // Handle completed_at field
        if (updateData.status === 'completed' && !updateData.completed_at) {
            updateData.completed_at = new Date().toISOString();
        } else if (updateData.status !== 'completed') {
            updateData.completed_at = null;
        }

        // Check if task is being completed late (after due date)
        if (updateData.status === 'completed') {
            // First fetch the existing task to get its due_date
            const { data: existingTask, error: fetchError } = await supabaseService.client
                .from('community_tasks')
                .select('due_date')
                .eq('id', taskId)
                .single();

            if (!fetchError && existingTask && existingTask.due_date) {
                const dueDate = new Date(existingTask.due_date);
                const completedAt = new Date(updateData.completed_at);
                // Set end of due date day for comparison (11:59:59 PM)
                dueDate.setHours(23, 59, 59, 999);
                updateData.completed_late = completedAt > dueDate;
            }
        }

        console.log('📋 Updating task:', taskId, updateData);

        const { data, error } = await supabaseService.client
            .from('community_tasks')
            .update(updateData)
            .eq('id', taskId)
            .select(`
        *,
        communities:community_id (
          id,
          name,
          slug
        )
      `)
            .single();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
        }

        console.log('✅ Task updated:', data.id);

        // Map the response to include community name
        const mappedResponse = {
            ...data,
            community_name: data.communities?.name || 'Unknown Community',
            community_slug: data.communities?.slug || '',
        };

        res.json({
            success: true,
            data: mappedResponse,
            message: 'Task updated successfully'
        });

    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update task',
            error: error.message
        });
    }
});

// DELETE task (general endpoint)
router.delete('/tasks/:id', async (req, res) => {
    try {
        const taskId = req.params.id;

        console.log('📋 Deleting task:', taskId);

        const { data, error } = await supabaseService.client
            .from('community_tasks')
            .delete()
            .eq('id', taskId)
            .select('*')
            .single();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
        }

        console.log('✅ Task deleted:', data.id);

        res.json({
            success: true,
            data,
            message: 'Task deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete task',
            error: error.message
        });
    }
});

// GET task statistics
router.get('/tasks/stats', async (req, res) => {
    try {
        const { community_id } = req.query;

        console.log('📊 Fetching task stats for community:', community_id);

        let query = supabaseService.client
            .from('community_tasks')
            .select('*');

        if (community_id && community_id !== 'all') {
            query = query.eq('community_id', community_id);
        }

        const { data: tasks, error } = await query;

        if (error) throw error;

        const stats = {
            total: tasks.length,
            todo: tasks.filter(t => t.status === 'todo').length,
            'in-progress': tasks.filter(t => t.status === 'in-progress').length,
            completed: tasks.filter(t => t.status === 'completed').length,
            high_priority: tasks.filter(t => t.priority === 'high').length,
            medium_priority: tasks.filter(t => t.priority === 'medium').length,
            low_priority: tasks.filter(t => t.priority === 'low').length,
            overdue: tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed').length
        };

        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('Error fetching task stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch task statistics',
            error: error.message
        });
    }
});

module.exports = router;