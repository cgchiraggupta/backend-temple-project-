# Backend Technical Reference & API Guide

**Version:** 2.0 (Deep Dive)
**Last Updated:** December 12, 2025
**Scope:** Comprehensive guide to all active endpoints, authentication mechanisms, database logic, and recent revisions.

---

## 1. Authentication & Security

The backend uses a **Hybrid Authentication Model**:
1.  **Public Routes:** No authentication required. Open to any client (website, mobile app apply screens).
    *   *Middleware:* None (or custom logic in `server.js`).
    *   *Rate Limiting:* Standard limits apply.
2.  **Protected Routes:** Require a valid JSON Web Token (JWT).
    *   *Header:* `Authorization: Bearer <your_jwt_token>`
    *   *Middleware:* `requireAuth` (verifies token via Supabase Auth).
    *   *User Context:* Valid tokens populates `req.user` with `{ id, email, role }`.

> **[!IMPORTANT]**
> All `/api/mobile/me/*` routes are PROTECTED and strictly require a user context. A `401 Unauthorized` will be returned if the header is missing or invalid.

---

## 2. API Endpoint Reference

### A. Mobile User Context (`/api/mobile/me/*`)
**Base URL:** `/api/mobile/me`
**Auth:** Required (Protects user specific data)

#### 1. Get My Communities
*   **GET** `/communities`
*   **Description:** Fetches all communities where the user has an `active` membership.
*   **Logic:** Queries `community_members` joined with `communities`. Filters out inactive/banned memberships.
*   **Response:**
    ```json
    {
      "success": true,
      "data": [
        {
          "id": "uuid",
          "name": "Sai Samsthan",
          "slug": "sai-samsthan",
          "logo_url": "https://...",
          "member_role": "admin", // 'admin', 'moderator', 'member'
          "joined_at": "2023-01-01T00:00:00Z"
        }
      ],
      "total": 1
    }
    ```

#### 2. Get My Tasks (Home Screen Data)
*   **GET** `/tasks`
*   **Params:**
    *   `status` (optional): `pending`, `in_progress`, `completed`
    *   `community_id` (optional): Filter by specific community.
    *   `limit` (default: 50)
*   **Critical Logic Revision:**
    The `assigned_to` column in `community_tasks` is a **JSONB** array (e.g., `["user_id_1"]`).
    *   *Old Logic (Broken):* Used Supabase `.contains()` which failed on some inputs.
    *   *New Logic (Fixed):* Uses strict filter: `.filter('assigned_to', 'cs', JSON.stringify([userId]))`. This ensures robust matching of the user ID within the JSON array.
    *   *Ordering:* Explicitly orders by `due_date` ascending to show urgent tasks first.
*   **Response:**
    ```json
    {
      "success": true,
      "data": [
        {
          "id": "uuid",
          "title": "Setup Main Hall",
          "description": "Arrange chairs...",
          "status": "pending",
          "due_date": "2025-12-15T09:00:00Z",
          "community_name": "Sai Samsthan",
          "community_id": "uuid"
        }
      ]
    }
    ```

#### 3. Get My Events (Consolidated)
*   **GET** `/events`
*   **Params:**
    *   `upcoming` (default: `true`): If true, returns only events with `start_date >= NOW()`.
*   **Logic:**
    1.  Gets list of `community_id`s from user's active memberships.
    2.  Queries `community_events` where `community_id` is in that list.
    3.  **Fallback Image:** If `image_url` is null, assigns a categorical default image (Puja, Festival, Meditation) based on title keywords.
*   **Response:**
    ```json
    {
      "success": true,
      "data": [
        {
          "id": "uuid",
          "title": "Morning Aarti",
          "starts_at": "2025-12-14T06:00:00Z",
          "event_type": "religious",
          "location": "Main Temple",
          "image_url": "https://..."
        }
      ]
    }
    ```

#### 4. Get My Applications
*   **GET** `/applications`
*   **Description:** Returns a unified view of all pending/past applications (Community Membership AND Volunteer).
*   **Logic:**
    *   Searches by **Both** `user_id` (if linked) AND `email`. This ensures applications made *before* the user created an account are still visible if the email matches.
*   **Response:**
    ```json
    {
      "success": true,
      "data": {
        "community_applications": [
          { "id": "...", "status": "pending", "community_name": "..." }
        ],
        "volunteer_applications": [
          { "id": "...", "status": "pending", "applied_at": "..." }
        ]
      }
    }
    ```

### B. Public Access (`/api/public/*`)
**Base URL:** `/api/public`
**Auth:** None

#### 1. Browse Communities
*   **GET** `/communities` or `/api/mobile/communities`
*   **Params:** `search` (name/description), `limit`
*   **Logic:** Returns all communities with `status = 'active'`. Used for the "Find Community" screen.

#### 2. Public Events
*   **GET** `/events`
*   **Params:** `community_id`, `limit`
*   **Logic:** Queries `events` table (distinct from `community_events` in some legacy schema, or filtered view). Returns only `visibility = 'public'` and `status = 'published'`.

#### 3. Apply to Community
*   **POST** `/communities/:communityId/apply`
*   **Body:**
    ```json
    {
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "why_join": "Devotion"
    }
    ```
*   **Validation Logic:**
    1.  **Duplicate App:** Checks `community_applications` for `status='pending'` + matching email. Returns `400` if found.
    2.  **Duplicate Member:** Checks `community_members` for matching email. Returns `400` if already a member.

#### 4. Apply as Volunteer
*   **POST** `/volunteers/apply`
*   **Body:**
    ```json
    {
      "first_name": "John",
      "last_name": "Doe",
      "email": "john@example.com",
      "phone": "...",
      "skills": ["Cooking", "Decorating"]
    }
    ```
*   **Logic:**
    *   Prevents duplicate pending applications.
    *   Prevents existing volunteers from re-applying (returns "Already a registered volunteer").

---

### C. Volunteer & Shift Management (`/api/mobile/*`)

#### 1. Volunteer Profile
*   **GET** `/me/volunteer-profile`
*   **Logic:**
    *   First tries to find volunteer record by `user_id`.
    *   **Fallback:** If not found, tries to find by `email` (Active Volunteer whose email matches the logged-in user). This is crucial for linking pre-existing volunteer records to new app users.

#### 2. Get Available Shifts
*   **GET** `/shifts/available`
*   **Logic:** Returns `volunteer_shifts` where `status = 'open'` AND `shift_date >= Today`.

#### 3. Shift Attendance
*   **GET** `/me/shifts`
*   **Logic:** Returns list of shifts the user has attended or is assigned to, sourced from `volunteer_attendance` table.

---

## 3. Operations & Data Logic

### Soft Deletion Strategy
To maintain data integrity and audit trails:
1.  **Volunteer Deletion:**
    *   When an admin deletes a volunteer via `DELETE /api/volunteers/:id`:
        *   **Action:** The *Active Volunteer* record is removed from the `volunteers` table.
        *   **Cascade:** The system automatically performs a **soft delete** on their `volunteer_applications`.
        *   **Result:** Application status is updated to `'deleted'`. It is NOT removed from the database, preserving the record that "this person applied once".

### Event Image Handling
1.  **Upload:** Uses `multer` (memory storage) -> `imageUploadService`.
2.  **Storage:** Images are stored in the `event-images` bucket.
3.  **Defaults:** Logic exists to assign images based on keywords if no custom image is provided:
    *   *Puja/Archana* -> Diya Image
    *   *Festival/Navaratri* -> Flower Image
    *   *Meditation/Yoga* -> Meditation Image
    *   *Fallback* -> Deterministic has based on Event ID (ensures same event always gets same default image).

### Database Schema "Gotchas"
1.  **`assigned_to` in `community_tasks`**:
    *   **Type:** `JSONB`
    *   **Structure:** `["uuid1", "uuid2"]` (Array of strings)
    *   **Querying:** MUST use JSON operators. Simple text matching will fail.
2.  **User vs Volunteer**:
    *   These are separate entities. A `User` (auth/login) connects to a `Volunteer` (profile/skills) via `user_id`.
    *   The system tries to auto-link them by Email if `user_id` is missing.

---

## 4. Current Limitations / Known Behaviors
*   **Notifications:** Currently, application approval emails are sent via SendGrid. Push notifications are not yet implemented.
*   **Offline Sync:** The API is real-time. No offline queue verification exists yet; mobile app must be online to submit forms.

---

## 5. Special Handling & Legacy Support

### Frontend-Compatible Routes
To support different versions of the frontend (Web vs Mobile), some logic is duplicated or wrapped:
1.  **Approvals:**
    *   Standard: `PUT /api/applications/:id/approve`
    *   Frontend Wrapper: `PUT /api/applications-frontend/communities/:id/applications/:id/approve`
    *   *Reason:* The web dashboard expects a slightly different URL structure than the mobile app originally designed. Both call the same underlying service.

### Reports & Analytics
*   **Aggregated Stats:** The `/api/reports` endpoints perform real-time aggregation.
*   **Performance:** These are heavy queries. They calculate "Applications Over Time" and "Variance vs Budget" on the fly.

