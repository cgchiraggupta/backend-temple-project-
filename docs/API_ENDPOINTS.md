# Temple Steward API Documentation

## Base URL

- **Production**: `https://temple-backend-production-7324.up.railway.app/api`
- **Development**: `http://localhost:5000/api`

## Authentication

All protected endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer <token>
```

---

## 1. Users & Authentication

### POST /users/register

Register a new user.

```json
{
	"email": "user@example.com",
	"password": "password123",
	"full_name": "John Doe",
	"phone": "+1234567890"
}
```

### POST /users/login

Login and get authentication token.

```json
{
	"email": "user@example.com",
	"password": "password123"
}
```

### GET /users/profile

Get current user profile. (Protected)

### PUT /users/profile

Update current user profile. (Protected)

---

## 2. Communities

### GET /communities

Get all communities with optional filters.

- Query params: `status`, `search`, `page`, `limit`

### GET /communities/:id

Get single community by ID.

### POST /communities

Create new community. (Protected)

### PUT /communities/:id

Update community. (Protected)

### DELETE /communities/:id

Delete community. (Protected)

### GET /communities/:id/members

Get community members.

### POST /communities/:id/members

Add member to community.

---

## 3. Events

### GET /events

Get all events with filters.

- Query params: `community_id`, `status`, `start_date`, `end_date`, `page`,
  `limit`

### GET /events/:id

Get single event.

### POST /events

Create event with optional image upload. (Protected)

- Supports multipart/form-data for image upload

### PUT /events/:id

Update event. (Protected)

### DELETE /events/:id

Delete event. (Protected)

### GET /public/events

Get public events (no auth required).

- Query params: `status`, `limit`, `upcoming`, `community_id`
- Returns events with default images if none provided

### GET /public/events/:id

Get single public event by ID.

### GET /public/events/stats/upcoming

Get count of upcoming public events.

---

## 4. Tasks

### GET /tasks

Get all tasks with filters.

- Query params: `status`, `priority`, `community_id`, `assigned_to`, `page`,
  `limit`

### POST /tasks

Create task. (Protected)

```json
{
	"community_id": "uuid",
	"title": "Task title",
	"description": "Description",
	"status": "todo",
	"priority": "medium",
	"due_date": "2024-12-31",
	"assigned_to": ["user_uuid"]
}
```

### PUT /tasks/:id

Update task. (Protected)

### DELETE /tasks/:id

Delete task. (Protected)

---

## 5. Priests (Public Access)

All priest endpoints are publicly accessible for reading.

### GET /priests

Get all priests with filters.

- Query params: `status`, `search`, `page`, `limit`

### GET /priests/:id

Get single priest.

### POST /priests

Create priest with image upload. (Protected)

- Supports multipart/form-data
- Fields: `name`, `email`, `phone`, `specialization`, `experience_years`,
  `qualification`, `address`, `date_of_birth`, `joining_date`, `status`,
  `notes`, `image` (file)

### PUT /priests/:id

Update priest. (Protected)

### DELETE /priests/:id

Delete priest. (Protected)

---

## 6. Priest Bookings

### POST /priest-bookings (Public)

Create new priest booking request from website. **No authentication required.**

```json
{
	"name": "John Doe",
	"email": "john@example.com",
	"phone": "+1234567890",
	"puja_type": "Wedding Ceremony",
	"preferred_date": "2024-12-25",
	"preferred_time": "10:00 AM",
	"priest_id": "optional_priest_uuid",
	"address": "123 Main St",
	"city": "Chicago",
	"state": "IL",
	"zip": "60601",
	"notes": "Additional notes"
}
```

### GET /priest-bookings

Get all priest bookings. (Protected)

- Query params: `status`, `start_date`, `end_date`, `page`, `limit`

### GET /priest-bookings/:id

Get single booking. (Protected)

### PUT /priest-bookings/:id

Update booking (assign priest, change status). (Protected)

```json
{
	"status": "confirmed",
	"priest_id": "priest_uuid",
	"admin_notes": "Notes here"
}
```

**Confirmation Email Feature:**
- When `status` is changed to `"confirmed"`, an automatic confirmation email is sent to the booker
- Email includes: priest name, service type, formatted date, time, and a styled HTML template

**Response Note:**
- All booking responses include a `service_type` field (alias for `puja_type`) for frontend compatibility

### DELETE /priest-bookings/:id

Delete booking. (Protected)

### GET /priest-bookings/stats/summary

Get booking statistics. (Protected)

### GET /priest-bookings/busy-priests/:date

Get priests who are busy on a specific date. (Public)

- Query params: `time`, `exclude_booking_id`

### GET /priest-bookings/priest/:priestId/bookings

Get bookings for a specific priest by date range. (Public)

- Query params: `start_date`, `end_date`

---

## 7. Pujas

### GET /pujas

Get all puja series.

- Query params: `status`, `type`, `page`, `limit`

### POST /pujas

Create puja series. (Protected)

```json
{
	"name": "Puja Name",
	"description": "Description",
	"type": "regular",
	"start_date": "2024-01-01",
	"end_date": "2024-12-31",
	"priest": "Priest Name",
	"location": "Temple Hall",
	"duration_minutes": 60
}
```

### PUT /pujas/:id

Update puja series. (Protected)

### DELETE /pujas/:id

Delete puja series. (Protected)

---

## 8. Volunteers

### GET /volunteers

Get all volunteers with calculated hours.

- Query params: `community_id`, `status`, `page`, `limit`
- Returns `total_hours_volunteered` for each volunteer (calculated from attendance records)

### POST /volunteers

Create volunteer with automatic user account creation. (Protected)

- Automatically creates a user account with a random password
- Links volunteer record to user via `user_id`
- Sends welcome email with login credentials
- Response includes: `user_created`, `email_sent`

### PUT /volunteers/:id

Update volunteer. (Protected)

### DELETE /volunteers/:id

Delete volunteer and mark applications as deleted. (Protected)

### Volunteer Shifts

- `GET /volunteers/shifts` - Get all shifts with filters (`community_id`, `status`, `date`, `page`, `limit`)
- `POST /volunteers/shifts` - Create shift (requires: `title`, `shift_date`, `start_time`, `end_time`)
- `PUT /volunteers/shifts/:id` - Update shift
- `DELETE /volunteers/shifts/:id` - Delete shift

### Volunteer Attendance

- `GET /volunteers/attendance` - Get attendance records with filters (`volunteer_id`, `shift_id`, `date`)
  - Filters by `shift_date` when date is provided (more reliable than `attendance_date`)
- `POST /volunteers/attendance` - Create attendance record manually
  - Derives `attendance_date` from the associated shift's `shift_date`
- `PUT /volunteers/attendance/:id` - Update attendance record

### Check-in / Check-out

- `POST /volunteers/attendance/checkin` - Check in a volunteer
  - Creates attendance with `status: 'present'`
  - Records `check_in_time` and `attendance_date`
- `PUT /volunteers/attendance/:id/checkout` - Check out a volunteer
  - Calculates and stores `hours_worked` (rounded to 2 decimals)
  - Updates `status` to `'completed'`
  - Returns `hours_worked` in response

### Volunteer Applications

- `GET /volunteers/applications` - Get all applications with filters (`community_id`, `status`)
- `POST /volunteers/applications` - Submit volunteer application
- `PUT /volunteers/applications/:id/approve` - Approve application
- `PUT /volunteers/applications/:id/reject` - Reject application

---

## 9. Finance

### GET /finance/summary

Get financial summary with separate income and expense totals.

- Returns:
  - `totalIncome`: Sum from transactions table (type='income')
  - `totalExpenses`: Sum from expenses table
  - `netAmount`: Income minus expenses
  - `transactionCount`: Combined count of transactions and expenses

### GET /finance/categories

Get budget categories.

### POST /finance/categories

Create budget category. (Protected)

### GET /finance/transactions

Get all transactions.

### POST /finance/transactions

Create transaction. (Protected)

```json
{
	"type": "income",
	"amount": 1000,
	"description": "Donation",
	"category_id": "uuid",
	"payment_method": "cash"
}
```

---

## 10. Donations

### GET /donations

Get all donations.

- Query params: `status`, `donation_type`, `start_date`, `end_date`, `page`,
  `limit`

### POST /donations

Create donation. (Protected)

```json
{
	"donor_name": "John Doe",
	"donor_email": "john@example.com",
	"donor_phone": "+1234567890",
	"amount": 500,
	"donation_type": "general",
	"payment_method": "cash",
	"purpose": "Temple maintenance"
}
```

### GET /donations/categories/all

Get donation categories.

---

## 11. Expenses

### GET /expenses

Get all expenses with category information.

- Query params: `status`, `category`, `start_date`, `end_date`, `page`, `limit`
- Returns expenses with related `budget_categories` data

### GET /expenses/:id

Get single expense with category and attachments.

### POST /expenses

Create expense. (Protected)

- Required: `description`, `amount` (must be > 0)

### PUT /expenses/:id

Update expense. (Protected)

### DELETE /expenses/:id

Delete expense. (Protected)

### Expense Reports

- `GET /expenses/reports/summary` - Get expense summary with totals, pending, and category breakdown
- `GET /expenses/reports/by-category` - Get expenses grouped by category
- `GET /expenses/reports/monthly` - Get monthly expense report

### Expense Attachments

- `POST /expenses/:id/upload` - Upload file attachments (Protected, multipart/form-data)
  - Field: `documents` (array, max 5 files)
  - Allowed types: JPEG, PNG, GIF, WebP, PDF, DOC, DOCX
  - Max file size: 10MB per file
- `GET /expenses/:id/attachments` - Get all attachments for an expense
- `POST /expenses/:id/attachments` - Add attachment metadata directly

---


## 12. CMS (Content Management)

### Banners

- `GET /cms/banner` - Get all banners
- `POST /cms/banner` - Create banner
- `POST /cms/banner/upload` - Upload banner image (multipart/form-data)
  - Fields: `image` (file), `title`, `description`, `slot` (banner-1, banner-2, banner-3, banner-4)
- `PUT /cms/banner/:id` - Update banner
- `DELETE /cms/banner/:id` - Delete banner
- `DELETE /cms/banner/image/:slot` - Delete banner by slot

### About

- `GET /cms/about` - Get about content
- `POST /cms/about` - Create about content
- `PUT /cms/about/:id` - Update about content
- `DELETE /cms/about/:id` - Delete about content

### About Mandir

- `GET /cms/about-mandir` - Get About Mandir content
- `POST /cms/about-mandir` - Create About Mandir content (Protected)
- `PUT /cms/about-mandir/:id` - Update About Mandir content (Protected)
- `DELETE /cms/about-mandir/:id` - Delete About Mandir content (Protected)

### Images

- `GET /cms/images/:name` - Get images by name (gallery, broadcast, banner)
- `POST /cms/images` - Create image
- `PUT /cms/images/:id` - Update image
- `DELETE /cms/images/:id` - Delete image

### Contact Forms

- `GET /cms/contact` - Get all contact submissions (Protected)
- `GET /cms/contact/:id` - Get single submission (Protected)
- `POST /cms/contact` - Submit contact form (Public)
- `PUT /cms/contact/:id` - Update submission (Protected)
- `DELETE /cms/contact/:id` - Delete submission (Protected)
- `PATCH /cms/contact/:id/read` - Mark as read (Protected)

### CMS Pujas

- `GET /cms/pujas` - Get all CMS pujas
- `GET /cms/pujas/:id` - Get single puja
- `POST /cms/pujas` - Create CMS puja with image upload (multipart/form-data)
  - Fields: `name`, `slug`, `description`, `short_description`, `image` (file), `price`, `price_display`, `duration`, `location`, `priest_name`, `category`, `benefits` (JSON array), `items_included` (JSON array), `booking_required`, `advance_booking_days`, `is_featured`, `is_active`, `display_order`
- `PUT /cms/pujas/:id` - Update CMS puja
- `DELETE /cms/pujas/:id` - Delete CMS puja

### Sai Aangan (Mandir Expansion)

- `GET /cms/sai-aangan` - Get Sai Aangan content
- `POST /cms/sai-aangan` - Create content with image upload (multipart/form-data)
  - Fields: `title`, `description`, `image` (file), `timeline_updates` (JSON array), `donation_link`, `display_order`, `is_active`
- `PUT /cms/sai-aangan/:id` - Update content
- `DELETE /cms/sai-aangan/:id` - Delete content

### Upcoming Events (CMS)

- `GET /cms/upcoming-events` - Get upcoming events
- `POST /cms/upcoming-events` - Create event
  - Fields: `event_name`, `event_date`, `day_of_week`, `time_details`, `description`, `details_link`, `display_order`, `is_active`
- `PUT /cms/upcoming-events/:id` - Update event
- `DELETE /cms/upcoming-events/:id` - Delete event

### Mandir Hours & Aarti Times

- `GET /cms/mandir-hours` - Get mandir hours
- `POST /cms/mandir-hours` - Create hours entry
  - Fields: `section_type`, `title`, `description`, `timings` (JSON array with objects containing `day`, `hours`, `name` for activities), `display_order`, `is_active`
- `PUT /cms/mandir-hours/:id` - Update hours
- `DELETE /cms/mandir-hours/:id` - Delete hours

### Bal Vidya Mandir

- `GET /cms/bal-vidya` - Get Bal Vidya content
- `POST /cms/bal-vidya` - Create content (Protected)
- `PUT /cms/bal-vidya/:id` - Update content (Protected)
- `DELETE /cms/bal-vidya/:id` - Delete content (Protected)
- `POST /cms/bal-vidya/upload-document` - Upload document for Bal Vidya (Protected, multipart/form-data)
  - Fields: `document` (file), `documentType` (`syllabus` or `parent_guidelines`)
  - Supported: PDF, Word, Excel, PowerPoint, images (JPEG, PNG, GIF, WebP, SVG), text files
  - Max file size: 10MB
  - Returns: `url`, `path`, `documentType`, `fileName`

---

## 13. Public Endpoints (No Auth Required)

These endpoints are designed for the public website and mobile apps.

### Website CMS Content

- `GET /cms/public/banners` - Get all active banners for carousel
- `GET /cms/public/banner/:slot` - Get specific banner (banner-1, banner-2, banner-3, banner-4)
- `GET /cms/public/gallery` - Get all active gallery images (no auth required)
- `GET /cms/public/pujas` - Get active pujas for website
- `GET /cms/public/sai-aangan` - Get Sai Aangan content
- `GET /cms/public/upcoming-events` - Get upcoming events (filters by date >= today)
- `GET /cms/public/mandir-hours` - Get active mandir hours
- `GET /cms/public/bal-vidya` - Get Bal Vidya Mandir content
- `GET /cms/public/about-mandir` - Get About Mandir content

### Public Events

- `GET /public/events` - Get public events from events table
- `GET /public/events/:id` - Get single public event
- `GET /public/events/stats/upcoming` - Get upcoming events count
- `GET /public/community-events` - Get public community events
  - Query params: `upcoming`, `limit`

### Public Communities

- `GET /public/communities` - Get all active communities for browsing
  - Query params: `search`, `limit`, `page`
- `POST /public/communities/:communityId/apply` - Submit community application
  - Body: `name`, `email`, `phone`, `why_join`, `additional_message`, `experience`

### Public Volunteer Applications

- `POST /public/volunteers/apply` - Submit volunteer application
  - Body: `first_name`, `last_name`, `email`, `phone`, `skills` (array), `interests` (array), `motivation`, `experience`

### Public Priest Endpoints

- `GET /priests` - Get all priests (no auth required for listing)
- `GET /priests/:id` - Get single priest
- `POST /priest-bookings` - Submit priest booking request
- `GET /priest-bookings/busy-priests/:date` - Get busy priests for a date
- `GET /priest-bookings/priest/:priestId/bookings` - Get priest's bookings

---

## 14. Gallery

### GET /cms/gallery

Get all gallery images.

### POST /cms/gallery/upload

Upload gallery image. (Protected, multipart/form-data)

### DELETE /cms/gallery/:id

Delete gallery image. (Protected)

---

## 15. Broadcasts

### GET /broadcasts

Get all broadcasts.

### POST /broadcasts

Create broadcast. (Protected)

### PUT /broadcasts/:id

Update broadcast. (Protected)

### DELETE /broadcasts/:id

Delete broadcast. (Protected)

### POST /broadcasts/:id/send

Send broadcast. (Protected)

---

## 16. Templates

### GET /templates

Get communication templates.

### POST /templates

Create template. (Protected)

### PUT /templates/:id

Update template. (Protected)

### DELETE /templates/:id

Delete template. (Protected)

---

## Error Responses

All errors follow this format:

```json
{
	"success": false,
	"message": "Error description",
	"error": "Detailed error message",
	"code": "ERROR_CODE"
}
```

Common HTTP Status Codes:

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

---

## Rate Limiting

- General endpoints: 500 requests per 15 minutes
- Auth endpoints: 20 requests per 15 minutes

---

## Health Check

### GET /health

Check API health status.

```json
{
	"status": "OK",
	"timestamp": "2024-12-11T10:00:00.000Z",
	"database": "Supabase"
}
```

---

## 17. Mobile App Endpoints (Protected)

These endpoints are specifically optimized for the mobile application context.
Base path: `/api/mobile`

### GET /mobile/me/communities

Get communities the current user is a member of.

### GET /mobile/me/tasks

Get tasks assigned to the current user (Home Screen data).

- Query params: `status`, `community_id`, `priority`, `limit`

### GET /mobile/me/events

Get events from all communities the user is a member of.

- Query params: `upcoming=true`

### GET /mobile/me/applications

Get all user applications (both community membership and volunteer).

### GET /mobile/me/volunteer-profile

Get the volunteer profile linked to the current user.

### GET /mobile/shifts/available

Get open shifts available for signup.

### GET /mobile/me/shifts

Get user's shift history and assignments.

---

## 18. Brochures & Event Materials

**Base Path:** `/api/brochures`

### GET /api/brochures

Filterable lists of brochures.

- Query: `community_id`, `status` (draft/published), `is_active`

### POST /api/brochures

Create a new brochure record.

### POST /api/brochures/upload-image

Upload brochure assets (images).

- Form-data: `image`

### POST /api/brochures/:id/publish

Publish a brochure to be visible.

---

## 19. Budget & Finance Management

**Base Path:** `/api/budgets` and `/api/budget-requests`

### GET /api/budgets/summary/all

Consolidated view of all budgets vs actual spending (calculated from expenses).

### POST /api/budgets/with-files

Create a budget category with attached documents.

- Body: `category`, `budgeted_amount`, `period`.

### GET /api/budget-requests

Finance team view of all incoming requests.

- Query: `status`, `community_id`

### POST /api/budget-requests/with-files

Submit a reimbursement or allocation request with proofs.

- Multipart: `documents` (array), `budget_amount`, `purpose`.

### PUT /api/budget-requests/:id/approve

Approve a request (Finance Admin).

---

## 20. Analytics & Reports

**Base Path:** `/api/reports`

### GET /api/reports/communities/:id/reports

Comprehensive community analytics.

- Returns: Member counts, Application stats (pending/approved), Event stats.
- Charts: Applications over time, Events by month.

### GET /api/reports/communities/:id/calendar

Calendar view data for community events.

- Query: `month`, `year`

---

## 21. Community Features (Frontend Compatible)

**Base Path:** `/api/community-features` and `/api/applications-frontend`

### PUT /api/community-features/:id/tasks/:taskId

Update task details.

### PUT /api/applications-frontend/communities/:id/applications/:appId/approve

Frontend-optimized endpoint for application approval.

### PUT /api/community-features/:id/applications/:appId/reject

Rejection logic with community member cleanup (removes user if they were accidentally added).

---

## 22. Admin & System Management

**Base Path:** `/api/admin`
**Auth:** Restricted to `admin` role.

### POST /api/admin/create-user

Create a user account manually (skips verification, sends welcome email with credentials).

- Body: `email`, `full_name`, `role`, `phone`.

### POST /api/admin/assign-role

Promote/Demote a user.

- Body: `email`, `role`.

### GET /api/admin/users

List all users with roles and status.

### POST /api/admin/resend-credentials

Reset password and email credentials to user.

---

## 23. Communication Logs & Direct Mail

**Base Path:** `/api/communications`

### GET /api/communications/emails

View logs of sent/scheduled emails.

- Query: `community_id`, `status`

### POST /api/communications/emails/send

Send a direct single-recipient email.

### POST /api/communications/emails/send-to-volunteers

Bulk email to volunteers based on filters.

---

## Changelog (December 14, 2024)

### New Features Added Today

#### Public Gallery Endpoint

- **NEW** `GET /api/cms/public/gallery` - Public endpoint for fetching gallery images (no auth required)
  - Returns images from `cms_images` table where `name='gallery'` and `is_active=true`
  - Response includes `id`, `image_url`, `title`, `description`, `category`, `date`

#### Bal Vidya Document Upload

- **NEW** `POST /api/cms/bal-vidya/upload-document` - Upload documents for Bal Vidya Mandir (Protected)
  - Multipart/form-data with `document` file and `documentType` field
  - `documentType` must be `syllabus` or `parent_guidelines`
  - Supports: PDF, Word, Excel, PowerPoint, images (JPEG, PNG, GIF, WebP, SVG), text files
  - Max file size: 10MB
  - Returns: `url`, `path`, `documentType`, `fileName`

#### Expense Attachments

- **NEW** `POST /api/expenses/:id/upload` - Upload file attachments to an expense (Protected, multipart/form-data)
  - Field: `documents` (array, max 5 files)
  - Allowed types: images (JPEG, PNG, GIF, WebP), PDF, DOC, DOCX
  - Max file size: 10MB per file
  - Files stored in Supabase Storage (`expense-documents` bucket)
- **NEW** `GET /api/expenses/:id/attachments` - Get all attachments for an expense
- **NEW** `POST /api/expenses/:id/attachments` - Add attachment metadata to expense

#### Volunteer Attendance Enhancements

- Attendance records now derive `attendance_date` from the associated `shift_date`
- **CHECK-IN**: `POST /api/volunteers/attendance/checkin` now properly sets `attendance_date`
- **CHECK-OUT**: `PUT /api/volunteers/attendance/:id/checkout` now calculates and stores `hours_worked`
  - Returns `hours_worked` in response (rounded to 2 decimal places)
- **GET /api/volunteers** now includes `total_hours_volunteered` for each volunteer, calculated from completed attendance records

#### Priest Booking Confirmation Emails

- When a priest booking status is changed to `confirmed`, an automatic confirmation email is sent to the booker
- Email includes: priest name, service type, date, time, and location
- Booking responses now include `service_type` alias (mapped from `puja_type`) for frontend compatibility

#### Financial Summary Enhancement

- `GET /api/finance/summary` now properly separates income and expenses:
  - `totalIncome`: Sum of all income transactions
  - `totalExpenses`: Sum of all expenses from the `expenses` table
  - `transactionCount`: Combined count of transactions and expenses
  - `netAmount`: Income minus expenses

### Role & Access Control Updates

- **New Roles Added**: `chair_board`, `chairman`
- **Role Renamed**: `finance` → `finance_team`
- **Budget Requests**: Now accessible by roles: `community_lead`, `community_owner`, `finance_team`, `admin`, `board`, `chair_board`, `chairman`
- **Budget Approval**: Restricted to: `finance_team`, `admin`, `board`, `chair_board`, `chairman`
- **Multi-Role Support**: Login response now includes a `roles` array for users with multiple roles

### Volunteer User Account Creation

- When a new volunteer is created via `POST /api/volunteers`:
  - A user account is automatically created with a random password
  - The volunteer record is linked to the user account via `user_id`
  - A welcome email with login credentials is sent to the volunteer
  - Response includes `user_created: true/false` and `email_sent: true/false`

### Previous Changes (Earlier December 2024)

#### Public Endpoints

- **Priests**: `GET /priests` and `GET /priests/:id` are now publicly accessible
- **Priest Bookings**: `POST /priest-bookings` allows public booking submissions
- **Community Events**: `GET /public/community-events` for fetching public community events
- **Community Applications**: `POST /public/communities/:communityId/apply` for public applications
- **Volunteer Applications**: `POST /public/volunteers/apply` for public volunteer applications

#### CMS Enhancements

- **Banner Slots**: Support for 4 banner slots (banner-1, banner-2, banner-3, banner-4)
- **About Mandir**: New endpoints for About Mandir content management
- **Sai Aangan**: New endpoints for Mandir Expansion project content
- **Mandir Hours**: Enhanced with timings array for flexible schedule management
- **Bal Vidya Mandir**: New endpoints for children's education program content

#### Public Events Improvements

- Added `/public/events/stats/upcoming` for event counts
- Single event retrieval via `/public/events/:id`
- Default image assignment for events without custom images
