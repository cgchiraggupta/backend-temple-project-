// Expenses Routes - Dedicated expenses table management
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');
const path = require('path');
const supabaseService = require('../services/supabaseService');

// Initialize Supabase client for storage
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 5 // Max 5 files
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: images, PDF, DOC, DOCX'), false);
    }
  }
});

// Helper function to ensure bucket exists
async function ensureBucketExists(bucketName) {
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(b => b.name === bucketName);

    if (!bucketExists) {
      console.log(`📦 Creating bucket: ${bucketName}`);
      const { error } = await supabase.storage.createBucket(bucketName, {
        public: true,
        fileSizeLimit: 10485760 // 10MB
      });
      if (error && !error.message.includes('already exists')) {
        console.error('❌ Failed to create bucket:', error);
      }
    }
  } catch (err) {
    console.error('❌ Error checking/creating bucket:', err.message);
  }
}

// Helper function to upload file to Supabase Storage
async function uploadToSupabase(file, expenseId) {
  const fileExt = path.extname(file.originalname);
  const fileName = `expenses/${expenseId}/${randomUUID()}${fileExt}`;
  const bucketName = 'expense-documents';

  console.log(`📤 Uploading file to Supabase: ${fileName}`);

  // Ensure bucket exists
  await ensureBucketExists(bucketName);

  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: false
    });

  if (error) {
    console.error('❌ Supabase storage upload error:', error);
    // Try with gallery bucket as fallback
    console.log('📤 Trying fallback bucket: gallery');
    const fallbackFileName = `expense-docs/${expenseId}/${randomUUID()}${fileExt}`;
    const { data: fallbackData, error: fallbackError } = await supabase.storage
      .from('gallery')
      .upload(fallbackFileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (fallbackError) {
      console.error('❌ Fallback upload also failed:', fallbackError);
      throw error; // Throw original error
    }

    const { data: fallbackUrlData } = supabase.storage
      .from('gallery')
      .getPublicUrl(fallbackFileName);

    console.log(`✅ File uploaded to fallback bucket: ${fallbackUrlData.publicUrl}`);

    return {
      file_name: file.originalname,
      file_path: fallbackUrlData.publicUrl,
      file_type: file.mimetype,
      file_size: file.size,
      storage_path: fallbackFileName
    };
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(bucketName)
    .getPublicUrl(fileName);

  console.log(`✅ File uploaded successfully: ${urlData.publicUrl}`);

  return {
    file_name: file.originalname,
    file_path: urlData.publicUrl,
    file_type: file.mimetype,
    file_size: file.size,
    storage_path: fileName
  };
}


// =============================================
// EXPENSES ROUTES
// =============================================

// GET all expenses
router.get('/', async (req, res) => {
  try {
    console.log('💸 Fetching expenses...');

    const { data, error } = await supabaseService.client
      .from('expenses')
      .select(`
                *,
                budget_categories (
                    id,
                    name,
                    category_type
                )
            `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expenses',
      error: error.message
    });
  }
});

// GET expense by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('💸 Fetching expense:', id);

    const { data, error } = await supabaseService.client
      .from('expenses')
      .select(`
                *,
                budget_categories (
                    id,
                    name,
                    category_type
                ),
                expense_attachments (
                    id,
                    file_name,
                    file_path,
                    file_type,
                    file_size,
                    uploaded_at
                )
            `)
      .eq('id', id)
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error('Error fetching expense:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expense',
      error: error.message
    });
  }
});

// POST create expense
router.post('/', async (req, res) => {
  try {
    console.log('💸 Creating expense:', req.body);

    // Validate required fields
    const { description, amount } = req.body;
    if (!description || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Description and amount are required'
      });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be a valid number greater than 0'
      });
    }

    // Allowlist fields to prevent mass assignment
    const allowedFields = [
      'description', 'amount', 'expense_type', 'expense_date',
      'vendor_name', 'payment_method', 'payment_status', 'notes',
      'receipt_url', 'category_id', 'budget_category_id',
      'community_id', 'created_by'
    ];
    const safeData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        safeData[field] = req.body[field];
      }
    }
    // Ensure amount is properly parsed
    safeData.amount = parsedAmount;
    safeData.created_at = new Date().toISOString();
    safeData.updated_at = new Date().toISOString();

    const { data, error } = await supabaseService.client
      .from('expenses')
      .insert(safeData)
      .select('*')
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data: data,
      message: 'Expense created successfully'
    });
  } catch (error) {
    console.error('Error creating expense:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create expense',
      error: error.message
    });
  }
});

// PUT update expense
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('💸 Updating expense:', id);

    // Allowlist fields to prevent mass assignment
    const allowedFields = [
      'description', 'amount', 'expense_type', 'expense_date',
      'vendor_name', 'payment_method', 'payment_status', 'notes',
      'receipt_url', 'category_id', 'budget_category_id'
    ];
    const safeData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        safeData[field] = req.body[field];
      }
    }
    // Parse amount if provided
    if (safeData.amount !== undefined) {
      safeData.amount = parseFloat(safeData.amount);
    }
    safeData.updated_at = new Date().toISOString();

    const { data, error } = await supabaseService.client
      .from('expenses')
      .update(safeData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data: data,
      message: 'Expense updated successfully'
    });
  } catch (error) {
    console.error('Error updating expense:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update expense',
      error: error.message
    });
  }
});

// DELETE expense
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('💸 Deleting expense:', id);

    const { data, error } = await supabaseService.client
      .from('expenses')
      .delete()
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Expense deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete expense',
      error: error.message
    });
  }
});

// =============================================
// EXPENSE REPORTS ROUTES
// =============================================

// GET expense summary
router.get('/reports/summary', async (req, res) => {
  try {
    console.log('📊 Fetching expense summary...');

    const { data: expenses, error } = await supabaseService.client
      .from('expenses')
      .select('expense_type, amount, payment_status, expense_date');

    if (error) throw error;

    const totalExpenses = expenses
      .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

    const pendingExpenses = expenses
      .filter(e => e.payment_status === 'pending')
      .reduce((sum, e) => sum + parseFloat(e.amount), 0);

    // This month expenses
    const now = new Date();
    const thisMonthExpenses = expenses
      .filter(e => {
        const expenseDate = new Date(e.expense_date);
        return expenseDate.getMonth() === now.getMonth() &&
          expenseDate.getFullYear() === now.getFullYear() &&
          e.payment_status === 'completed';
      })
      .reduce((sum, e) => sum + parseFloat(e.amount), 0);

    // Category breakdown
    const categoryBreakdown = {};
    expenses.forEach(expense => {
      if (expense.payment_status === 'completed') {
        const category = expense.expense_type || 'other';
        if (!categoryBreakdown[category]) {
          categoryBreakdown[category] = { count: 0, total: 0 };
        }
        categoryBreakdown[category].count += 1;
        categoryBreakdown[category].total += parseFloat(expense.amount);
      }
    });

    res.json({
      success: true,
      data: {
        totalExpenses,
        pendingExpenses,
        thisMonthExpenses,
        expenseCount: expenses.length,
        completedCount: expenses.filter(e => e.payment_status === 'completed').length,
        pendingCount: expenses.filter(e => e.payment_status === 'pending').length,
        categoryBreakdown
      }
    });
  } catch (error) {
    console.error('Error fetching expense summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expense summary',
      error: error.message
    });
  }
});

// GET expenses by category
router.get('/reports/by-category', async (req, res) => {
  try {
    console.log('📊 Fetching expenses by category...');

    const { data: expenses, error } = await supabaseService.client
      .from('expenses')
      .select('expense_type, amount, payment_status');

    if (error) throw error;

    const categoryReport = {};
    expenses.forEach(expense => {
      const category = expense.expense_type || 'other';
      if (!categoryReport[category]) {
        categoryReport[category] = {
          category,
          totalAmount: 0,
          expenseCount: 0,
          expenses: []
        };
      }

      categoryReport[category].totalAmount += parseFloat(expense.amount || 0);
      categoryReport[category].expenseCount += 1;
      categoryReport[category].expenses.push(expense);
    });

    res.json({
      success: true,
      data: Object.values(categoryReport)
    });
  } catch (error) {
    console.error('Error fetching category report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category report',
      error: error.message
    });
  }
});

// GET monthly expense report
router.get('/reports/monthly', async (req, res) => {
  try {
    console.log('📊 Fetching monthly expense report...');

    const { data: expenses, error } = await supabaseService.client
      .from('expenses')
      .select('*')
      .order('expense_date', { ascending: false });

    if (error) throw error;

    // Group by month
    const monthlyReport = {};
    expenses.forEach(expense => {
      const date = new Date(expense.expense_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyReport[monthKey]) {
        monthlyReport[monthKey] = {
          month: monthKey,
          totalAmount: 0,
          expenseCount: 0,
          expenses: []
        };
      }

      monthlyReport[monthKey].totalAmount += parseFloat(expense.amount);
      monthlyReport[monthKey].expenseCount += 1;
      monthlyReport[monthKey].expenses.push(expense);
    });

    res.json({
      success: true,
      data: Object.values(monthlyReport).sort((a, b) => b.month.localeCompare(a.month))
    });
  } catch (error) {
    console.error('Error fetching monthly report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch monthly report',
      error: error.message
    });
  }
});

// =============================================
// EXPENSE ATTACHMENTS ROUTES
// =============================================

// POST upload files to expense (multipart/form-data)
router.post('/:id/upload', upload.array('documents', 5), async (req, res) => {
  try {
    const { id } = req.params;
    console.log('📎 Uploading documents for expense:', id);
    console.log('📎 Files received:', req.files?.length || 0);

    // Verify expense exists
    const { data: expense, error: expenseError } = await supabaseService.client
      .from('expenses')
      .select('id')
      .eq('id', id)
      .single();

    if (expenseError || !expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files provided'
      });
    }

    // Upload files to Supabase Storage
    const uploadedAttachments = [];
    for (const file of req.files) {
      try {
        const uploadedFile = await uploadToSupabase(file, id);

        // Insert record into expense_attachments table
        const { data: attachment, error: attachError } = await supabaseService.client
          .from('expense_attachments')
          .insert({
            expense_id: id,
            file_name: uploadedFile.file_name,
            file_path: uploadedFile.file_path,
            file_type: uploadedFile.file_type,
            file_size: uploadedFile.file_size
          })
          .select('*')
          .single();

        if (attachError) {
          console.error('❌ Error inserting attachment record:', attachError);
        } else {
          uploadedAttachments.push(attachment);
        }
      } catch (uploadError) {
        console.error('❌ File upload failed:', uploadError.message);
      }
    }

    console.log(`✅ Uploaded ${uploadedAttachments.length} documents for expense ${id}`);

    res.status(201).json({
      success: true,
      data: uploadedAttachments,
      message: `${uploadedAttachments.length} document(s) uploaded successfully`
    });
  } catch (error) {
    console.error('❌ Error uploading expense documents:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload documents',
      error: error.message
    });
  }
});

// GET attachments for an expense

router.get('/:id/attachments', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('📎 Fetching attachments for expense:', id);

    const { data, error } = await supabaseService.client
      .from('expense_attachments')
      .select('*')
      .eq('expense_id', id)
      .order('uploaded_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    console.error('Error fetching expense attachments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expense attachments',
      error: error.message
    });
  }
});

// POST add attachment to expense
router.post('/:id/attachments', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('📎 Adding attachment to expense:', id);

    const attachmentData = {
      ...req.body,
      expense_id: id
    };

    const { data, error } = await supabaseService.client
      .from('expense_attachments')
      .insert(attachmentData)
      .select('*')
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data: data,
      message: 'Attachment added successfully'
    });
  } catch (error) {
    console.error('Error adding expense attachment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add expense attachment',
      error: error.message
    });
  }
});

module.exports = router;