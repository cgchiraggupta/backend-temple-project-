// backend/routes/communityFeatures.js - SUPABASE ENHANCED VERSION
const express = require('express');
const router = express.Router();
const supabaseService = require('../services/supabaseService');

// ===== APPLICATION ROUTES =====

// PUT reject application
router.put('/:communityId/applications/:applicationId/reject', async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { reviewed_by, review_notes } = req.body;

    console.log('📋 Rejecting application via communityFeatures:', applicationId);

    if (applicationId === 'undefined' || applicationId === 'null' || !applicationId || applicationId.trim() === '') {
      console.log('❌ Invalid application ID received for rejection:', applicationId);
      return res.status(400).json({
        success: false,
        error: 'Invalid application ID',
        message: `Invalid application ID received: "${applicationId}". Please ensure the application ID is properly set in the frontend.`,
        received_id: applicationId,
        hint: 'Check that the application object has a valid "id" property'
      });
    }

    // Get application data first
    const { data: applicationData, error: fetchError } = await supabaseService.client
      .from('community_applications')
      .select('*')
      .eq('id', applicationId)
      .single();

    if (fetchError) throw fetchError;

    if (!applicationData) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // If application was previously approved, remove from community_members
    if (applicationData.status === 'approved') {
      try {
        console.log('🗑️ Removing user from community_members (was previously approved)...');

        const { data: deletedMember, error: deleteError } = await supabaseService.client
          .from('community_members')
          .delete()
          .eq('community_id', applicationData.community_id)
          .eq('email', applicationData.email)
          .select('*')
          .maybeSingle();

        if (deleteError) {
          console.error('❌ Failed to remove from community_members:', deleteError);
        } else if (deletedMember) {
          console.log('✅ User removed from community_members:', deletedMember.id);

          // Update community member count
          const { data: community } = await supabaseService.client
            .from('communities')
            .select('member_count')
            .eq('id', applicationData.community_id)
            .single();

          const newMemberCount = Math.max(0, (community?.member_count || 1) - 1);

          await supabaseService.client
            .from('communities')
            .update({
              member_count: newMemberCount,
              updated_at: new Date().toISOString()
            })
            .eq('id', applicationData.community_id);

          console.log('✅ Community member count updated to:', newMemberCount);
        }
      } catch (memberException) {
        console.error('❌ Exception removing member:', memberException);
      }
    }

    // Update application status to rejected
    const { data, error } = await supabaseService.client
      .from('community_applications')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewed_by || null,
        review_notes: review_notes || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', applicationId)
      .select('*')
      .single();

    if (error) throw error;

    console.log('✅ Application rejected successfully via communityFeatures:', applicationId);

    res.json({
      success: true,
      data,
      message: 'Application rejected successfully'
    });
  } catch (error) {
    console.error('Error in communityFeatures reject:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject application',
      error: error.message
    });
  }
});

// ===== TASKS ROUTES =====
router.get('/:id/tasks', async (req, res) => {
  try {
    const { id: communityId } = req.params;
    const { status, priority } = req.query;

    console.log('📋 Fetching tasks for community:', communityId);

    // Build query for Supabase (without foreign key join for now)
    let query = supabaseService.client
      .from('community_tasks')
      .select('*')
      .eq('community_id', communityId);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (priority && priority !== 'all') {
      query = query.eq('priority', priority);
    }

    const { data: tasks, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Supabase tasks query error:', error);
      throw error;
    }

    console.log('✅ Tasks fetched:', tasks?.length || 0);

    res.json({
      success: true,
      data: tasks || []
    });
  } catch (error) {
    console.error('❌ Error fetching tasks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tasks',
      error: error.message
    });
  }
});

// ✅ FIXED: Task creation without created_by requirement
router.post('/:id/tasks', async (req, res) => {
  try {
    const { id: communityId } = req.params;
    const { title, description, status, priority, assigned_to, due_date, tags } = req.body;

    console.log('✅ Creating task for community:', communityId);
    console.log('📝 Task data:', { title, description, status, priority });

    // ✅ FIXED: Build task object WITHOUT created_by
    const taskData = {
      community_id: communityId,
      title,
      description,
      status: status || 'todo',
      priority: priority || 'medium',
      assigned_to: assigned_to || [],
      due_date,
      tags: tags || []
    };

    // Only add created_by if we have a valid user
    if (req.user?.id) {
      taskData.created_by = req.user.id;
    }

    const { data: task, error } = await supabaseService.client
      .from('community_tasks')
      .insert(taskData)
      .select('*')
      .single();

    if (error) {
      console.error('❌ Supabase task creation error:', error);
      throw error;
    }

    console.log('✅ Task created successfully:', task.id);

    res.status(201).json({
      success: true,
      data: task,
      message: 'Task created successfully'
    });
  } catch (error) {
    console.error('❌ Error creating task:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create task',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

router.put('/:id/tasks/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const updates = req.body;

    console.log('📝 Updating task:', taskId);

    const { data: task, error } = await supabaseService.client
      .from('community_tasks')
      .update(updates)
      .eq('id', taskId)
      .select('*')
      .single();

    if (error) {
      console.error('❌ Supabase task update error:', error);
      throw error;
    }

    res.json({
      success: true,
      data: task,
      message: 'Task updated successfully'
    });
  } catch (error) {
    console.error('❌ Error updating task:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update task',
      error: error.message
    });
  }
});

router.delete('/:id/tasks/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;

    console.log('🗑️ Deleting task:', taskId);

    const { error } = await supabaseService.client
      .from('community_tasks')
      .delete()
      .eq('id', taskId);

    if (error) {
      console.error('❌ Supabase task deletion error:', error);
      throw error;
    }

    res.json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error deleting task:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete task',
      error: error.message
    });
  }
});

module.exports = router;
