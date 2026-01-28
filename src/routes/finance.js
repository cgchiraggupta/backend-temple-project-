// Finance Routes
const express = require('express');
const router = express.Router();
const supabaseService = require('../services/supabaseService');

// =============================================
// BUDGET CATEGORIES ROUTES
// =============================================

// GET all budget categories
router.get('/categories', async (req, res) => {
    try {
        console.log('💰 Fetching budget categories...');

        const { data, error } = await supabaseService.client
            .from('budget_categories')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({
            success: true,
            data: data || []
        });
    } catch (error) {
        console.error('Error fetching budget categories:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch budget categories',
            error: error.message
        });
    }
});

// POST create budget category
router.post('/categories', async (req, res) => {
    try {
        console.log('💰 Creating budget category:', req.body);

        const { data, error } = await supabaseService.client
            .from('budget_categories')
            .insert(req.body)
            .select('*')
            .single();

        if (error) throw error;

        res.status(201).json({
            success: true,
            data: data,
            message: 'Budget category created successfully'
        });
    } catch (error) {
        console.error('Error creating budget category:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create budget category',
            error: error.message
        });
    }
});

// =============================================
// TRANSACTIONS ROUTES
// =============================================

// GET all transactions
router.get('/transactions', async (req, res) => {
    try {
        console.log('💳 Fetching transactions...');

        const { data, error } = await supabaseService.client
            .from('transactions')
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
        console.error('Error fetching transactions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch transactions',
            error: error.message
        });
    }
});

// POST create transaction
router.post('/transactions', async (req, res) => {
    try {
        console.log('💳 Creating transaction:', req.body);

        const { data, error } = await supabaseService.client
            .from('transactions')
            .insert(req.body)
            .select('*')
            .single();

        if (error) throw error;

        res.status(201).json({
            success: true,
            data: data,
            message: 'Transaction created successfully'
        });
    } catch (error) {
        console.error('Error creating transaction:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create transaction',
            error: error.message
        });
    }
});

// PUT update transaction
router.put('/transactions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log('💳 Updating transaction:', id);

        const { data, error } = await supabaseService.client
            .from('transactions')
            .update(req.body)
            .eq('id', id)
            .select('*')
            .single();

        if (error) throw error;

        res.json({
            success: true,
            data: data,
            message: 'Transaction updated successfully'
        });
    } catch (error) {
        console.error('Error updating transaction:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update transaction',
            error: error.message
        });
    }
});

// DELETE transaction
router.delete('/transactions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log('💳 Deleting transaction:', id);

        const { data, error } = await supabaseService.client
            .from('transactions')
            .delete()
            .eq('id', id)
            .select('*')
            .single();

        if (error) throw error;

        res.json({
            success: true,
            message: 'Transaction deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting transaction:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete transaction',
            error: error.message
        });
    }
});

// =============================================
// REPORTS ROUTES
// =============================================

// GET financial summary
router.get('/summary', async (req, res) => {
    try {
        console.log('📊 Fetching financial summary...');

        // Get total income (from transactions)
        const { data: transactions, error: transactionError } = await supabaseService.client
            .from('transactions')
            .select('type, amount')
            .eq('type', 'income');

        if (transactionError) throw transactionError;

        // Get total expenses (from expenses table)
        const { data: expenses, error: expenseError } = await supabaseService.client
            .from('expenses')
            .select('amount, payment_status');

        if (expenseError) throw expenseError;

        const totalIncome = transactions
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);

        // Sum up all expenses
        const totalExpenses = expenses
            .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

        const netAmount = totalIncome - totalExpenses;

        res.json({
            success: true,
            data: {
                totalIncome,
                totalExpenses,
                netAmount,
                transactionCount: transactions.length + expenses.length
            }
        });
    } catch (error) {
        console.error('Error fetching financial summary:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch financial summary',
            error: error.message
        });
    }
});

// GET category-wise report
router.get('/reports/categories', async (req, res) => {
    try {
        console.log('📊 Fetching category-wise report...');

        const { data: transactions, error } = await supabaseService.client
            .from('transactions')
            .select(`
                *,
                budget_categories (
                    id,
                    name,
                    category_type
                )
            `);

        if (error) throw error;

        // Group by category
        const categoryReport = {};
        transactions.forEach(transaction => {
            const categoryId = transaction.category_id || 'uncategorized';
            const categoryName = transaction.budget_categories?.name || 'Uncategorized';

            if (!categoryReport[categoryId]) {
                categoryReport[categoryId] = {
                    id: categoryId,
                    name: categoryName,
                    type: transaction.budget_categories?.category_type || 'other',
                    totalAmount: 0,
                    transactionCount: 0,
                    transactions: []
                };
            }

            categoryReport[categoryId].totalAmount += parseFloat(transaction.amount);
            categoryReport[categoryId].transactionCount += 1;
            categoryReport[categoryId].transactions.push(transaction);
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

// GET monthly report
router.get('/reports/monthly', async (req, res) => {
    try {
        console.log('📊 Fetching monthly report...');

        const { data: transactions, error } = await supabaseService.client
            .from('transactions')
            .select('*')
            .order('date', { ascending: false });

        if (error) throw error;

        // Group by month
        const monthlyReport = {};
        transactions.forEach(transaction => {
            const date = new Date(transaction.date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

            if (!monthlyReport[monthKey]) {
                monthlyReport[monthKey] = {
                    month: monthKey,
                    income: 0,
                    expenses: 0,
                    net: 0,
                    transactionCount: 0
                };
            }

            const amount = parseFloat(transaction.amount);
            if (transaction.type === 'income') {
                monthlyReport[monthKey].income += amount;
            } else {
                monthlyReport[monthKey].expenses += amount;
            }
            monthlyReport[monthKey].net = monthlyReport[monthKey].income - monthlyReport[monthKey].expenses;
            monthlyReport[monthKey].transactionCount += 1;
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

module.exports = router;