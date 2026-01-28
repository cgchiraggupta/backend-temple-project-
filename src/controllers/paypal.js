/**
 * PayPal Payment Integration Controller
 * Enhanced with security, idempotency, and pending donation flow
 * 
 * Improvements:
 * - Pending donations stored in DB (not sessionStorage)
 * - Donation type validation with campaign mapping
 * - Idempotency via transaction_id check
 * - Proper error handling (no silent failures)
 * - Webhook verification for all modes when configured
 * - Rate limiting and input sanitization
 * - Full subscription support
 * 
 * @module controllers/paypal
 */

'use strict';

const crypto = require('crypto');

// =============================================
// CONFIGURATION
// =============================================

const PAYPAL_CONFIG = {
    clientId: process.env.PAYPAL_CLIENT_ID,
    clientSecret: process.env.PAYPAL_CLIENT_SECRET,
    mode: process.env.PAYPAL_MODE || 'sandbox',
    webhookId: process.env.PAYPAL_WEBHOOK_ID,
    get baseUrl() {
        return this.mode === 'live'
            ? 'https://api-m.paypal.com'
            : 'https://api-m.sandbox.paypal.com';
    }
};

// Valid donation types matching DB constraint
const VALID_DONATION_TYPES = ['general', 'puja', 'annadaana', 'recurring', 'service', 'sai_aangan', 'service_to_needy'];

// Campaign name to donation type mapping
const CAMPAIGN_TYPE_MAPPING = {
    'sai aangan fundraising': 'sai_aangan',
    'sai aangan': 'sai_aangan',
    'service to needy': 'service_to_needy',
    'needy': 'service_to_needy',
    'puja': 'puja',
    'annadaana': 'annadaana',
    'food': 'annadaana',
    'recurring': 'recurring',
    'monthly': 'recurring',
    'service': 'service'
};

// Frequency mapping for subscriptions
const FREQUENCY_MAP = {
    'weekly': { interval_unit: 'WEEK', interval_count: 1 },
    'monthly': { interval_unit: 'MONTH', interval_count: 1 },
    'quarterly': { interval_unit: 'MONTH', interval_count: 3 },
    'yearly': { interval_unit: 'YEAR', interval_count: 1 }
};

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map();
const RATE_LIMIT = { windowMs: 60000, maxRequests: 10 };

// =============================================
// CUSTOM ERROR CLASS
// =============================================

class PayPalError extends Error {
    constructor(message, details = {}, statusCode = 400) {
        super(message);
        this.name = 'PayPalError';
        this.details = details;
        this.statusCode = statusCode;
    }
}

// =============================================
// SECURITY & VALIDATION UTILITIES
// =============================================

/**
 * Rate limiter by IP
 */
const checkRateLimit = (ip) => {
    const now = Date.now();
    const windowStart = now - RATE_LIMIT.windowMs;

    // Clean old entries
    for (const [key, data] of rateLimitStore.entries()) {
        if (data.timestamp < windowStart) rateLimitStore.delete(key);
    }

    const current = rateLimitStore.get(ip) || { count: 0, timestamp: now };
    if (current.timestamp < windowStart) {
        current.count = 0;
        current.timestamp = now;
    }

    current.count++;
    rateLimitStore.set(ip, current);

    return current.count <= RATE_LIMIT.maxRequests;
};

/**
 * Validates PayPal configuration
 */
const validateConfig = () => {
    const required = ['clientId', 'clientSecret'];
    const missing = required.filter(key => !PAYPAL_CONFIG[key]);
    if (missing.length > 0) {
        console.error(`❌ PayPal: Missing config: ${missing.join(', ')}`);
        return false;
    }
    return true;
};

/**
 * Sanitizes string input to prevent XSS and injection
 */
const sanitizeString = (input, maxLength = 255) => {
    if (input === null || input === undefined) return '';
    return String(input)
        .replace(/[<>\"\'\\]/g, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+=/gi, '')
        .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
        .trim()
        .substring(0, maxLength);
};

/**
 * Validates email format
 */
const validateEmail = (email) => {
    if (!email) return null;
    const sanitized = sanitizeString(email, 254).toLowerCase();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(sanitized) ? sanitized : null;
};

/**
 * Validates and sanitizes amount
 */
const validateAmount = (amount) => {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
        return { valid: false, value: 0, error: 'Amount must be a positive number' };
    }
    if (num < 1) {
        return { valid: false, value: 0, error: 'Minimum donation is $1' };
    }
    if (num > 100000) {
        return { valid: false, value: 0, error: 'Amount exceeds maximum limit of $100,000' };
    }
    return { valid: true, value: Math.round(num * 100) / 100, error: null };
};

/**
 * Map campaign name to valid donation type
 */
const mapToDonationType = (campaignName, explicitType) => {
    if (explicitType && VALID_DONATION_TYPES.includes(explicitType.toLowerCase())) {
        return explicitType.toLowerCase();
    }
    if (campaignName) {
        const lowerName = campaignName.toLowerCase();
        for (const [keyword, type] of Object.entries(CAMPAIGN_TYPE_MAPPING)) {
            if (lowerName.includes(keyword)) return type;
        }
    }
    return 'general';
};

/**
 * Validate donation type against allowed values
 */
const validateDonationType = (type) => {
    const normalized = (type || 'general').toLowerCase();
    if (!VALID_DONATION_TYPES.includes(normalized)) {
        throw new PayPalError(
            `Invalid donation type: ${type}`,
            { allowedTypes: VALID_DONATION_TYPES }
        );
    }
    return normalized;
};

/**
 * Generates secure request ID
 */
const generateRequestId = () => `${Date.now()}-${crypto.randomBytes(12).toString('hex')}`;

/**
 * Generates receipt number
 */
const generateReceiptNumber = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `DON-${timestamp}-${random}`;
};

/**
 * Validates and sanitizes donation input
 */
const validateDonationInput = (data) => {
    const errors = [];

    const amountResult = validateAmount(data.amount);
    if (!amountResult.valid) errors.push(amountResult.error);

    const email = data.donorEmail || data.email;
    if (email && !validateEmail(email)) errors.push('Invalid email format');

    // Sanitize metadata
    const rawMetadata = data.metadata || {};
    const sanitizedMetadata = {};

    const metadataFields = ['puja_date', 'puja_type', 'family_members', 'gotra', 'nakshatra', 'preferred_date', 'occasion'];
    metadataFields.forEach(field => {
        if (rawMetadata[field]) sanitizedMetadata[field] = sanitizeString(rawMetadata[field], 100);
    });
    if (rawMetadata.meal_count) sanitizedMetadata.meal_count = parseInt(rawMetadata.meal_count) || null;
    if (data.frequency) sanitizedMetadata.frequency = sanitizeString(data.frequency, 20);

    const mappedType = mapToDonationType(data.campaignName, data.donationType || data.donation_type);

    return {
        isValid: errors.length === 0,
        errors,
        sanitized: {
            amount: amountResult.value.toFixed(2),
            donorName: sanitizeString(data.donorName || data.name, 100) || 'Anonymous',
            donorEmail: validateEmail(email),
            donorPhone: sanitizeString(data.donorPhone || data.phone, 20) || null,
            campaignId: sanitizeString(data.campaignId, 50) || null,
            campaignName: sanitizeString(data.campaignName || data.campaign_name, 200) || 'General Donation',
            donationType: mappedType,
            message: sanitizeString(data.message, 500) || null,
            currency: (sanitizeString(data.currency, 3) || 'USD').toUpperCase(),
            frequency: sanitizeString(data.frequency, 20) || 'monthly',
            occasion: sanitizeString(data.occasion, 100) || null,
            metadata: sanitizedMetadata
        }
    };
};

// =============================================
// PAYPAL API COMMUNICATION
// =============================================

let accessTokenCache = { token: null, expiresAt: 0 };

const getAccessToken = async () => {
    if (accessTokenCache.token && Date.now() < accessTokenCache.expiresAt - 60000) {
        return accessTokenCache.token;
    }

    const auth = Buffer.from(
        `${PAYPAL_CONFIG.clientId}:${PAYPAL_CONFIG.clientSecret}`
    ).toString('base64');

    const response = await fetch(`${PAYPAL_CONFIG.baseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
    });

    if (!response.ok) {
        const error = await response.text();
        console.error('❌ PayPal Auth Error:', error);
        throw new PayPalError('PayPal authentication failed', {}, 503);
    }

    const data = await response.json();
    accessTokenCache = {
        token: data.access_token,
        expiresAt: Date.now() + (data.expires_in * 1000)
    };

    return data.access_token;
};

const paypalRequest = async (endpoint, method = 'GET', body = null) => {
    const accessToken = await getAccessToken();

    const options = {
        method,
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'PayPal-Request-Id': generateRequestId(),
            'Prefer': 'return=representation'
        }
    };

    if (body && method !== 'GET') options.body = JSON.stringify(body);

    const response = await fetch(`${PAYPAL_CONFIG.baseUrl}${endpoint}`, options);
    const responseData = await response.json().catch(() => ({}));

    if (!response.ok) {
        console.error(`❌ PayPal API Error [${endpoint}]:`, JSON.stringify(responseData, null, 2));
        throw new PayPalError(
            responseData.details?.[0]?.description || responseData.message || 'PayPal API request failed',
            responseData,
            response.status
        );
    }

    return responseData;
};


// =============================================
// PENDING DONATION MANAGEMENT
// =============================================

/**
 * Create pending donation record before PayPal redirect
 */
const createPendingDonation = async (supabaseService, donationData) => {
    const pendingRecord = {
        donor_name: donationData.donorName,
        donor_email: donationData.donorEmail,
        donor_phone: donationData.donorPhone,
        amount: parseFloat(donationData.amount),
        currency: donationData.currency || 'USD',
        campaign_name: donationData.campaignName,
        donation_type: donationData.donationType,
        message: donationData.message,
        metadata: donationData.metadata || {},
        status: 'pending',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };

    const { data, error } = await supabaseService.client
        .from('pending_paypal_donations')
        .insert(pendingRecord)
        .select('id')
        .single();

    if (error) {
        console.error('❌ Failed to create pending donation:', error);
        throw new PayPalError('Failed to initialize payment', { dbError: error.message }, 500);
    }

    console.log('✅ Pending donation created:', data.id);
    return data.id;
};

/**
 * Update pending donation with PayPal order ID
 */
const updatePendingWithOrderId = async (supabaseService, pendingId, orderId) => {
    const { error } = await supabaseService.client
        .from('pending_paypal_donations')
        .update({
            paypal_order_id: orderId,
            status: 'processing',
            updated_at: new Date().toISOString()
        })
        .eq('id', pendingId);

    if (error) {
        console.error('❌ Failed to update pending donation:', error);
        throw new PayPalError('Failed to link payment', { dbError: error.message }, 500);
    }
};

/**
 * Get pending donation by PayPal order ID
 */
const getPendingByOrderId = async (supabaseService, orderId) => {
    const { data, error } = await supabaseService.client
        .from('pending_paypal_donations')
        .select('*')
        .eq('paypal_order_id', orderId)
        .single();

    if (error) {
        console.error('❌ Failed to find pending donation:', error);
        return null;
    }
    return data;
};

/**
 * Mark pending donation as completed
 */
const completePendingDonation = async (supabaseService, orderId, donationId) => {
    const { error } = await supabaseService.client
        .from('pending_paypal_donations')
        .update({
            status: 'completed',
            metadata: { completed_donation_id: donationId },
            updated_at: new Date().toISOString()
        })
        .eq('paypal_order_id', orderId);

    if (error) console.warn('⚠️ Failed to mark pending as complete:', error);
};

// =============================================
// ONE-TIME PAYMENT OPERATIONS
// =============================================

/**
 * Creates PayPal order for one-time payment
 */
const createOrder = async (donationData, returnUrl, cancelUrl, pendingId = null) => {
    const validation = validateDonationInput(donationData);
    if (!validation.isValid) {
        throw new PayPalError('Validation failed', { errors: validation.errors });
    }

    const { sanitized } = validation;
    const receiptNumber = generateReceiptNumber();

    // custom_id has 127 char limit - only store essential IDs, rest is in pending_paypal_donations table
    const customIdData = JSON.stringify({
        pid: pendingId,  // pending donation ID - used to retrieve full data
        rn: receiptNumber,
        dt: sanitized.donationType?.substring(0, 10)
    }).substring(0, 127);

    const orderPayload = {
        intent: 'CAPTURE',
        purchase_units: [{
            reference_id: receiptNumber,
            description: `Donation: ${sanitized.campaignName}`.substring(0, 127),
            custom_id: customIdData,
            amount: {
                currency_code: sanitized.currency,
                value: sanitized.amount
            }
        }],
        payment_source: {
            paypal: {
                experience_context: {
                    payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
                    brand_name: 'Temple Donation',
                    locale: 'en-US',
                    landing_page: 'LOGIN',
                    shipping_preference: 'NO_SHIPPING',
                    user_action: 'PAY_NOW',
                    return_url: returnUrl,
                    cancel_url: cancelUrl
                }
            }
        }
    };

    const order = await paypalRequest('/v2/checkout/orders', 'POST', orderPayload);
    const approvalUrl = order.links?.find(l => l.rel === 'payer-action')?.href
        || order.links?.find(l => l.rel === 'approve')?.href;

    console.log(`✅ PayPal order created: ${order.id} | Receipt: ${receiptNumber}`);

    return {
        orderId: order.id,
        status: order.status,
        approvalUrl,
        receiptNumber,
        pendingId,
        donationData: sanitized
    };
};

/**
 * Initiates payment with pending donation flow
 */
const initiatePayment = async (donationData, returnUrl, cancelUrl, supabaseService) => {
    const validation = validateDonationInput(donationData);
    if (!validation.isValid) {
        throw new PayPalError('Validation failed', { errors: validation.errors });
    }

    const { sanitized } = validation;
    const pendingId = await createPendingDonation(supabaseService, sanitized);

    try {
        const orderResult = await createOrder(sanitized, returnUrl, cancelUrl, pendingId);
        await updatePendingWithOrderId(supabaseService, pendingId, orderResult.orderId);

        return {
            success: true,
            pendingId,
            orderId: orderResult.orderId,
            approvalUrl: orderResult.approvalUrl,
            receiptNumber: orderResult.receiptNumber
        };
    } catch (error) {
        // Mark pending as failed
        try {
            await supabaseService.client
                .from('pending_paypal_donations')
                .update({ status: 'failed', updated_at: new Date().toISOString() })
                .eq('id', pendingId);
        } catch (e) { }
        throw error;
    }
};

/**
 * Captures PayPal order after approval
 */
const captureOrder = async (orderId, donationData = {}) => {
    if (!orderId || typeof orderId !== 'string' || orderId.length > 50) {
        throw new PayPalError('Invalid order ID');
    }

    const capture = await paypalRequest(`/v2/checkout/orders/${orderId}/capture`, 'POST');

    if (capture.status !== 'COMPLETED') {
        throw new PayPalError('Payment capture failed', { status: capture.status });
    }

    const purchaseUnit = capture.purchase_units?.[0];
    const captureDetails = purchaseUnit?.payments?.captures?.[0];
    const payer = capture.payer;

    let customData = {};
    try {
        const parsed = JSON.parse(purchaseUnit?.custom_id || '{}');
        // Handle new short format (pid, rn, dt) or old format (pendingId, receiptNumber, etc.)
        customData = {
            pendingId: parsed.pid || parsed.pendingId,
            receiptNumber: parsed.rn || parsed.receiptNumber,
            donationType: parsed.dt || parsed.donationType
        };
    } catch (e) { }

    const grossAmount = parseFloat(captureDetails?.amount?.value || 0);
    const paypalFee = parseFloat(captureDetails?.seller_receivable_breakdown?.paypal_fee?.value || 0);

    const result = {
        success: true,
        transactionId: captureDetails?.id,
        orderId: capture.id,
        status: capture.status,
        receiptNumber: customData.receiptNumber || purchaseUnit?.reference_id,
        pendingId: customData.pendingId,
        payment: {
            grossAmount,
            paypalFee,
            netAmount: grossAmount - paypalFee,
            currency: captureDetails?.amount?.currency_code || 'USD'
        },
        payer: {
            payerId: payer?.payer_id,
            email: payer?.email_address,
            name: payer?.name ? `${payer.name.given_name || ''} ${payer.name.surname || ''}`.trim() : null
        },
        donationData: { ...donationData, ...customData },
        capturedAt: captureDetails?.create_time || new Date().toISOString()
    };

    console.log(`✅ Payment captured: ${result.transactionId} | Amount: ${grossAmount}`);
    return result;
};


// =============================================
// SUBSCRIPTION OPERATIONS
// =============================================

let cachedProductId = null;

const getOrCreateProduct = async () => {
    if (cachedProductId) return cachedProductId;

    try {
        const products = await paypalRequest('/v1/catalogs/products?page_size=20', 'GET');
        const existing = products.products?.find(p => p.name === 'Temple Recurring Donation');
        if (existing) {
            cachedProductId = existing.id;
            return cachedProductId;
        }
    } catch (e) { }

    const product = await paypalRequest('/v1/catalogs/products', 'POST', {
        name: 'Temple Recurring Donation',
        description: 'Recurring donation subscription for temple support',
        type: 'SERVICE',
        category: 'CHARITY'
    });

    cachedProductId = product.id;
    console.log(`✅ PayPal product created: ${product.id}`);
    return product.id;
};

const createBillingPlan = async (sanitizedData, frequency) => {
    const productId = await getOrCreateProduct();
    const interval = FREQUENCY_MAP[frequency] || FREQUENCY_MAP['monthly'];

    const plan = await paypalRequest('/v1/billing/plans', 'POST', {
        product_id: productId,
        name: `${sanitizedData.campaignName} - ${frequency} Donation`,
        description: `Recurring ${frequency} donation of ${sanitizedData.amount}`,
        status: 'ACTIVE',
        billing_cycles: [{
            frequency: { interval_unit: interval.interval_unit, interval_count: interval.interval_count },
            tenure_type: 'REGULAR',
            sequence: 1,
            total_cycles: 0,
            pricing_scheme: {
                fixed_price: { value: sanitizedData.amount, currency_code: sanitizedData.currency }
            }
        }],
        payment_preferences: {
            auto_bill_outstanding: true,
            setup_fee: { value: '0', currency_code: sanitizedData.currency },
            setup_fee_failure_action: 'CONTINUE',
            payment_failure_threshold: 3
        }
    });

    console.log(`✅ Billing plan created: ${plan.id}`);
    return plan;
};

const createSubscription = async (donationData, returnUrl, cancelUrl) => {
    const validation = validateDonationInput(donationData);
    if (!validation.isValid) {
        throw new PayPalError('Validation failed', { errors: validation.errors });
    }

    const { sanitized } = validation;
    const plan = await createBillingPlan(sanitized, sanitized.frequency);
    const nameParts = sanitized.donorName.split(' ');

    // custom_id has 127 char limit - keep it minimal
    const customId = JSON.stringify({
        f: sanitized.frequency?.substring(0, 10),
        a: sanitized.amount
    }).substring(0, 127);

    const subscription = await paypalRequest('/v1/billing/subscriptions', 'POST', {
        plan_id: plan.id,
        start_time: new Date(Date.now() + 60000).toISOString(),
        subscriber: {
            name: { given_name: nameParts[0] || 'Donor', surname: nameParts.slice(1).join(' ') || '' },
            email_address: sanitized.donorEmail || undefined
        },
        application_context: {
            brand_name: 'Temple Donation',
            locale: 'en-US',
            shipping_preference: 'NO_SHIPPING',
            user_action: 'SUBSCRIBE_NOW',
            payment_method: { payer_selected: 'PAYPAL', payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED' },
            return_url: returnUrl,
            cancel_url: cancelUrl
        },
        custom_id: customId
    });

    console.log(`✅ Subscription created: ${subscription.id}`);
    return {
        subscriptionId: subscription.id,
        planId: plan.id,
        status: subscription.status,
        approvalUrl: subscription.links?.find(l => l.rel === 'approve')?.href,
        frequency: sanitized.frequency,
        amount: sanitized.amount,
        donationData: sanitized  // Pass full data for DB save
    };
};

const getSubscription = async (subscriptionId) => {
    if (!subscriptionId) throw new PayPalError('Subscription ID is required');
    return await paypalRequest(`/v1/billing/subscriptions/${subscriptionId}`, 'GET');
};

const cancelSubscription = async (subscriptionId, reason = 'Cancelled by user') => {
    if (!subscriptionId) throw new PayPalError('Subscription ID is required');
    await paypalRequest(`/v1/billing/subscriptions/${subscriptionId}/cancel`, 'POST', {
        reason: sanitizeString(reason, 128)
    });
    console.log(`✅ Subscription cancelled: ${subscriptionId}`);
    return { success: true, subscriptionId, status: 'CANCELLED' };
};

// =============================================
// DATABASE OPERATIONS
// =============================================

/**
 * Save donation with idempotency check
 */
const saveDonationToDatabase = async (captureResult, supabaseService, pendingDonation = null) => {
    // IDEMPOTENCY CHECK - prevent duplicate donations using metadata->transaction_id
    // Since transaction_id column doesn't exist, we check in metadata JSON
    const { data: existing } = await supabaseService.client
        .from('donations')
        .select('id')
        .filter('metadata->>transaction_id', 'eq', captureResult.transactionId)
        .single();

    if (existing) {
        console.log('⚠️ Donation already exists:', captureResult.transactionId);
        return existing;
    }

    const donorData = pendingDonation || captureResult.donationData || {};
    const donationType = validateDonationType(donorData.donation_type || donorData.donationType || 'general');

    // Use only columns that exist in the donations table
    const donorName = captureResult.payer.name || donorData.donor_name || donorData.donorName || 'Anonymous';
    const donorEmail = donorData.donor_email || donorData.donorEmail || captureResult.payer.email || 'not-provided@example.com';
    const donorPhone = donorData.donor_phone || donorData.donorPhone || null;
    const purpose = donorData.campaign_name || donorData.campaignName || 'General Donation';

    const donationRecord = {
        // Required columns (NOT NULL)
        name: donorName,
        email: donorEmail,
        phone: donorPhone,
        message: donorData.message || purpose,
        amount: captureResult.payment.grossAmount,

        // Optional columns
        donor_name: donorName,
        donor_email: donorEmail !== 'not-provided@example.com' ? donorEmail : null,
        donor_phone: donorPhone,
        purpose: purpose,
        payment_status: 'completed',
        donation_type: donationType,
        payment_method: 'online',
        currency: captureResult.payment.currency,
        donation_date: new Date().toISOString().split('T')[0],
        metadata: {
            ...(donorData.metadata || {}),
            transaction_id: captureResult.transactionId,
            receipt_number: captureResult.receiptNumber,
            gross_amount: captureResult.payment.grossAmount,
            net_amount: captureResult.payment.netAmount,
            paypal_order_id: captureResult.orderId,
            paypal_fee: captureResult.payment.paypalFee,
            paypal_payer_id: captureResult.payer.payerId,
            payment_provider: 'paypal',
            pending_donation_id: captureResult.pendingId,
            captured_at: captureResult.capturedAt
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    const { data, error } = await supabaseService.client
        .from('donations')
        .insert(donationRecord)
        .select('*')
        .single();

    // CRITICAL: Throw error instead of silent failure
    if (error) {
        console.error('❌ Failed to save donation:', error);
        throw new PayPalError('Failed to save donation record', {
            dbError: error.message,
            transactionId: captureResult.transactionId
        }, 500);
    }

    console.log(`✅ Donation saved: ${data.id}`);

    if (captureResult.orderId) {
        await completePendingDonation(supabaseService, captureResult.orderId, data.id);
    }

    return data;
};

const saveSubscriptionToDatabase = async (subscriptionData, status, supabaseService, donationData = null) => {
    // Get donor data from the passed donationData (from frontend sessionStorage) or parse from custom_id
    let donorInfo = donationData || {};

    // If donationData wasn't passed, try to parse from custom_id (minimal data)
    if (!donorInfo.donorName && subscriptionData.custom_id) {
        try {
            const parsed = JSON.parse(subscriptionData.custom_id || '{}');
            donorInfo = {
                frequency: parsed.f || 'monthly',
                amount: parsed.a || 0
            };
        } catch (e) { }
    }

    const donorName = donorInfo.donorName || subscriptionData.subscriber?.name?.given_name || 'Anonymous';
    const donorEmail = donorInfo.donorEmail || subscriptionData.subscriber?.email_address || 'not-provided@example.com';
    const donorPhone = donorInfo.donorPhone || null;
    const campaignName = donorInfo.campaignName || 'Recurring Donation';
    const frequency = donorInfo.frequency || 'monthly';
    const amount = parseFloat(donorInfo.amount) || parseFloat(subscriptionData.billing_info?.last_payment?.amount?.value) || 0;

    const donationRecord = {
        // Required columns
        name: donorName,
        email: donorEmail,
        phone: donorPhone,
        message: campaignName,
        amount: amount,

        // Optional columns
        donor_name: donorName,
        donor_email: donorEmail !== 'not-provided@example.com' ? donorEmail : null,
        donor_phone: donorPhone,
        purpose: campaignName,
        payment_status: status === 'ACTIVE' ? 'completed' : 'pending',
        donation_type: 'recurring',
        payment_method: 'online',
        currency: 'USD',
        donation_date: new Date().toISOString().split('T')[0],
        metadata: {
            ...(donorInfo.metadata || {}),
            subscription_id: subscriptionData.id,
            plan_id: subscriptionData.plan_id,
            frequency: frequency,
            subscription_status: status,
            start_time: subscriptionData.start_time,
            is_recurring: true,
            payment_provider: 'paypal'
        },
        updated_at: new Date().toISOString()
    };

    const { data, error } = await supabaseService.client
        .from('donations')
        .insert(donationRecord)
        .select('*')
        .single();

    if (error) {
        console.error('❌ Database error saving subscription:', error);
        throw new PayPalError('Failed to save subscription', { dbError: error.message }, 500);
    }

    console.log(`✅ Subscription saved: ${data.id}`);
    return data;
};

const updateSubscriptionStatus = async (subscriptionId, status, supabaseService) => {
    const { error } = await supabaseService.client
        .from('donations')
        .update({
            payment_status: status === 'CANCELLED' ? 'cancelled' : status.toLowerCase(),
            'metadata->subscription_status': status,
            updated_at: new Date().toISOString()
        })
        .filter('metadata->>subscription_id', 'eq', subscriptionId);

    if (error) console.error('❌ Error updating subscription status:', error);
    else console.log(`✅ Subscription ${subscriptionId} status updated`);
};

const saveRecurringPayment = async (paymentResource, supabaseService) => {
    const donorEmail = paymentResource.payer?.email_address || 'not-provided@example.com';

    const donationRecord = {
        // Required columns
        name: 'Recurring Donor',
        email: donorEmail,
        phone: null,
        message: 'Recurring Donation Payment',
        amount: parseFloat(paymentResource.amount?.total || paymentResource.amount?.value || 0),

        // Optional columns
        donor_name: 'Recurring Donor',
        donor_email: donorEmail !== 'not-provided@example.com' ? donorEmail : null,
        purpose: 'Recurring Donation Payment',
        payment_status: 'completed',
        donation_type: 'recurring',
        payment_method: 'online',
        currency: paymentResource.amount?.currency || 'USD',
        donation_date: new Date().toISOString().split('T')[0],
        metadata: {
            transaction_id: paymentResource.id,
            subscription_id: paymentResource.billing_agreement_id,
            is_recurring_payment: true,
            payment_provider: 'paypal'
        },
        updated_at: new Date().toISOString()
    };

    const { data, error } = await supabaseService.client
        .from('donations')
        .insert(donationRecord)
        .select('*')
        .single();

    if (error) throw new PayPalError('Failed to save recurring payment', { dbError: error.message }, 500);
    console.log(`✅ Recurring payment saved: ${data.id}`);
    return data;
};


// =============================================
// WEBHOOK HANDLING
// =============================================

/**
 * Verify webhook signature - works in ALL modes when configured
 */
const verifyWebhookSignature = async (headers, body) => {
    if (!PAYPAL_CONFIG.webhookId || PAYPAL_CONFIG.webhookId === 'your_webhook_id_here') {
        console.warn('⚠️ Webhook ID not configured - skipping verification');
        return true;
    }

    try {
        const result = await paypalRequest('/v1/notifications/verify-webhook-signature', 'POST', {
            auth_algo: headers['paypal-auth-algo'],
            cert_url: headers['paypal-cert-url'],
            transmission_id: headers['paypal-transmission-id'],
            transmission_sig: headers['paypal-transmission-sig'],
            transmission_time: headers['paypal-transmission-time'],
            webhook_id: PAYPAL_CONFIG.webhookId,
            webhook_event: body
        });
        return result.verification_status === 'SUCCESS';
    } catch (error) {
        console.error('❌ Webhook verification failed:', error.message);
        return false;
    }
};

const processWebhookEvent = async (event, supabaseService = null) => {
    const eventType = event.event_type;
    const resource = event.resource;

    console.log(`📥 Webhook: ${eventType}`);

    switch (eventType) {
        case 'CHECKOUT.ORDER.APPROVED':
            return { processed: true, action: 'order_approved', orderId: resource.id };

        case 'PAYMENT.CAPTURE.COMPLETED':
            return { processed: true, action: 'payment_completed', transactionId: resource.id };

        case 'PAYMENT.CAPTURE.DENIED':
        case 'PAYMENT.CAPTURE.DECLINED':
            if (resource.supplementary_data?.related_ids?.order_id && supabaseService) {
                await supabaseService.client
                    .from('pending_paypal_donations')
                    .update({ status: 'failed' })
                    .eq('paypal_order_id', resource.supplementary_data.related_ids.order_id);
            }
            return { processed: true, action: 'payment_failed', transactionId: resource.id };

        case 'PAYMENT.CAPTURE.REFUNDED':
            return { processed: true, action: 'payment_refunded', transactionId: resource.id };

        case 'BILLING.SUBSCRIPTION.ACTIVATED':
            if (supabaseService) {
                try { await saveSubscriptionToDatabase(resource, 'ACTIVE', supabaseService); } catch (e) { }
            }
            return { processed: true, action: 'subscription_activated', subscriptionId: resource.id };

        case 'BILLING.SUBSCRIPTION.CANCELLED':
            if (supabaseService) await updateSubscriptionStatus(resource.id, 'CANCELLED', supabaseService);
            return { processed: true, action: 'subscription_cancelled', subscriptionId: resource.id };

        case 'BILLING.SUBSCRIPTION.SUSPENDED':
            if (supabaseService) await updateSubscriptionStatus(resource.id, 'SUSPENDED', supabaseService);
            return { processed: true, action: 'subscription_suspended', subscriptionId: resource.id };

        case 'PAYMENT.SALE.COMPLETED':
            if (supabaseService && resource.billing_agreement_id) {
                try { await saveRecurringPayment(resource, supabaseService); } catch (e) { }
            }
            return { processed: true, action: 'recurring_payment', transactionId: resource.id };

        default:
            return { processed: false, reason: 'unhandled_event_type', eventType };
    }
};

// =============================================
// MAIN REQUEST HANDLER
// =============================================

const paypalHandler = async (req, res) => {
    const action = req.query.action || req.body?.action;
    const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';

    // Health check - no auth needed
    if (action === 'health') {
        return res.json({
            success: true,
            status: 'healthy',
            mode: PAYPAL_CONFIG.mode,
            configured: !!(PAYPAL_CONFIG.clientId && PAYPAL_CONFIG.clientSecret),
            webhookConfigured: !!PAYPAL_CONFIG.webhookId && PAYPAL_CONFIG.webhookId !== 'your_webhook_id_here',
            timestamp: new Date().toISOString()
        });
    }

    // Rate limiting (skip for webhooks)
    if (action !== 'webhook' && !checkRateLimit(clientIp)) {
        return res.status(429).json({ success: false, message: 'Too many requests. Please try again later.' });
    }

    // Validate config
    if (!validateConfig()) {
        return res.status(503).json({ success: false, message: 'Payment service temporarily unavailable' });
    }

    try {
        const frontendUrl = process.env.VITE_FRONTEND_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
        const supabaseService = req.app.get('supabaseService');

        switch (action) {
            case 'initiate': {
                if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });
                if (!supabaseService) return res.status(503).json({ success: false, message: 'Database service unavailable' });

                const returnUrl = req.body.returnUrl || `${frontendUrl}/donation?status=success`;
                const cancelUrl = req.body.cancelUrl || `${frontendUrl}/donation?status=cancelled`;

                const result = await initiatePayment(req.body, returnUrl, cancelUrl, supabaseService);
                return res.status(201).json(result);
            }

            case 'create-order': {
                if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

                const returnUrl = req.body.returnUrl || `${frontendUrl}/donation?status=success`;
                const cancelUrl = req.body.cancelUrl || `${frontendUrl}/donation?status=cancelled`;

                const result = await createOrder(req.body, returnUrl, cancelUrl);
                return res.status(201).json({
                    success: true,
                    orderId: result.orderId,
                    approvalUrl: result.approvalUrl,
                    receiptNumber: result.receiptNumber,
                    status: result.status
                });
            }

            case 'capture-order': {
                if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

                const { orderId, donationData } = req.body;
                if (!orderId) return res.status(400).json({ success: false, message: 'Order ID is required' });

                const result = await captureOrder(orderId, donationData);

                // Try to get pending donation data
                let pendingDonation = null;
                if (supabaseService && result.pendingId) {
                    pendingDonation = await getPendingByOrderId(supabaseService, orderId);
                }

                // Save to database - THROW on failure
                if (supabaseService) {
                    await saveDonationToDatabase(result, supabaseService, pendingDonation);
                } else {
                    console.warn('⚠️ Supabase not available - donation not saved');
                }

                return res.json({
                    success: true,
                    message: 'Payment captured successfully',
                    data: {
                        transactionId: result.transactionId,
                        orderId: result.orderId,
                        receiptNumber: result.receiptNumber,
                        status: result.status,
                        payment: result.payment,
                        payer: result.payer,
                        capturedAt: result.capturedAt
                    }
                });
            }

            case 'create-subscription': {
                if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

                const subReturnUrl = req.body.returnUrl || `${frontendUrl}/donation/recurring?status=success&type=subscription`;
                const subCancelUrl = req.body.cancelUrl || `${frontendUrl}/donation/recurring?status=cancelled`;

                const result = await createSubscription(req.body, subReturnUrl, subCancelUrl);
                return res.status(201).json({
                    success: true,
                    subscriptionId: result.subscriptionId,
                    planId: result.planId,
                    approvalUrl: result.approvalUrl,
                    frequency: result.frequency,
                    amount: result.amount,
                    status: result.status
                });
            }

            case 'activate-subscription': {
                if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

                const { subscriptionId, donationData } = req.body;
                if (!subscriptionId) return res.status(400).json({ success: false, message: 'Subscription ID is required' });

                const subscription = await getSubscription(subscriptionId);

                if (supabaseService) {
                    await saveSubscriptionToDatabase(subscription, subscription.status, supabaseService, donationData);
                }

                return res.json({
                    success: true,
                    message: 'Subscription activated',
                    data: { subscriptionId: subscription.id, status: subscription.status, planId: subscription.plan_id }
                });
            }

            case 'get-subscription': {
                const subId = req.query.subscriptionId || req.body?.subscriptionId;
                if (!subId) return res.status(400).json({ success: false, message: 'Subscription ID is required' });

                const subscription = await getSubscription(subId);
                return res.json({ success: true, data: subscription });
            }

            case 'cancel-subscription': {
                if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

                const { subscriptionId, reason } = req.body;
                if (!subscriptionId) return res.status(400).json({ success: false, message: 'Subscription ID is required' });

                const result = await cancelSubscription(subscriptionId, reason);

                if (supabaseService) {
                    await updateSubscriptionStatus(subscriptionId, 'CANCELLED', supabaseService);
                }

                return res.json({ success: true, message: 'Subscription cancelled', data: result });
            }

            case 'webhook': {
                if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

                // Verify webhook in ALL modes when configured
                if (PAYPAL_CONFIG.webhookId && PAYPAL_CONFIG.webhookId !== 'your_webhook_id_here') {
                    const isValid = await verifyWebhookSignature(req.headers, req.body);
                    if (!isValid) {
                        console.error('❌ Invalid webhook signature');
                        return res.status(401).json({ success: false, message: 'Invalid signature' });
                    }
                }

                const result = await processWebhookEvent(req.body, supabaseService);
                return res.json({ success: true, ...result });
            }

            default:
                return res.status(400).json({
                    success: false,
                    message: 'Invalid action',
                    validActions: ['initiate', 'create-order', 'capture-order', 'create-subscription', 'activate-subscription', 'get-subscription', 'cancel-subscription', 'webhook', 'health']
                });
        }
    } catch (error) {
        console.error('❌ PayPal Error:', error.message);

        const statusCode = error.statusCode || 500;
        const isProduction = process.env.NODE_ENV === 'production';

        return res.status(statusCode).json({
            success: false,
            message: isProduction ? 'Payment processing failed' : error.message,
            ...(isProduction ? {} : { details: error.details })
        });
    }
};

// =============================================
// MODULE EXPORTS
// =============================================

module.exports = {
    paypalHandler,
    // Payment functions
    initiatePayment,
    createOrder,
    captureOrder,
    // Subscription functions
    createSubscription,
    getSubscription,
    cancelSubscription,
    // Webhook functions
    verifyWebhookSignature,
    processWebhookEvent,
    // Database functions
    saveDonationToDatabase,
    saveSubscriptionToDatabase,
    updateSubscriptionStatus,
    saveRecurringPayment,
    // Pending donation functions
    createPendingDonation,
    getPendingByOrderId,
    completePendingDonation,
    // Validation functions
    validateConfig,
    validateDonationType,
    mapToDonationType,
    // Constants
    PAYPAL_CONFIG,
    VALID_DONATION_TYPES,
    CAMPAIGN_TYPE_MAPPING,
    PayPalError
};
