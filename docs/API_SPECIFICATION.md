# Temple Management System - Complete API Specification

## Table of Contents
1. [Webhook Handlers](#webhook-handlers)
2. [Communication APIs](#communication-apis)
3. [Event Management APIs](#event-management-apis)
4. [Financial APIs](#financial-apis)
5. [User Management APIs](#user-management-apis)
6. [System APIs](#system-apis)
7. [Database Direct Access](#database-direct-access)
8. [Frontend Integration Notes](#frontend-integration-notes)

---

## Webhook Handlers

### 1. Stripe Webhook Handler
**Endpoint**: `POST /functions/v1/stripe-webhook`
**Purpose**: Process Stripe payment webhooks (internal use only)

**Headers Required**:
```json
{
  "stripe-signature": "string"
}
```

**Request Body**: Raw Stripe webhook payload

**Response**:
```json
{
  "success": true,
  "message": "Webhook processed"
}
```

**Error Responses**:
```json
{
  "error": "No signature | Invalid signature | Internal server error",
  "status": 400 | 500
}
```

### 2. Razorpay Webhook Handler
**Endpoint**: `POST /functions/v1/razorpay-webhook`
**Purpose**: Process Razorpay payment webhooks (internal use only)

**Headers Required**:
```json
{
  "x-razorpay-signature": "string"
}
```

**Request Body**: Raw Razorpay webhook payload

**Response**: Same as Stripe webhook

---

## Communication APIs

### 3. Broadcast Messages
**Endpoint**: `POST /functions/v1/broadcast`
**Purpose**: Send bulk messages to user segments

**Request Body**:
```json
{
  "channel": "email" | "sms" | "push" | "whatsapp",
  "audience": "all" | "community_members" | "donors" | "volunteers" | "event_attendees",
  "subject": "string", // Required for email
  "body": "string", // Required
  "templateId": "uuid", // Optional
  "templateParams": { // Optional, used with templateId
    "eventId": "uuid",
    "eventName": "string",
    "userName": "string",
    "customField": "any"
  }
}
```

**Response**:
```json
{
  "success": true,
  "messages_queued": 150
}
```

**Error Response**:
```json
{
  "error": "Channel, audience, and body required | Event ID required for event attendees",
  "status": 400
}
```

### 4. Email Processor (Scheduled Function)
**Endpoint**: `GET /functions/v1/process-emails`
**Purpose**: Process pending emails (typically called by cron)

**Response**:
```json
{
  "success": true,
  "processed": 25
}
```

### 5. SMS Processor (Scheduled Function)
**Endpoint**: `GET /functions/v1/process-sms`
**Purpose**: Process pending SMS (typically called by cron)

**Response**:
```json
{
  "success": true,
  "processed": 15
}
```

---

## Event Management APIs

### 6. Expand Recurring Events
**Endpoint**: `POST /functions/v1/expand-recurring`
**Purpose**: Generate event instances from recurring patterns

**Request Body**:
```json
{
  "eventId": "uuid", // Required
  "fromDate": "2024-01-01", // Optional, defaults to today
  "toDate": "2024-12-31" // Optional, defaults to +1 year
}
```

**Response**:
```json
{
  "success": true,
  "instances_generated": 52
}
```

**Error Response**:
```json
{
  "error": "Event ID required | Event not found",
  "status": 400 | 404
}
```

### 7. Event Registration
**Endpoint**: `POST /functions/v1/event-registration`
**Purpose**: Handle event registrations, cancellations, check-ins

**Request Body**:
```json
{
  "eventId": "uuid", // Required
  "userId": "uuid", // Required
  "action": "register" | "cancel" | "check_in", // Required
  "registrationData": { // Optional, for register action
    "dietary_requirements": "string",
    "emergency_contact": "string",
    "special_needs": "string",
    "custom_fields": {}
  }
}
```

**Response for Register**:
```json
{
  "success": true,
  "registration": {
    "id": "uuid",
    "event_id": "uuid",
    "user_id": "uuid",
    "status": "confirmed",
    "registration_data": {},
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

**Response for Cancel/Check-in**:
```json
{
  "success": true
}
```

**Error Response**:
```json
{
  "error": "Event is full | Invalid action",
  "status": 400
}
```

---

## Financial APIs

### 8. Donation Analytics
**Endpoint**: `GET /functions/v1/donation-analytics`
**Purpose**: Generate donation reports and analytics

**Query Parameters**:
```
type: "summary" | "trends" | "sources" | "top_donors" (default: "summary")
start_date: "2024-01-01" (optional)
end_date: "2024-12-31" (optional)
community_id: "uuid" (optional)
```

**Response for Summary**:
```json
{
  "total_amount": 150000.50,
  "total_count": 1250,
  "average_amount": 120.00,
  "by_provider": {
    "stripe": 75000.25,
    "razorpay": 50000.00,
    "manual": 25000.25
  },
  "by_currency": {
    "INR": 145000.50,
    "USD": 5000.00
  }
}
```

**Response for Trends**:
```json
{
  "daily_totals": {
    "2024-01-01": 1500.00,
    "2024-01-02": 2300.50
  },
  "monthly_totals": {
    "2024-01": 45000.00,
    "2024-02": 38000.00
  }
}
```

**Response for Sources**:
```json
{
  "by_source": {
    "web_gateway": 100000.00,
    "hundi": 30000.00,
    "in_temple": 15000.00,
    "bank_transfer": 5000.50
  }
}
```

**Response for Top Donors**:
```json
{
  "top_donors": [
    {
      "email": "donor@example.com",
      "name": "John Doe",
      "total": 5000.00,
      "count": 12
    }
  ]
}
```

### 9. Financial Reports
**Endpoint**: `GET /functions/v1/financial-reports`
**Purpose**: Generate comprehensive financial reports

**Query Parameters**:
```
type: "income_statement" | "cash_flow" | "donor_report" (required)
start_date: "2024-01-01" (required)
end_date: "2024-12-31" (required)
format: "json" | "csv" (default: "json")
```

**Response for Income Statement**:
```json
{
  "period": {
    "start_date": "2024-01-01",
    "end_date": "2024-12-31"
  },
  "income": {
    "gross_donations": 150000.00,
    "payment_fees": 4500.00,
    "net_donations": 145500.00
  },
  "expenses": {
    "total": 85000.00,
    "by_category": {
      "maintenance": 25000.00,
      "utilities": 15000.00,
      "salaries": 30000.00,
      "materials": 10000.00,
      "events": 5000.00
    }
  },
  "net_income": 60500.00
}
```

**Response for Cash Flow**:
```json
{
  "period": {
    "start_date": "2024-01-01",
    "end_date": "2024-12-31"
  },
  "monthly_flow": {
    "2024-01": {
      "inflow": 45000.00,
      "outflow": 28000.00
    },
    "2024-02": {
      "inflow": 38000.00,
      "outflow": 22000.00
    }
  }
}
```

**Response for Donor Report**:
```json
{
  "period": {
    "start_date": "2024-01-01",
    "end_date": "2024-12-31"
  },
  "donors": [
    {
      "name": "John Doe",
      "email": "john@example.com",
      "total_amount": 5000.00,
      "donation_count": 12,
      "first_donation": "2024-01-15T10:30:00Z",
      "last_donation": "2024-11-20T14:20:00Z"
    }
  ],
  "summary": {
    "total_donors": 245,
    "total_amount": 150000.00
  }
}
```

---

## User Management APIs

### 10. User Management
**Endpoint**: `POST /functions/v1/user-management`
**Purpose**: Handle user administration tasks

**Query Parameters**:
```
action: "bulk_invite" | "deactivate_user" | "reset_password" (required)
```

**Request Body for Bulk Invite**:
```json
{
  "emails": ["user1@example.com", "user2@example.com"],
  "role": "member" // Optional, defaults to "member"
}
```

**Response for Bulk Invite**:
```json
{
  "success": true,
  "invitations": [
    {
      "id": "uuid",
      "email": "user1@example.com",
      "role": "member",
      "status": "pending",
      "expires_at": "2024-01-22T10:30:00Z"
    }
  ]
}
```

**Request Body for Deactivate User**:
```json
{
  "userId": "uuid"
}
```

**Request Body for Reset Password**:
```json
{
  "email": "user@example.com"
}
```

**Standard Response**:
```json
{
  "success": true,
  "message": "Password reset email sent" // For reset_password
}
```

### 11. Notification Preferences
**Endpoint**: `POST /functions/v1/notification-preferences`
**Purpose**: Update user notification settings

**Request Body**:
```json
{
  "userId": "uuid", // Required
  "preferences": {
    "email_notifications": true,
    "sms_notifications": false,
    "push_notifications": true,
    "whatsapp_notifications": true,
    "event_reminders": true,
    "donation_receipts": true,
    "announcement_notifications": true
  }
}
```

**Response**:
```json
{
  "success": true
}
```

---

## System APIs

### 12. Inventory Management
**Endpoint**: `GET /functions/v1/inventory`
**Purpose**: Manage temple inventory

**Query Parameters**:
```
action: "low_stock_alert" | "update_stock" (required)
```

**Request Body for Update Stock** (POST method when action=update_stock):
```json
{
  "itemId": "uuid",
  "quantity": 50,
  "type": "add" | "subtract" | "set",
  "reason": "Purchase | Usage | Correction | Donation"
}
```

**Response for Low Stock Alert**:
```json
{
  "success": true,
  "low_stock_items": 5
}
```

**Response for Update Stock**:
```json
{
  "success": true,
  "new_quantity": 75
}
```

### 13. Backup Data
**Endpoint**: `POST /functions/v1/backup-data`
**Purpose**: Create database backups

**Request Body**:
```json
{
  "tables": ["users", "donations", "events", "communities"],
  "format": "json" // Optional, defaults to "json"
}
```

**Response**:
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "tables": {
    "users": [
      {
        "id": "uuid",
        "email": "user@example.com",
        "full_name": "John Doe",
        "created_at": "2024-01-01T00:00:00Z"
      }
    ],
    "donations": [
      {
        "id": "uuid",
        "amount": 1000.00,
        "currency": "INR",
        "status": "completed",
        "donor_email": "donor@example.com"
      }
    ]
  }
}
```

---

## Database Direct Access

### Supabase Client Operations

**Authentication Required Headers**:
```json
{
  "Authorization": "Bearer <supabase_anon_key>",
  "apikey": "<supabase_anon_key>",
  "Content-Type": "application/json"
}
```

### Key Tables and Their Structure

#### Users Table
```typescript
interface User {
  id: string; // UUID, references auth.users
  email: string;
  full_name: string;
  phone?: string;
  avatar_url?: string;
  status: 'active' | 'inactive' | 'pending' | 'suspended';
  metadata: Record<string, any>;
  preferences: {
    notifications: {
      push: boolean;
      whatsapp: boolean;
      email: boolean;
    };
  };
  created_at: string;
  updated_at: string;
  last_login_at?: string;
  deleted_at?: string;
}
```

#### Communities Table
```typescript
interface Community {
  id: string;
  name: string;
  slug: string;
  description?: string;
  owner_id: string;
  logo_url?: string;
  cover_image_url?: string;
  status: 'active' | 'inactive' | 'archived';
  settings: {
    public_visible: boolean;
    allow_join_requests: boolean;
  };
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}
```

#### Events Table
```typescript
interface Event {
  id: string;
  community_id?: string;
  title: string;
  description?: string;
  location?: string;
  location_coords?: [number, number]; // [lat, lng]
  starts_at: string;
  ends_at: string;
  
  // Recurrence fields
  recurring_pattern: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  recurring_frequency: number;
  recurring_days_of_week?: number[]; // 0=Sunday, 6=Saturday
  recurring_day_of_month?: number; // 1-31
  recurring_week_of_month?: number; // 1-5 (5=last)
  recurring_end_date?: string;
  recurring_count?: number;
  timezone: string;
  
  visibility: 'public' | 'community' | 'private';
  status: 'draft' | 'published' | 'cancelled' | 'completed';
  capacity?: number;
  registration_required: boolean;
  registration_deadline?: string;
  
  created_by: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
  published_at?: string;
  cancelled_at?: string;
  metadata: Record<string, any>;
}
```

#### Donations Table
```typescript
interface Donation {
  id: string;
  source: 'web_gateway' | 'hundi' | 'in_temple' | 'bank_transfer' | 'other';
  provider?: 'stripe' | 'razorpay' | 'manual' | 'bank';
  
  // Provider references
  provider_payment_id?: string;
  provider_customer_id?: string;
  provider_session_id?: string;
  provider_charge_id?: string;
  
  // Amounts
  amount: number;
  currency: string;
  provider_fee_amount: number;
  net_amount: number; // Calculated field
  
  // References
  community_id?: string;
  event_id?: string;
  puja_id?: string;
  
  // Donor info
  donor_name?: string;
  donor_email?: string;
  donor_phone?: string;
  donor_pan?: string;
  donor_address?: Record<string, any>;
  
  // Status and metadata
  status: 'pending' | 'completed' | 'failed' | 'refunded' | 'cancelled';
  receipt_number?: string;
  received_at: string;
  metadata: Record<string, any>;
  reconciled: boolean;
  reconciled_at?: string;
  reconciled_by?: string;
  
  created_at: string;
  updated_at: string;
}
```

#### Messages Table
```typescript
interface Message {
  id: string;
  channel: 'push' | 'whatsapp' | 'email' | 'sms';
  recipient_id?: string;
  recipient_phone?: string;
  recipient_email?: string;
  subject?: string;
  body: string;
  template_id?: string;
  template_params?: Record<string, any>;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'cancelled';
  priority: number;
  scheduled_at?: string;
  sent_at?: string;
  delivered_at?: string;
  failed_at?: string;
  error_message?: string;
  provider_message_id?: string;
  metadata: Record<string, any>;
  created_by?: string;
  created_at: string;
}
```

---

## Frontend Integration Notes

### 1. Environment Variables Needed
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key # Server-side only
```

### 2. Supabase Client Setup
```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)
```

### 3. Authentication Flow
```typescript
// Sign up
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password',
  options: {
    data: {
      full_name: 'John Doe',
      phone: '+1234567890'
    }
  }
})

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password'
})

// Get current user
const { data: { user } } = await supabase.auth.getUser()
```

### 4. Real-time Subscriptions
```typescript
// Subscribe to donations
const subscription = supabase
  .channel('donations')
  .on('postgres_changes', 
    { event: 'INSERT', schema: 'public', table: 'donations' },
    (payload) => {
      console.log('New donation:', payload.new)
    }
  )
  .subscribe()

// Subscribe to messages
const messageSubscription = supabase
  .channel('messages')
  .on('postgres_changes',
    { 
      event: 'INSERT', 
      schema: 'public', 
      table: 'messages',
      filter: `recipient_id=eq.${user.id}`
    },
    (payload) => {
      console.log('New message:', payload.new)
    }
  )
  .subscribe()
```

### 5. File Upload (for images, documents)
```typescript
// Upload file
const { data, error } = await supabase.storage
  .from('uploads')
  .upload(`avatars/${user.id}`, file)

// Get public URL
const { data: { publicUrl } } = supabase.storage
  .from('uploads')
  .getPublicUrl(`avatars/${user.id}`)
```

### 6. Row Level Security (RLS) Considerations
- Users can only see their own data by default
- Community members can see community-specific data
- Public events are visible to everyone
- Financial data requires specific roles
- Always check user permissions in UI

### 7. Error Handling Patterns
```typescript
interface ApiResponse<T> {
  data?: T;
  error?: {
    message: string;
    status?: number;
  };
}
```

---

## 14. Mobile Context APIs

These APIs are designed to aggregate data for mobile views to reduce round-trips.

### 1. User Home Data
**Endpoint**: `GET /api/mobile/me/tasks`
**Purpose**: Fetches "My Tasks" with strict JSONB filtering on assignments.
**Logic**: Filters `community_tasks` where `assigned_to` array contains current `user_id`.

### 2. Unified Applications
**Endpoint**: `GET /api/mobile/me/applications`
**Purpose**: Single view for "My Applications" screen.
**Response**:
```json
{
  "community_applications": [...],
  "volunteer_applications": [...]
}
```

### 3. Public Apply Logic
**Endpoint**: `POST /api/public/communities/:id/apply`
**Endpoint**: `POST /api/public/volunteers/apply`
**Validation**:
- Checks for existing `pending` applications (Anti-spam).
- Checks for existing active membership/volunteership (Redundancy check).

---

## 15. Public Website Endpoints

These endpoints serve the public-facing temple website and require no authentication.

### Public Events
**Endpoint**: `GET /api/public/events`
**Query Parameters**:
- `status`: Event status filter (default: `published`)
- `limit`: Max results (default: `50`)
- `upcoming`: Filter future events only (default: `true`)
- `community_id`: Filter by community UUID

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Navratri Celebration",
      "description": "9-day festival",
      "location": "Temple Hall",
      "starts_at": "2024-10-03T18:00:00Z",
      "ends_at": "2024-10-03T21:00:00Z",
      "image_url": "https://...",
      "thumbnail_url": "https://...",
      "status": "published",
      "capacity": 200,
      "registration_required": true
    }
  ],
  "count": 10
}
```

### Public Priests
**Endpoint**: `GET /api/priests`
**Purpose**: List priests for booking page (no auth required)

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Pandit Sharma",
      "specialization": "Wedding Ceremonies, Graha Shanti",
      "experience_years": 15,
      "image_url": "https://...",
      "status": "active"
    }
  ]
}
```

### Public Priest Booking
**Endpoint**: `POST /api/priest-bookings`
**Purpose**: Submit booking request from website

**Request**:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "puja_type": "Satyanarayan Puja",
  "preferred_date": "2024-12-25",
  "preferred_time": "10:00 AM",
  "address": "123 Main St",
  "city": "Chicago",
  "state": "IL",
  "zip": "60601",
  "notes": "Special requests"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Booking request submitted successfully",
  "data": {
    "id": "uuid",
    "status": "pending"
  }
}
```

### CMS Public Content
**Endpoints**:
- `GET /api/cms/public/banners` - Active banners for homepage carousel
- `GET /api/cms/public/banner/:slot` - Specific banner (banner-1 to banner-4)
- `GET /api/cms/public/pujas` - Active pujas for services page
- `GET /api/cms/public/sai-aangan` - Mandir expansion project info
- `GET /api/cms/public/upcoming-events` - CMS upcoming events
- `GET /api/cms/public/mandir-hours` - Temple timing information
- `GET /api/cms/public/bal-vidya` - Children's education program
- `GET /api/cms/public/about-mandir` - About the temple

---

## 16. CMS Database Tables

### cms_images Table
```typescript
interface CmsImage {
  id: string;
  name: string; // 'banner-1', 'banner-2', 'gallery', etc.
  image_url: string;
  title?: string;
  description?: string;
  storage_path?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

### cms_pujas Table
```typescript
interface CmsPuja {
  id: string;
  name: string;
  slug: string;
  description?: string;
  short_description?: string;
  image_url?: string;
  price: number;
  price_display?: string;
  duration?: string;
  location?: string;
  priest_name?: string;
  category: string;
  benefits: string[];
  items_included: string[];
  booking_required: boolean;
  advance_booking_days: number;
  is_featured: boolean;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}
```

### cms_mandir_hours Table
```typescript
interface CmsMandirHours {
  id: string;
  section_type: 'hours' | 'aarti' | 'activities';
  title: string;
  description?: string;
  timings: Array<{
    day: string;      // 'Weekdays', 'Weekends', 'Monday', etc.
    hours: string;    // '8:30 AM - 9:00 PM'
    name?: string;    // For aarti/activities: 'Kakad Aarti'
  }>;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

### cms_sai_aangan Table
```typescript
interface CmsSaiAangan {
  id: string;
  title: string;
  description?: string;
  image_url?: string;
  timeline_updates: Array<{
    date: string;
    title: string;
    description: string;
  }>;
  donation_link?: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

### priests Table
```typescript
interface Priest {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  specialization?: string;
  experience_years?: number;
  qualification?: string;
  address?: string;
  date_of_birth?: string;
  joining_date?: string;
  image_url?: string;
  storage_path?: string;
  status: 'active' | 'inactive';
  notes?: string;
  created_at: string;
  updated_at: string;
}
```

### priest_bookings Table
```typescript
interface PriestBooking {
  id: string;
  name: string;
  email: string;
  phone: string;
  puja_type: string;
  preferred_date: string;
  preferred_time?: string;
  priest_id?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  notes?: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  admin_notes?: string;
  created_at: string;
  updated_at: string;
}
```

---

## Changelog (December 2024)

### New Features

**Public API Endpoints**
- Priests listing now publicly accessible at `GET /api/priests`
- Priest booking submission at `POST /api/priest-bookings`
- Priest availability check at `GET /api/priest-bookings/busy-priests/:date`
- Community application at `POST /api/public/communities/:id/apply`
- Volunteer application at `POST /api/public/volunteers/apply`

**CMS Enhancements**
- Banner slots system (banner-1 through banner-4) for homepage carousel
- About Mandir content management
- Sai Aangan (Mandir Expansion) project pages
- Enhanced Mandir Hours with flexible timings array
- Bal Vidya Mandir children's education program

**Public Events**
- Single event retrieval at `/public/events/:id`
- Upcoming events count at `/public/events/stats/upcoming`
- Automatic default image assignment for events without images
  };
}

// Standard error handling
try {
  const response = await fetch('/functions/v1/broadcast', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    },
    body: JSON.stringify(payload)
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Request failed')
  }
  
  const data = await response.json()
  return { data, error: null }
} catch (error) {
  return { data: null, error: { message: error.message } }
}
```

### 8. Pagination Patterns
```typescript
// For large datasets
const { data, error, count } = await supabase
  .from('donations')
  .select('*', { count: 'exact' })
  .range(0, 9) // First 10 items
  .order('created_at', { ascending: false })

// For infinite scroll
const { data, error } = await supabase
  .from('events')
  .select('*')
  .gt('starts_at', new Date().toISOString())
  .order('starts_at')
  .limit(20)
```

### 9. Common Query Patterns
```typescript
// Get user's communities
const { data: communities } = await supabase
  .from('communities')
  .select(`
    *,
    community_members!inner(
      role,
      status
    )
  `)
  .eq('community_members.user_id', user.id)
  .eq('community_members.status', 'active')

// Get upcoming events
const { data: events } = await supabase
  .from('events')
  .select(`
    *,
    communities(name, slug),
    event_registrations(status)
  `)
  .gte('starts_at', new Date().toISOString())
  .eq('status', 'published')
  .order('starts_at')

// Get donation summary
const { data: summary } = await supabase
  .rpc('get_community_financial_summary', {
    p_community_id: communityId,
    p_from_date: '2024-01-01',
    p_to_date: '2024-12-31'
  })
```

### 10. TypeScript Types
Create a `types/database.ts` file with all the interfaces shown above for type safety throughout your application. 