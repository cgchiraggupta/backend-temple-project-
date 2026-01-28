# Volunteer Workflow - API Testing Commands

## Prerequisites
```bash
# Get an admin token first
ADMIN_TOKEN="YOUR_ADMIN_TOKEN"

# Base URL
BASE_URL="http://localhost:5000/api"
```

---

## 1. Public Volunteer Application (No Auth Required)

### Submit Volunteer Application
```bash
curl -X POST "$BASE_URL/public/volunteer-applications" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com",
    "phone": "9876543210",
    "skills": ["cooking", "event setup", "cleaning"],
    "areas_of_interest": ["kitchen", "events", "maintenance"],
    "motivation": "I want to serve the community",
    "previous_experience": "2 years volunteering at local temple",
    "availability": "weekends"
  }' | jq '.'
```

---

## 2. Admin: Manage Volunteer Applications

### List All Volunteer Applications
```bash
curl -s "$BASE_URL/volunteers/applications" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.'
```

### View Single Application
```bash
APPLICATION_ID="your-application-id"
curl -s "$BASE_URL/volunteers/applications/$APPLICATION_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.'
```

### Approve Application (Creates Volunteer + User Account)
```bash
curl -X PUT "$BASE_URL/volunteers/applications/$APPLICATION_ID/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" | jq '.'
```

### Reject Application
```bash
curl -X PUT "$BASE_URL/volunteers/applications/$APPLICATION_ID/reject" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"rejection_reason": "Incomplete information provided"}' | jq '.'
```

---

## 3. Admin: Manage Volunteers

### List All Volunteers
```bash
curl -s "$BASE_URL/volunteers" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.'
```

### Create Volunteer Directly (Admin)
```bash
curl -X POST "$BASE_URL/volunteers" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Jane",
    "last_name": "Smith",
    "email": "jane.smith@example.com",
    "phone": "9876543211",
    "skills": ["programming", "teaching"],
    "status": "active"
  }' | jq '.'
```

### Update Volunteer
```bash
VOLUNTEER_ID="your-volunteer-id"
curl -X PUT "$BASE_URL/volunteers/$VOLUNTEER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "skills": ["programming", "teaching", "event management"],
    "status": "active"
  }' | jq '.'
```

### Delete Volunteer
```bash
curl -X DELETE "$BASE_URL/volunteers/$VOLUNTEER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.'
```

---

## 4. Volunteer Profile (Mobile - Requires Volunteer Auth)

### Get My Volunteer Profile
```bash
VOLUNTEER_TOKEN="your-volunteer-jwt-token"
curl -s "$BASE_URL/mobile/me/volunteer-profile" \
  -H "Authorization: Bearer $VOLUNTEER_TOKEN" | jq '.'
```

**Response includes:**
- Profile info (name, email, skills)
- `total_hours` - Total volunteering hours
- `shifts_completed` - Count of completed shifts

---

## Notes

- When an application is approved, a user account is created with a temporary password
- The volunteer receives an email with login credentials
- Status values: `pending`, `approved`, `rejected`, `deleted`
- Volunteer status values: `active`, `inactive`, `suspended`
