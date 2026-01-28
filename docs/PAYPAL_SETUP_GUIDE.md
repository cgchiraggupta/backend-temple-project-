# PayPal Payment Integration Guide

## Overview

This temple donation system uses PayPal for processing both one-time and
recurring donations. The integration supports:

- **One-time donations** - Single payments via PayPal checkout
- **Recurring donations** - Monthly, quarterly, or yearly subscriptions

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│    Backend      │────▶│     PayPal      │
│  (Next.js)      │     │  (Express)      │     │     API         │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │    Supabase     │
                        │   (Database)    │
                        └─────────────────┘
```

## Payment Flow

### One-Time Donation Flow

1. User fills donation form on frontend
2. Frontend calls `POST /api/paypal?action=create-order`
3. Backend creates PayPal order and returns approval URL
4. User is redirected to PayPal to complete payment
5. PayPal redirects back to frontend with `?status=success&token={orderId}`
6. Frontend calls `POST /api/paypal/capture-order` with orderId
7. Backend captures payment and saves donation to database

### Recurring Donation Flow

1. User fills donation form with frequency (monthly/quarterly/yearly)
2. Frontend calls `POST /api/paypal?action=create-subscription`
3. Backend creates billing plan and subscription, returns approval URL
4. User is redirected to PayPal to approve subscription
5. PayPal redirects back with
   `?status=success&type=subscription&subscription_id={id}`
6. Frontend calls `POST /api/paypal/activate-subscription`
7. Backend verifies subscription and saves to database

## Environment Variables

### Required Variables

| Variable               | Description                                  | Example        |
| ---------------------- | -------------------------------------------- | -------------- |
| `PAYPAL_CLIENT_ID`     | Your PayPal app Client ID                    | `AaBbCc123...` |
| `PAYPAL_CLIENT_SECRET` | Your PayPal app Secret                       | `EeFfGg456...` |
| `PAYPAL_MODE`          | `sandbox` for testing, `live` for production | `sandbox`      |

### Optional Variables

| Variable            | Description                        |
| ------------------- | ---------------------------------- |
| `PAYPAL_WEBHOOK_ID` | For webhook signature verification |

## API Endpoints

### Create Order (One-Time)

```
POST /api/paypal?action=create-order

Body:
{
  "amount": 100,
  "donorName": "John Doe",
  "donorEmail": "john@example.com",
  "donorPhone": "+1234567890",
  "campaignName": "General Donation",
  "donationType": "general",
  "message": "Optional message",
  "returnUrl": "https://yoursite.com/donation?status=success",
  "cancelUrl": "https://yoursite.com/donation?status=cancelled"
}

Response:
{
  "success": true,
  "orderId": "5O190127TN364715T",
  "approvalUrl": "https://www.sandbox.paypal.com/checkoutnow?token=..."
}
```

### Capture Order

```
POST /api/paypal/capture-order

Body:
{
  "orderId": "5O190127TN364715T",
  "donationData": { ... } // Optional: donor info from frontend
}

Response:
{
  "success": true,
  "transactionId": "8MC585209K746392H",
  "donation": { ... }
}
```

### Create Subscription (Recurring)

```
POST /api/paypal?action=create-subscription

Body:
{
  "amount": 50,
  "donorName": "Jane Doe",
  "donorEmail": "jane@example.com",
  "frequency": "monthly", // monthly, quarterly, yearly
  "campaignName": "Monthly Support",
  "returnUrl": "https://yoursite.com/recurring?status=success&type=subscription",
  "cancelUrl": "https://yoursite.com/recurring?status=cancelled"
}

Response:
{
  "success": true,
  "subscriptionId": "I-BW452GLLEP1G",
  "approvalUrl": "https://www.sandbox.paypal.com/webapps/billing/subscriptions?..."
}
```

### Activate Subscription

```
POST /api/paypal/activate-subscription

Body:
{
  "subscriptionId": "I-BW452GLLEP1G",
  "donationData": { ... } // Donor info from frontend sessionStorage
}

Response:
{
  "success": true,
  "message": "Subscription activated",
  "data": { "subscriptionId": "...", "status": "ACTIVE" }
}
```

---

# Switching to Production (Live Payments)

## Step 1: Get Live PayPal Credentials

1. Go to
   [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/applications/live)
2. Log in with your **business PayPal account**
3. Click **"Live"** tab (not Sandbox)
4. Click **"Create App"** or select existing app
5. Copy the **Client ID** and **Secret**

> ⚠️ **Important**: Live credentials are different from sandbox credentials!

## Step 2: Update Render Environment Variables

Go to your Render dashboard → `temple-backend-testing-v3` → **Environment** tab

Update these variables:

| Variable               | Value                   |
| ---------------------- | ----------------------- |
| `PAYPAL_CLIENT_ID`     | Your **LIVE** Client ID |
| `PAYPAL_CLIENT_SECRET` | Your **LIVE** Secret    |
| `PAYPAL_MODE`          | `live`                  |

## Step 3: Verify Business Account

For live payments, your PayPal account must be:

- A **Business account** (not Personal)
- **Verified** with bank account linked
- **Email confirmed**

## Step 4: Test with Small Amount

Before going fully live:

1. Make a $1 test donation
2. Verify it appears in your PayPal account
3. Verify it's saved in your database
4. Issue a refund for the test payment

## Step 5: Update Webhook (Optional but Recommended)

For production, set up webhooks to handle:

- Payment failures
- Subscription cancellations
- Disputes/chargebacks

1. In PayPal Developer Dashboard → Your Live App → **Webhooks**
2. Add webhook URL:
   `https://temple-backend-testing-v3.onrender.com/api/paypal/webhook`
3. Subscribe to events:
   - `PAYMENT.CAPTURE.COMPLETED`
   - `BILLING.SUBSCRIPTION.ACTIVATED`
   - `BILLING.SUBSCRIPTION.CANCELLED`
4. Copy the **Webhook ID** and add to Render: `PAYPAL_WEBHOOK_ID`

---

## Quick Reference: Environment Comparison

### Sandbox (Testing)

```env
PAYPAL_CLIENT_ID=AdyTgK2cabARtVhWpGisK-VkC9TPbeEtoGy6jpSBz_zSjJVzTwpMbCEzpPR90qn_yLcugXbVTAmhjbDX
PAYPAL_CLIENT_SECRET=EEYKh1SnIsiI39L4PAwE95sfwCrPIOxepHKj9Qhgffq6-gz7w1N7HBz02dN1xl79Og_yRwaGmVNbRl4m
PAYPAL_MODE=sandbox
```

### Production (Live)

```env
PAYPAL_CLIENT_ID=<your-live-client-id>
PAYPAL_CLIENT_SECRET=<your-live-secret>
PAYPAL_MODE=live
```

---

## Troubleshooting

### "PayPal authentication failed"

- Check credentials match the mode (sandbox creds for sandbox, live for live)
- Ensure no extra spaces in environment variables
- Redeploy after changing env vars

### "The value of a field is too long"

- This was fixed - `custom_id` field now stays under 127 chars

### "Could not find column in schema"

- Donation data is stored in `metadata` JSON field for flexibility

### Subscription not saving to database

- Fixed by setting `supabaseService` on Express app

---

## Database Schema

Donations are saved to the `donations` table with this structure:

```sql
-- Required columns
name        VARCHAR     -- Donor name
email       VARCHAR     -- Donor email
phone       VARCHAR     -- Donor phone (nullable)
message     TEXT        -- Campaign name or message
amount      DECIMAL     -- Donation amount

-- Optional columns
donor_name      VARCHAR
donor_email     VARCHAR
donor_phone     VARCHAR
purpose         VARCHAR     -- Campaign name
payment_status  VARCHAR     -- 'completed', 'pending', 'cancelled'
donation_type   VARCHAR     -- 'general', 'puja', 'recurring', etc.
payment_method  VARCHAR     -- 'online' for PayPal
currency        VARCHAR     -- 'USD'
donation_date   DATE

-- PayPal data stored in metadata JSON
metadata: {
  transaction_id: "...",
  receipt_number: "...",
  paypal_order_id: "...",
  paypal_fee: 1.50,
  paypal_payer_id: "...",
  payment_provider: "paypal",

  -- For subscriptions
  subscription_id: "...",
  plan_id: "...",
  frequency: "monthly",
  is_recurring: true
}
```

---

## Support

For issues with this integration, check:

1. Render logs for backend errors
2. Browser console for frontend errors
3. PayPal Developer Dashboard for API errors
