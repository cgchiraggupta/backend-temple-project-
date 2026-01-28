// controllers/communityTasksController.js
const CommunityTask = require('../models/CommunityTask');

// Get all tasks
exports.getTasks = async (req, res) => {
  try {
    const { id: communityId } = req.params;
    const { status, priority, assigned_to } = req.query;

    const query = { community_id: communityId };
    if (status && status !== 'all') query.status = status;
    if (priority && priority !== 'all') query.priority = priority;
    if (assigned_to) query.assigned_to = assigned_to;

    const tasks = await CommunityTask.find(query)
      .populate('assigned_to', 'full_name email avatar_url')
      .populate('created_by', 'full_name avatar_url')
      .sort({ created_at: -1 });

    res.json({
      success: true,
      data: tasks
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tasks',
      error: error.message
    });
  }
};

// Create task
exports.createTask = async (req, res) => {
  try {
    const { id: communityId } = req.params;
    const { title, description, status, priority, assigned_to, due_date, tags } = req.body;

    const task = new CommunityTask({
      community_id: communityId,
      title,
      description,
      status: status || 'todo',
      priority: priority || 'medium',
      assigned_to: assigned_to || [],
      created_by: req.user?.id,
      due_date,
      tags: tags || []
    });

    await task.save();
    await task.populate('assigned_to', 'full_name email avatar_url');
    await task.populate('created_by', 'full_name avatar_url');

    res.status(201).json({
      success: true,
      data: task,
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
};

// Update task
exports.updateTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const updates = req.body;
    updates.updated_at = new Date();

    if (updates.status === 'completed' && !updates.completed_at) {
      updates.completed_at = new Date();
    }

    // Check if task is being completed late (after due date)
    if (updates.status === 'completed') {
      const existingTask = await CommunityTask.findById(taskId);
      if (existingTask && existingTask.due_date) {
        const dueDate = new Date(existingTask.due_date);
        const completedAt = updates.completed_at || new Date();
        // Set end of due date day for comparison (11:59:59 PM)
        dueDate.setHours(23, 59, 59, 999);
        if (completedAt > dueDate) {
          updates.completed_late = true;
        } else {
          updates.completed_late = false;
        }
      }
    }

    const task = await CommunityTask.findByIdAndUpdate(
      taskId,
      updates,
      { new: true }
    )
      .populate('assigned_to', 'full_name email avatar_url')
      .populate('created_by', 'full_name avatar_url');

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    res.json({
      success: true,
      data: task,
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
};

// Delete task
exports.deleteTask = async (req, res) => {
  try {
    const { taskId } = req.params;

    const task = await CommunityTask.findByIdAndDelete(taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    res.json({
      success: true,
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
};

// Add comment to task
exports.addTaskComment = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { text } = req.body;

    const task = await CommunityTask.findByIdAndUpdate(
      taskId,
      {
        $push: {
          comments: {
            user_id: req.user?.id,
            text,
            created_at: new Date()
          }
        }
      },
      { new: true }
    )
      .populate('comments.user_id', 'full_name avatar_url');

    res.json({
      success: true,
      data: task,
      message: 'Comment added successfully'
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add comment',
      error: error.message
    });
  }
};
