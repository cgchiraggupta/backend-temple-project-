# API Testing - Quick Reference

## Authentication

### Login
```bash
curl -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123"}' | jq '.'
```

### Get Token from Response
```bash
TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "adminpass"}' | jq -r '.data.token')
```

---

## Quick Setup

```bash
# Set these before running any commands
export BASE_URL="http://localhost:5000/api"
export ADMIN_TOKEN="your-admin-jwt"
export MEMBER_TOKEN="your-member-jwt"
export VOLUNTEER_TOKEN="your-volunteer-jwt"
export COMMUNITY_ID="your-community-id"
```

---

## Available Documentation

| File | Description |
|------|-------------|
| [volunteer-workflow.md](./volunteer-workflow.md) | Volunteer applications & management |
| [community-member-workflow.md](./community-member-workflow.md) | Community membership flow |
| [shift-workflow.md](./shift-workflow.md) | Volunteer shift signup, check-in/out |
| [events-workflow.md](./events-workflow.md) | Event creation & viewing |

---

## Public Endpoints (No Auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/public/communities` | List all communities |
| POST | `/api/public/communities/:id/apply` | Submit membership application |
| POST | `/api/public/volunteers/apply` | Submit volunteer application |
| GET | `/api/public/events` | List public events |
| GET | `/api/public/events/:id` | Get single event |
| GET | `/api/public/community-events` | List community events |
| GET | `/api/priests` | List all priests |
| GET | `/api/priests/:id` | Get priest details |
| POST | `/api/priest-bookings` | Submit priest booking |
| GET | `/api/priest-bookings/busy-priests/:date` | Check priest availability |
| GET | `/api/cms/public/banners` | Homepage banners |
| GET | `/api/cms/public/pujas` | Puja services |
| GET | `/api/cms/public/mandir-hours` | Temple hours |
| GET | `/api/cms/public/upcoming-events` | Upcoming events |
| GET | `/api/cms/public/about-mandir` | About the temple |
| GET | `/api/cms/public/sai-aangan` | Mandir expansion info |
| GET | `/api/cms/public/bal-vidya` | Children's education |
| POST | `/api/cms/contact` | Submit contact form |

---

## Priests & Bookings

### Public (No Auth)
```bash
# List all priests
curl "$BASE_URL/priests" | jq '.'

# Get single priest
curl "$BASE_URL/priests/$PRIEST_ID" | jq '.'

# Submit booking request
curl -X POST "$BASE_URL/priest-bookings" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "puja_type": "Satyanarayan Puja",
    "preferred_date": "2024-12-25",
    "preferred_time": "10:00 AM",
    "address": "123 Main St",
    "city": "Chicago",
    "state": "IL"
  }' | jq '.'

# Check priest availability
curl "$BASE_URL/priest-bookings/busy-priests/2024-12-25" | jq '.'
```

### Admin (Auth Required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/priests` | Create priest (with image) |
| PUT | `/api/priests/:id` | Update priest |
| DELETE | `/api/priests/:id` | Delete priest |
| GET | `/api/priest-bookings` | List all bookings |
| PUT | `/api/priest-bookings/:id` | Update booking status |
| DELETE | `/api/priest-bookings/:id` | Delete booking |

---

## Mobile Endpoints (User Token Required)

### Profile & Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/mobile/me/profile` | Get user profile |
| GET | `/api/mobile/me/volunteer-profile` | Get volunteer stats |

### Communities
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/mobile/me/communities` | My communities |
| GET | `/api/mobile/communities/:id` | Community details |
| GET | `/api/mobile/communities/:id/events` | Community events |

### Tasks
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/mobile/me/tasks` | My assigned tasks |
| PUT | `/api/mobile/tasks/:id/status` | Update task status |

### Events
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/mobile/me/events` | Events from my communities |

### Shifts (Volunteers Only)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/mobile/me/shifts` | My signed-up shifts |
| GET | `/api/mobile/shifts/available` | Available shifts |
| POST | `/api/mobile/shifts/:id/signup` | Sign up for shift |
| POST | `/api/mobile/shifts/:id/checkin` | Check in |
| POST | `/api/mobile/shifts/:id/checkout` | Check out |
| DELETE | `/api/mobile/shifts/:id/cancel` | Cancel signup |

---

## Admin Endpoints (Admin Token Required)

### Volunteers
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/volunteers` | List volunteers |
| POST | `/api/volunteers` | Create volunteer |
| GET | `/api/volunteers/applications` | List applications |
| PUT | `/api/volunteers/applications/:id/approve` | Approve |
| PUT | `/api/volunteers/applications/:id/reject` | Reject |

### Shifts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/volunteers/shifts` | List shifts |
| POST | `/api/volunteers/shifts` | Create shift |
| PUT | `/api/volunteers/shifts/:id` | Update shift |
| DELETE | `/api/volunteers/shifts/:id` | Delete shift |

### Communities
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/communities` | List communities |
| POST | `/api/communities` | Create community |
| GET | `/api/communities/applications` | List applications |
| PUT | `/api/communities/applications/:id/approve` | Approve |
| PUT | `/api/communities/applications/:id/reject` | Reject |

### Events
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/communities/:id/events` | Create event |
| PUT | `/api/communities/:id/events/:eventId` | Update event |
| DELETE | `/api/communities/:id/events/:eventId` | Delete event |

### CMS Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/cms/banner/upload` | Upload banner image |
| PUT | `/api/cms/mandir-hours/:id` | Update temple hours |
| POST | `/api/cms/pujas` | Create puja service |
| PUT | `/api/cms/about-mandir/:id` | Update about content |

