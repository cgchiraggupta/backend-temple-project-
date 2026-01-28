# RBAC (Role-Based Access Control) Documentation

**Last Updated:** December 14, 2025

---

## 1. Roles Defined in the System

From [constants.js](file:///home/aaron/codeaaron/Prod/saisamsthan/saisamsthan-backend/src/config/constants.js):

| Role | Constant | Description |
|------|----------|-------------|
| `admin` | `ROLES.ADMIN` | Full system access - bypasses all role checks |
| `board` | `ROLES.BOARD` | Board member - administrative privileges |
| `chair_board` | `ROLES.CHAIR_BOARD` | Chair of the Board |
| `chairman` | `ROLES.CHAIRMAN` | Chairman of the Board |
| `finance_team` | `ROLES.FINANCE` | Finance team member |
| `community_owner` | `ROLES.COMMUNITY_OWNER` | Owner of a community |
| `community_lead` | `ROLES.COMMUNITY_LEAD` | Lead/manager of a community |
| `community_member` | `ROLES.COMMUNITY_MEMBER` | Regular community member |
| `volunteer_coordinator` | `ROLES.VOLUNTEER_COORDINATOR` | Coordinates volunteer activities |
| `priest` | `ROLES.PRIEST` | Temple priest |
| `volunteer` | `ROLES.VOLUNTEER` | Regular volunteer |
| `public` | `ROLES.PUBLIC` | Unauthenticated/public access |

> [!NOTE]
> Users can have **multiple roles** simultaneously. See [MULTI_ROLE_SYSTEM.md](./MULTI_ROLE_SYSTEM.md) for details.

---

## 2. Authentication Middleware

The backend uses three main authentication middleware patterns:

### 2.1 `requireAuth` (from [authMiddleware.js](file:///home/aaron/codeaaron/Prod/saisamsthan/saisamsthan-backend/src/middleware/authMiddleware.js))
- **Purpose:** Blocks requests without a valid JWT token
- **Behavior:** Attaches `req.user` with decoded token (id, email, role, roles[])
- **Response on failure:** 401 Unauthorized

### 2.2 `requireRole(allowedRoles[])` (from [authMiddleware.js](file:///home/aaron/codeaaron/Prod/saisamsthan/saisamsthan-backend/src/middleware/authMiddleware.js))
- **Purpose:** Multi-role aware access control
- **Behavior:** Checks if user has **ANY** of the allowed roles in `req.user.roles`
- **Response on failure:** 403 Forbidden

### 2.3 `checkRole(allowedRoles[])` (from [roleAuth.js](file:///home/aaron/codeaaron/Prod/saisamsthan/saisamsthan-backend/src/middleware/roleAuth.js))
- **Purpose:** Legacy role check middleware
- **Special behavior:** `admin` role bypasses all role checks
- **Response on failure:** 403 Forbidden

### 2.4 `allowRoles(allowed[])` (from [rbacMiddleware.js](file:///home/aaron/codeaaron/Prod/saisamsthan/saisamsthan-backend/src/middleware/rbacMiddleware.js))
- **Purpose:** Multi-role check with admin bypass
- **Behavior:** Uses `req.user.roles` array for checking

---

## 3. Endpoint Access Matrix

### 🔓 PUBLIC ENDPOINTS (No Authentication Required)

These endpoints are accessible by anyone without a JWT token:

| Route | Method | Description |
|-------|--------|-------------|
| `/health` | GET | Health check |
| `/api/users/register` | POST | User registration |
| `/api/users/login` | POST | User login |
| `/api/public/events` | GET | Public events listing |
| `/api/public/communities` | GET | Public communities listing |
| `/api/public/communities/:communityId/apply` | POST | Submit community application |
| `/api/public/volunteers/apply` | POST | Submit volunteer application |
| `/api/cms/public/*` | GET | Public CMS content (banners, pujas) |
| `/api/cms/contact` | POST | Contact form submission |
| `/api/priests` | GET | List all priests |
| `/api/priest-bookings` | POST | Submit booking request |
| `/api/priest-bookings/busy-priests/:date` | GET | Check priest availability |

---

### 🔐 PROTECTED ENDPOINTS (Authentication Required)

All endpoints below require a valid JWT token (`requireAuth` middleware).

---

#### **Admin Routes** (`/api/admin/*`)

| Route | Method | Role(s) Required | Description |
|-------|--------|------------------|-------------|
| `/api/admin/create-user` | POST | `admin` | Create new user with password email |
| `/api/admin/assign-role` | POST | `admin` | Assign role to a user |
| `/api/admin/users` | GET | `admin` | List all users |
| `/api/admin/resend-credentials` | POST | `admin` | Resend login credentials |
| `/api/admin/debug/db-status` | GET | `admin` | Debug database connectivity |

---

#### **User Routes** (`/api/users/*`)

| Route | Method | Role(s) Required | Description |
|-------|--------|------------------|-------------|
| `/api/users/me` | GET | Any authenticated | Get current user profile |
| `/api/users/` | GET | Any authenticated | List users |
| `/api/users/:id` | GET | Any authenticated | Get user by ID |
| `/api/users/:id` | PUT | Any authenticated | Update user |
| `/api/users/:id` | DELETE | Any authenticated | Delete user |
| `/api/users/change-password` | POST | Any authenticated | Change password |

---

#### **Community Routes** (`/api/communities/*`)

| Route | Method | Role(s) Required | Description |
|-------|--------|------------------|-------------|
| `/api/communities` | GET | Any authenticated | List communities |
| `/api/communities` | POST | Any authenticated | Create community |
| `/api/communities/:id` | GET | Any authenticated | Get community |
| `/api/communities/:id` | PUT | Any authenticated | Update community |
| `/api/communities/:id` | DELETE | Any authenticated | Delete community |
| `/api/communities/:id/members` | GET | Any authenticated | List members |
| `/api/communities/:id/members` | POST | Any authenticated | Add member |
| `/api/communities/:id/members/:memberId` | PUT | Any authenticated | Update member |
| `/api/communities/:id/members/:memberId` | DELETE | Any authenticated | Remove member |
| `/api/communities/:id/applications` | GET | Any authenticated | View applications |
| `/api/communities/:id/applications/:id/approve` | PUT | Any authenticated | Approve application |
| `/api/communities/:id/applications/:id/reject` | PUT | Any authenticated | Reject application |
| `/api/communities/:id/tasks` | GET/POST/PUT/DELETE | Any authenticated | Task management |

---

#### **Volunteer Routes** (`/api/volunteers/*`)

| Route | Method | Role(s) Required | Description |
|-------|--------|------------------|-------------|
| `/api/volunteers` | GET | Any authenticated | List all volunteers |
| `/api/volunteers` | POST | Any authenticated | Create volunteer |
| `/api/volunteers/:id` | PUT | Any authenticated | Update volunteer |
| `/api/volunteers/:id` | DELETE | Any authenticated | Delete volunteer |
| `/api/volunteers/shifts` | GET/POST/PUT/DELETE | Any authenticated | Shift management |
| `/api/volunteers/attendance` | GET/POST/PUT | Any authenticated | Attendance management |
| `/api/volunteers/applications` | GET | Any authenticated | List applications |
| `/api/volunteers/applications/:id/approve` | PUT | Any authenticated | Approve application |
| `/api/volunteers/applications/:id/reject` | PUT | Any authenticated | Reject application |

---

#### **Finance Routes** (`/api/finance/*`, `/api/donations/*`, `/api/expenses/*`)

| Route | Method | Role(s) Required | Description |
|-------|--------|------------------|-------------|
| `/api/finance/*` | ALL | `admin`, `board`, `chair_board`, `chairman`, `finance_team` | Finance operations |
| `/api/donations/*` | ALL | `admin`, `board`, `chair_board`, `chairman`, `finance_team` | Donation management |
| `/api/expenses/*` | ALL | `admin`, `board`, `chair_board`, `chairman`, `finance_team` | Expense management |
| `/api/budget-requests` | GET, POST | `admin`, `board`, `chair_board`, `chairman`, `finance_team`, `community_lead`, `community_owner` | Submit/View requests |
| `/api/budget-requests/:id/approve` | PUT | `admin`, `board`, `chair_board`, `chairman`, `finance_team` | Approve requests |
| `/api/budgets/*` | ALL | `admin`, `board`, `chair_board`, `chairman`, `finance_team` | Budget management |

---

#### **Priest Routes** (`/api/priests/*`, `/api/priest-bookings/*`)

| Route | Method | Role(s) Required | Description |
|-------|--------|------------------|-------------|
| `/api/priests` | GET | Public | List priests |
| `/api/priests/:id` | GET | Public | Get priest details |
| `/api/priests` | POST | Any authenticated | Create priest |
| `/api/priests/:id` | PUT/DELETE | Any authenticated | Update/Delete priest |
| `/api/priest-bookings` | GET | Any authenticated | List bookings |
| `/api/priest-bookings/:id` | PUT/DELETE | Any authenticated | Update/Delete booking |

---

#### **Reports Routes** (`/api/reports/*`)

| Route | Method | Role(s) Required | Description |
|-------|--------|------------------|-------------|
| `/api/reports/*` | ALL | `admin`, `board`, `chair_board`, `chairman` | Reports and analytics |
| `/api/reports/communities/:id/reports` | GET | `admin`, `board` | Community analytics |
| `/api/reports/communities/:id/calendar` | GET | `admin`, `board` | Calendar data |

---

#### **CMS Routes** (`/api/cms/*`)

| Route | Method | Role(s) Required | Description |
|-------|--------|------------------|-------------|
| `/api/cms/public/*` | GET | Public | Public CMS content |
| `/api/cms/*` | POST/PUT/DELETE | Any authenticated | CMS management |
| `/api/cms/gallery/*` | ALL | Any authenticated | Gallery management |
| `/api/brochures/*` | ALL | Any authenticated | Brochure management |

---

#### **Mobile App Routes** (`/api/mobile/*`)

| Route | Method | Role(s) Required | Description |
|-------|--------|------------------|-------------|
| `/api/mobile/me/communities` | GET | Any authenticated | User's communities |
| `/api/mobile/me/tasks` | GET | Any authenticated | User's assigned tasks |
| `/api/mobile/me/shifts` | GET | Any authenticated | User's volunteer shifts |
| `/api/mobile/me/events` | GET | Any authenticated | User's community events |
| `/api/mobile/me/applications` | GET | Any authenticated | User's applications |

---

## 4. Permission Constants

From [constants.js](file:///home/aaron/codeaaron/Prod/saisamsthan/saisamsthan-backend/src/config/constants.js):

```javascript
const PERMISSIONS = {
  CAN_CREATE_COMMUNITY: [
    'admin', 'board', 'chair_board', 'chairman', 'community_owner'
  ],
  CAN_MANAGE_COMMUNITY: [
    'admin', 'board', 'chair_board', 'chairman', 'community_owner', 'community_lead'
  ],
  CAN_VIEW_FINANCE: [
    'admin', 'board', 'chair_board', 'chairman', 'finance_team'
  ],
};
```

---

## 5. Multi-Role Support

### How Multi-Role Access Works

When checking access, the middleware looks at `req.user.roles` (an array):

```javascript
// From authMiddleware.js
const hasAccess = req.user.roles.some(r => allowedRoles.includes(r));
```

This means a user with roles `['priest', 'finance_team']` can access:
- ✅ Priest routes (has `priest`)
- ✅ Finance routes (has `finance_team`)
- ✅ Website tab (has `priest`)

### Admin Bypass

Admin role automatically bypasses all role checks:

```javascript
// From rbacMiddleware.js
if (req.user.roles.includes(ROLES.ADMIN)) return next();
```

---

## 6. Frontend Role Visibility

From the frontend App.tsx, sidebar visibility is controlled by:

| Menu Item | Allowed Roles |
|-----------|---------------|
| Dashboard | All authenticated |
| Events | All authenticated |
| Pujas | All authenticated |
| Community | All authenticated |
| Volunteer | `admin`, `board`, `chair_board`, `chairman`, `volunteer_head` |
| Finance | `admin`, `board`, `chair_board`, `chairman`, `finance_team` |
| Website | `admin`, `board`, `chair_board`, `chairman`, `priest` |
| Reports | `admin`, `board`, `chair_board`, `chairman` |
| Settings | All authenticated |

---

## 7. Related Documentation

- [MULTI_ROLE_SYSTEM.md](./MULTI_ROLE_SYSTEM.md) - Detailed multi-role architecture
- [ROLE_SYSTEM.md](./ROLE_SYSTEM.md) - Mobile app integration
- [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) - Test account setup
- [API_ENDPOINTS.md](./API_ENDPOINTS.md) - Complete API reference