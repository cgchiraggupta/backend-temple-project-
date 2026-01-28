# PayPal Payment Integration Documentation

## Overview

This document covers the PayPal payment integration for the Temple Donation
system. The backend supports both one-time payments and recurring subscriptions
with enhanced security features.

---

## Table of Contents

1. [Environment Setup](#environment-setup)
2. [Database Setup](#database-setup)
3. [API Endpoints](#api-endpoints)
4. [Frontend Integration](#frontend-integration)
5. [Webhook Configuration](#webhook-configuration)
6. [Testing](#testing)
7. [Going Live](#going-live)

---

## Environment Setup

### Required Environment Variables

```env
# PayPal Configuration
PAYPAL_CLIENT_ID=your_client_id
PAYPAL_CLIENT_SECRET=your_client_secret
PAYPAL_MODE=sandbox                    # 'sandbox' for testing, 'live' for production
PAYPAL_WEBHOOK_ID=your_webhook_id      # Optional but recommended

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key

# Frontend URL (for redirects)
FRONTEND_URL=http://localhost:3000     # Your CMS URL
```

### Getting PayPal Credentials

1. Go to [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/)
2. Log in with your PayPal account
3. Navigate to **Apps & Credentials**
4. Select **Sandbox** or **Live** mode
5. Click **Create App** or use existing
6. Copy **Client ID** and **Secret**

---

## Database Setup

### Required Tables

#### 1. Donations Table (main)

```sql
CREATE TABLE donations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100),
    email VARCHAR(254),
    phone VARCHAR(20),
    amount DECIMAL(10,2) NOT NULL,
    donor_name VARCHAR(100),
    donor_email VARCHAR(254),
    donor_phone VARCHAR(20),
    purpose VARCHAR(200),
    campaign_name VARCHAR(200),
    message TEXT,
    notes TEXT,
    payment_status VARCHAR(20) DEFAULT 'pending',
    donation_type VARCHAR(50) DEFAULT 'general',
    payment_method VARCHAR(20) DEFAULT 'online',
    currency VARCHAR(3) DEFAULT 'USD',
    donation_date DATE,
    transaction_id VARCHAR(50) UNIQUE,
    receipt_number VARCHAR(50),
    gross_amount DECIMAL(10,2),
    net_amount DECIMAL(10,2),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_donations_transaction_id ON donations(transaction_id);
CREATE INDEX idx_donations_email ON donations(email);
```

#### 2. Pending PayPal Donations Table

```sql
CREATE TABLE pending_paypal_donations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donor_name VARCHAR(100),
    donor_email VARCHAR(254),
    donor_phone VARCHAR(20),
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    campaign_name VARCHAR(200),
    donation_type VARCHAR(50),
    message TEXT,
    metadata JSONB DEFAULT '{}',
    paypal_order_id VARCHAR(50),
    status VARCHAR(20) DEFAULT 'pending',
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pending_paypal_order_id ON pending_paypal_donations(paypal_order_id);
CREATE INDEX idx_pending_status ON pending_paypal_donations(status);
```

### Valid Donation Types

```
general, puja, annadaana, recurring, service, sai_aangan, service_to_needy
```

---

## API Endpoints

Base URL: `POST /api/paypal?action={action}`

### Health Check

```
GET /api/paypal?action=health
```

**Response:**

```json
{
	"success": true,
	"status": "healthy",
	"mode": "sandbox",
	"configured": true,
	"webhookConfigured": true,
	"timestamp": "2025-01-01T00:00:00.000Z"
}
```

---

### One-Time Payment

#### Step 1: Initiate Payment (Recommended)

```
POST /api/paypal?action=initiate
```

**Request Body:**

```json
{
	"amount": 100.0,
	"donorName": "John Doe",
	"donorEmail": "john@example.com",
	"donorPhone": "+1234567890",
	"campaignName": "General Donation",
	"donationType": "general",
	"message": "In memory of...",
	"currency": "USD",
	"returnUrl": "https://yoursite.com/donation/success",
	"cancelUrl": "https://yoursite.com/donation/cancel",
	"metadata": {
		"occasion": "Birthday"
	}
}
```

**Response:**

```json
{
	"success": true,
	"pendingId": "uuid-here",
	"orderId": "PAYPAL_ORDER_ID",
	"approvalUrl": "https://www.sandbox.paypal.com/checkoutnow?token=...",
	"receiptNumber": "DON-ABC123-XYZ"
}
```

#### Step 2: Redirect User

Redirect user to `approvalUrl` to complete payment on PayPal.

#### Step 3: Capture Payment

After user returns from PayPal:

```
POST /api/paypal?action=capture-order
```

**Request Body:**

```json
{
	"orderId": "PAYPAL_ORDER_ID"
}
```

**Response:**

```json
{
	"success": true,
	"message": "Payment captured successfully",
	"data": {
		"transactionId": "CAPTURE_ID",
		"orderId": "ORDER_ID",
		"receiptNumber": "DON-ABC123-XYZ",
		"status": "COMPLETED",
		"payment": {
			"grossAmount": 100.0,
			"paypalFee": 3.2,
			"netAmount": 96.8,
			"currency": "USD"
		},
		"payer": {
			"payerId": "PAYER_ID",
			"email": "buyer@example.com",
			"name": "John Doe"
		},
		"capturedAt": "2025-01-01T00:00:00.000Z"
	}
}
```

---

### Recurring Subscription

#### Step 1: Create Subscription

```
POST /api/paypal?action=create-subscription
```

**Request Body:**

```json
{
	"amount": 50.0,
	"donorName": "Jane Doe",
	"donorEmail": "jane@example.com",
	"frequency": "monthly",
	"campaignName": "Monthly Support",
	"returnUrl": "https://yoursite.com/donation/recurring/success",
	"cancelUrl": "https://yoursite.com/donation/recurring/cancel"
}
```

**Frequency Options:** `weekly`, `monthly`, `quarterly`, `yearly`

**Response:**

```json
{
	"success": true,
	"subscriptionId": "I-SUBSCRIPTION_ID",
	"planId": "P-PLAN_ID",
	"approvalUrl": "https://www.sandbox.paypal.com/webapps/billing/subscriptions?...",
	"frequency": "monthly",
	"amount": "50.00",
	"status": "APPROVAL_PENDING"
}
```

#### Step 2: Activate Subscription

After user approves:

```
POST /api/paypal?action=activate-subscription
```

**Request Body:**

```json
{
	"subscriptionId": "I-SUBSCRIPTION_ID"
}
```

#### Get Subscription Details

```
GET /api/paypal?action=get-subscription&subscriptionId=I-SUBSCRIPTION_ID
```

#### Cancel Subscription

```
POST /api/paypal?action=cancel-subscription
```

**Request Body:**

```json
{
	"subscriptionId": "I-SUBSCRIPTION_ID",
	"reason": "User requested cancellation"
}
```

---

## Frontend Integration

### React/Next.js Example

```tsx
// One-Time Payment
const handleDonation = async (formData) => {
	try {
		// Step 1: Initiate payment
		const response = await fetch("/api/paypal?action=initiate", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				amount: formData.amount,
				donorName: formData.name,
				donorEmail: formData.email,
				donorPhone: formData.phone,
				campaignName: formData.campaign,
				donationType: formData.type,
				message: formData.message,
				returnUrl: `${window.location.origin}/donation/success`,
				cancelUrl: `${window.location.origin}/donation/cancel`,
			}),
		});

		const data = await response.json();

		if (data.success && data.approvalUrl) {
			// Store orderId for capture later
			sessionStorage.setItem("paypal_order_id", data.orderId);
			// Redirect to PayPal
			window.location.href = data.approvalUrl;
		}
	} catch (error) {
		console.error("Payment initiation failed:", error);
	}
};

// Success Page - Capture Payment
const capturePayment = async () => {
	const orderId = new URLSearchParams(window.location.search).get("token");

	const response = await fetch("/api/paypal?action=capture-order", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ orderId }),
	});

	const data = await response.json();

	if (data.success) {
		// Show success message with receipt
		console.log("Receipt:", data.data.receiptNumber);
	}
};
```

### Recurring Subscription Example

```tsx
const handleRecurringDonation = async (formData) => {
	const response = await fetch("/api/paypal?action=create-subscription", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			amount: formData.amount,
			donorName: formData.name,
			donorEmail: formData.email,
			frequency: formData.frequency, // 'monthly', 'weekly', etc.
			campaignName: "Monthly Donation",
			returnUrl: `${window.location.origin}/donation/recurring/success`,
			cancelUrl: `${window.location.origin}/donation/recurring/cancel`,
		}),
	});

	const data = await response.json();

	if (data.success && data.approvalUrl) {
		sessionStorage.setItem("subscription_id", data.subscriptionId);
		window.location.href = data.approvalUrl;
	}
};
```

---

## Webhook Configuration

### Setting Up Webhooks

1. Go to PayPal Developer Dashboard
2. Select your app
3. Scroll to **Webhooks**
4. Click **Add Webhook**
5. Enter URL: `https://your-backend.com/api/paypal?action=webhook`
6. Select events:
   - `CHECKOUT.ORDER.APPROVED`
   - `PAYMENT.CAPTURE.COMPLETED`
   - `PAYMENT.CAPTURE.DENIED`
   - `PAYMENT.CAPTURE.REFUNDED`
   - `BILLING.SUBSCRIPTION.ACTIVATED`
   - `BILLING.SUBSCRIPTION.CANCELLED`
   - `BILLING.SUBSCRIPTION.SUSPENDED`
   - `PAYMENT.SALE.COMPLETED`
7. Copy the **Webhook ID** to your environment variables

### Webhook Events Handled

| Event                            | Action                            |
| -------------------------------- | --------------------------------- |
| `CHECKOUT.ORDER.APPROVED`        | Order approved, ready for capture |
| `PAYMENT.CAPTURE.COMPLETED`      | Payment successful                |
| `PAYMENT.CAPTURE.DENIED`         | Payment failed                    |
| `PAYMENT.CAPTURE.REFUNDED`       | Payment refunded                  |
| `BILLING.SUBSCRIPTION.ACTIVATED` | Subscription started              |
| `BILLING.SUBSCRIPTION.CANCELLED` | Subscription cancelled            |
| `BILLING.SUBSCRIPTION.SUSPENDED` | Subscription paused               |
| `PAYMENT.SALE.COMPLETED`         | Recurring payment received        |

---

## Testing

### Sandbox Test Accounts

1. Go to PayPal Developer Dashboard
2. Navigate to **Sandbox** → **Accounts**
3. Create or use existing test accounts
4. Use sandbox buyer account to test payments

### Test Card Numbers

For sandbox testing:

- Card: `4111111111111111`
- Expiry: Any future date
- CVV: Any 3 digits

### Testing Checklist

- [ ] Health check returns success
- [ ] One-time payment creates order
- [ ] User can complete payment on PayPal
- [ ] Payment capture saves to database
- [ ] Duplicate capture returns existing donation (idempotency)
- [ ] Subscription creates successfully
- [ ] Recurring payments are recorded
- [ ] Webhooks are received and processed

---

## Going Live

### Pre-Launch Checklist

1. **PayPal Account**

   - [ ] Business account verified
   - [ ] Live app created in dashboard
   - [ ] Live credentials obtained

2. **Environment Variables**

   - [ ] `PAYPAL_MODE=live`
   - [ ] Live `PAYPAL_CLIENT_ID`
   - [ ] Live `PAYPAL_CLIENT_SECRET`
   - [ ] Live `PAYPAL_WEBHOOK_ID`
   - [ ] Production `FRONTEND_URL`

3. **Database**

   - [ ] `donations` table exists
   - [ ] `pending_paypal_donations` table exists
   - [ ] Indexes created

4. **Webhooks**

   - [ ] Live webhook URL configured
   - [ ] All required events subscribed
   - [ ] Webhook ID in environment

5. **Security**
   - [ ] HTTPS enabled
   - [ ] CORS configured for your domain
   - [ ] Rate limiting active (10 req/min per IP)

### Switching to Live Mode

```env
# Change these in production
PAYPAL_MODE=live
PAYPAL_CLIENT_ID=live_client_id_here
PAYPAL_CLIENT_SECRET=live_secret_here
PAYPAL_WEBHOOK_ID=live_webhook_id_here
```

---

## Error Handling

### Common Errors

| Error                          | Cause                    | Solution                   |
| ------------------------------ | ------------------------ | -------------------------- |
| `PayPal authentication failed` | Invalid credentials      | Check CLIENT_ID and SECRET |
| `Invalid donation type`        | Type not in allowed list | Use valid type from list   |
| `Amount must be positive`      | Zero or negative amount  | Ensure amount > 0          |
| `Minimum donation is $1`       | Amount too small         | Set amount >= 1            |
| `Too many requests`            | Rate limit exceeded      | Wait 1 minute              |
| `Failed to save donation`      | Database error           | Check Supabase connection  |

### Error Response Format

```json
{
	"success": false,
	"message": "Error description",
	"details": {
		"errors": ["Specific error 1", "Specific error 2"]
	}
}
```

---

## Security Features

1. **Rate Limiting**: 10 requests per minute per IP
2. **Input Sanitization**: XSS, SQL injection, control characters removed
3. **Idempotency**: Duplicate transactions prevented via transaction_id check
4. **Webhook Verification**: Signature verified for all modes when configured
5. **Amount Validation**: Min $1, Max $100,000
6. **Type Validation**: Only allowed donation types accepted

---

## Support

For issues:

1. Check health endpoint first
2. Verify environment variables
3. Check Supabase connection
4. Review PayPal dashboard for transaction status
5. Check webhook delivery logs in PayPal dashboard
