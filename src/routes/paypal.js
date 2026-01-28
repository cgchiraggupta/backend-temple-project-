/**
 * PayPal Routes - Handles all PayPal payment endpoints
 * MIGRATED: Backend-centric implementation with server-side state
 * 
 * New Endpoints:
 * POST /initiate - Creates pending donation + PayPal order (recommended)
 * POST /capture - Captures payment and saves donation
 * GET /status/:id - Check donation status
 * 
 * Legacy Endpoints (for backward compatibility):
 * POST /create-order - Creates PayPal order only
 * POST /capture-order - Captures payment (legacy)
 */

const express = require('express');
const router = express.Router();
const {
    paypalHandler,
    captureOrder,
    saveDonationToDatabase,
    initiatePayment,
    getPendingByOrderId,
    getPendingById,
    validateConfig,
    PayPalError
} = require('../controllers/paypal');
const supabaseService = require('../services/supabaseService');
const rateLimit = require('express-rate-limit');

// Stricter rate limiting for payment endpoints
const paymentLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { success: false, message: 'Too many payment requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.method === 'OPTIONS'
});

router.use(paymentLimiter);

// =============================================
// NEW ENDPOINTS (Backend-centric flow)
// =============================================

/**
 * POST /api/paypal/initiate
 * 
 * Initiates a PayPal payment with server-side state:
 * 1. Creates pending donation in database
 * 2. Creates PayPal order
 * 3. Returns approval URL and pending donation ID
 * 
 * This eliminates the sessionStorage vulnerability.
 */
router.post('/initiate', async (req, res) => {
    try {
        if (!validateConfig()) {
            return res.status(500).json({
                success: false,
                message: 'PayPal is not properly configured'
            });
        }

        const {
            amount,
            donorName,
            donorEmail,
            donorPhone,
            campaignName,
            campaignId,
            donationType,
            message,
            currency,
            metadata,
            returnUrl,
            cancelUrl,
            returnPath // Optional: path on frontend to return to
        } = req.body;

        // Validate required fields
        if (!amount || !donorName || !donorEmail) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: amount, donorName, donorEmail'
            });
        }

        // Build return URLs
        const frontendUrl = process.env.VITE_FRONTEND_URL || process.env.FRONTEND_URL || 'http://localhost:8080';
        const finalReturnPath = returnPath || '/donation/success';
        const finalReturnUrl = returnUrl || `${frontendUrl}${finalReturnPath}`;
        const finalCancelUrl = cancelUrl || `${frontendUrl}/donation/cancel`;

        const result = await initiatePayment(
            {
                amount,
                donorName,
                donorEmail,
                donorPhone,
                campaignName,
                campaignId,
                donationType,
                message,
                currency,
                metadata
            },
            finalReturnUrl,
            finalCancelUrl,
            supabaseService
        );

        console.log(`✅ Payment initiated: pending=${result.pendingId}, order=${result.orderId}`);

        return res.status(201).json({
            success: true,
            message: 'Payment initiated',
            pendingId: result.pendingId,
            orderId: result.orderId,
            approvalUrl: result.approvalUrl,
            receiptNumber: result.receiptNumber
        });

    } catch (error) {
        console.error('❌ Initiate payment error:', error);

        if (error instanceof PayPalError) {
            return res.status(400).json({
                success: false,
                message: error.message,
                details: error.details
            });
        }

        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to initiate payment'
        });
    }
});

/**
 * POST /api/paypal/capture
 * 
 * Captures payment and saves donation to database.
 * Uses pending donation from database (server-side state).
 */
router.post('/capture', async (req, res) => {
    try {
        const { orderId } = req.body;

        if (!orderId) {
            return res.status(400).json({
                success: false,
                message: 'Order ID is required'
            });
        }

        // Get pending donation from database
        const pendingDonation = await getPendingByOrderId(supabaseService, orderId);

        if (!pendingDonation) {
            console.warn(`⚠️ No pending donation found for order: ${orderId}`);
            // Continue anyway - might be legacy flow
        }

        if (pendingDonation?.status === 'completed') {
            return res.status(400).json({
                success: false,
                message: 'This payment has already been processed'
            });
        }

        // Capture payment from PayPal
        const captureResult = await captureOrder(orderId, pendingDonation || {});

        // Save to donations table - THIS MUST SUCCEED
        const savedDonation = await saveDonationToDatabase(
            captureResult,
            supabaseService,
            pendingDonation
        );

        console.log(`✅ Payment captured and saved: ${savedDonation.id}`);

        return res.json({
            success: true,
            message: 'Payment captured and recorded successfully',
            data: {
                donationId: savedDonation.id,
                transactionId: captureResult.transactionId,
                orderId: captureResult.orderId,
                receiptNumber: captureResult.receiptNumber,
                status: captureResult.status,
                payment: captureResult.payment,
                payer: captureResult.payer,
                capturedAt: captureResult.capturedAt
            }
        });

    } catch (error) {
        console.error('❌ Capture error:', error);

        // CRITICAL: Return error to client - never swallow (fixes issue #3)
        return res.status(500).json({
            success: false,
            message: error.message || 'Payment capture failed',
            // In non-production, include more details
            ...(process.env.NODE_ENV !== 'production' && {
                details: error.details || error.stack
            })
        });
    }
});

/**
 * GET /api/paypal/status/:donationId
 * 
 * Check the status of a donation by its pending donation ID.
 * Used by frontend to poll for completion after PayPal redirect.
 */
router.get('/status/:donationId', async (req, res) => {
    try {
        const { donationId } = req.params;

        if (!donationId) {
            return res.status(400).json({
                success: false,
                message: 'Donation ID is required'
            });
        }

        const pending = await getPendingById(supabaseService, donationId);

        if (!pending) {
            return res.status(404).json({
                success: false,
                message: 'Donation not found'
            });
        }

        // If completed, get the actual donation record
        let donation = null;
        if (pending.status === 'completed' && pending.metadata?.completed_donation_id) {
            const { data } = await supabaseService.client
                .from('donations')
                .select('id, receipt_number, amount, donation_date, payment_status')
                .eq('id', pending.metadata.completed_donation_id)
                .single();
            donation = data;
        }

        return res.json({
            success: true,
            status: pending.status,
            pendingId: pending.id,
            orderId: pending.paypal_order_id,
            amount: pending.amount,
            currency: pending.currency,
            donorName: pending.donor_name,
            createdAt: pending.created_at,
            ...(donation && {
                donation: {
                    id: donation.id,
                    receiptNumber: donation.receipt_number,
                    status: donation.payment_status
                }
            })
        });

    } catch (error) {
        console.error('❌ Status check error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to check donation status'
        });
    }
});

// =============================================
// LEGACY ENDPOINTS (Backward compatibility)
// =============================================

// Main endpoint - handles all actions via query parameter
router.all('/', paypalHandler);

// Alternative RESTful endpoints
router.get('/health', (req, res) => {
    req.query.action = 'health';
    return paypalHandler(req, res);
});

router.post('/create-order', (req, res) => {
    req.query.action = 'create-order';
    return paypalHandler(req, res);
});

// Legacy capture endpoint - now saves to DB properly
router.post('/capture-order', async (req, res) => {
    try {
        const { orderId, donationData } = req.body;

        if (!orderId) {
            return res.status(400).json({ success: false, message: 'Order ID is required' });
        }

        // Try to find pending donation first (optional - table may not exist)
        let pendingDonation = null;
        try {
            pendingDonation = await getPendingByOrderId(supabaseService, orderId);
        } catch (e) {
            console.log('ℹ️ Pending donation lookup skipped (table may not exist)');
        }

        const captureResult = await captureOrder(orderId, donationData || pendingDonation || {});

        // CRITICAL: Save donation - if this fails, return error (not success)
        let savedDonation = null;
        try {
            savedDonation = await saveDonationToDatabase(
                captureResult,
                supabaseService,
                pendingDonation
            );
        } catch (dbError) {
            // Don't swallow the error - return it to client (fixes issue #3)
            console.error('⚠️ Database save failed:', dbError);
            return res.status(500).json({
                success: false,
                partialSuccess: true,
                message: 'Payment was captured but failed to save donation record. Please contact support.',
                transactionId: captureResult.transactionId,
                orderId: captureResult.orderId,
                error: dbError.message
            });
        }

        return res.json({
            success: true,
            message: 'Payment captured successfully',
            data: {
                donationId: savedDonation?.id || null,
                transactionId: captureResult.transactionId,
                orderId: captureResult.orderId,
                receiptNumber: captureResult.receiptNumber,
                status: captureResult.status,
                payment: captureResult.payment,
                payer: captureResult.payer,
                capturedAt: captureResult.capturedAt
            }
        });
    } catch (error) {
        console.error('❌ Capture error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Payment capture failed'
        });
    }
});

// Activate subscription endpoint (public - no auth required)
router.post('/activate-subscription', (req, res) => {
    req.query.action = 'activate-subscription';
    return paypalHandler(req, res);
});

router.post('/webhook', (req, res) => {
    req.query.action = 'webhook';
    return paypalHandler(req, res);
});

module.exports = router;
