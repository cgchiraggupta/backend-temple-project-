# PayPal Integration - Complete Problem List

**Generated:** 2024-12-30
**Status:** Review pending before implementation

## 🔴 CRITICAL (Will Cause Failures)

### 1. `payment_method: 'paypal'` Fails DB Constraint
**File:** `src/controllers/paypal.js:444`
```js
payment_method: 'paypal',  // DB only allows: cash, upi, bank_transfer, card, cheque, online
```
**Impact:** Direct DB insert will throw PostgreSQL constraint error

---

### 2. SessionStorage Lost = Payment Captured, No Record
**File:** `temple-management-website/components/DonationPageTemplate.tsx:217`
```js
sessionStorage.setItem("pendingDonation", JSON.stringify(donationData));
```
If user returns from PayPal with empty sessionStorage (closed browser, incognito, different tab):
- **Payment is captured from PayPal** ✅
- **No donation record saved** ❌

---

### 3. DB Save Error Swallowed Silently
**File:** `src/routes/paypal.js:51-53`
```js
} catch (dbError) {
    console.error('⚠️ Database save failed, but payment was captured:', dbError);
}
```
Payment is captured, error logged, user sees "success" - **donation is LOST**

---

## 🟠 SECURITY ISSUES

### 4. Webhook Verification Skipped in Sandbox
**File:** `src/controllers/paypal.js:391-397`
```js
if (PAYPAL_CONFIG.mode === 'live') {
    const isValid = await verifyWebhookSignature(...)
```
Anyone can send fake webhook events in sandbox mode

### 5. No Webhook ID Configured
**File:** `.env` shows `PAYPAL_WEBHOOK_ID=your_webhook_id_here`
Webhook signature verification always skipped

### 6. Frontend PayPal Credentials Exposure Risk
PayPal API calls made from Next.js API routes - if `.env.local` is exposed, credentials leak

---

## 🟡 DATA INTEGRITY ISSUES

### 7. Missing Donation Type Mappings
**File:** `temple-management-website/components/DonationPageTemplate.tsx:122-134`

| Campaign | Returns | Should Be |
|----------|---------|-----------|
| "Sai Aangan Fundraising" | `general` | `sai_aangan` |
| "Service to Needy" | `service` | `service_to_needy` |

### 8. No Donation Type Validation
Backend accepts any `donationType` string - no check against DB constraint:
`['general', 'puja', 'annadaana', 'recurring', 'service', 'sai_aangan', 'service_to_needy']`

### 9. No Idempotency - Duplicate Donations Possible
No unique constraint on `transaction_id` or `paypal_order_id`. Webhook retry = duplicate record.

---

## 🔵 ARCHITECTURE ISSUES

### 10. Duplicate Code Paths
Two separate PayPal implementations:
- Frontend: `temple-management-website/app/api/paypal/route.ts` (588 lines)
- Backend: `saisamsthan-backend/src/controllers/paypal.js` (482 lines)

Frontend API routes call backend `/api/public/donations` - backend PayPal routes never used

### 11. Payment Data in Client Memory
All donation data stored in browser sessionStorage - vulnerable to XSS and browser clearing

### 12. Unreachable Code
**File:** `temple-management-website/components/DonationPageTemplate.tsx:229-247`
```js
window.location.href = approvalUrl;
return; // <- RETURN HERE
// Everything below is unreachable:
setSuccess(true);  // Never runs
```

---

## 📋 MINOR ISSUES

### 13. Console Logging in Production
Multiple `console.log` statements throughout - information leakage

### 14. Magic Numbers
- `100000` max amount (paypal.js:131)
- `30` rate limit (routes/paypal.js:14)

### 15. Inconsistent Error Responses
Some return `{ success, message }`, others `{ success, error }`

---

## Recommended Fix Priority

1. **Immediate:** Fix #1 (payment_method), #3 (swallowed error), #7 (donation types)
2. **Soon:** Fix #2 (sessionStorage), #5 (webhook ID), #9 (idempotency)
3. **Later:** Architecture refactor (#10, #11)
