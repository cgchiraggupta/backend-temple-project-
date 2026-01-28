# Events Workflow - API Testing Commands

## Prerequisites
```bash
ADMIN_TOKEN="YOUR_ADMIN_TOKEN"
MEMBER_TOKEN="YOUR_MEMBER_JWT_TOKEN"
BASE_URL="http://localhost:5000/api"
COMMUNITY_ID="your-community-id"
```

---

## 1. Admin: Create & Manage Events

### Create a New Event
```bash
curl -X POST "$BASE_URL/communities/$COMMUNITY_ID/events" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Diwali Celebration 2025",
    "description": "Join us for the grand Diwali celebration with puja, prasad, and cultural programs",
    "start_date": "2025-11-01T18:00:00Z",
    "end_date": "2025-11-01T22:00:00Z",
    "location": "Main Temple Hall",
    "event_type": "festival",
    "max_participants": 500,
    "status": "published"
  }' | jq '.'
```

### Event Types
- `meeting` - Regular meetings
- `festival` - Religious festivals
- `workshop` - Educational workshops
- `ceremony` - Religious ceremonies
- `volunteer_activity` - Volunteer events

### List All Events (Admin)
```bash
curl -s "$BASE_URL/communities/$COMMUNITY_ID/events" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.'
```

### Get Single Event
```bash
EVENT_ID="your-event-id"
curl -s "$BASE_URL/communities/$COMMUNITY_ID/events/$EVENT_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.'
```

### Update Event
```bash
curl -X PUT "$BASE_URL/communities/$COMMUNITY_ID/events/$EVENT_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "max_participants": 600,
    "description": "Updated event description"
  }' | jq '.'
```

### Delete Event
```bash
curl -X DELETE "$BASE_URL/communities/$COMMUNITY_ID/events/$EVENT_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.'
```

---

## 2. Mobile: Get Community Events

### Get All Events for a Community
```bash
curl -s "$BASE_URL/mobile/communities/$COMMUNITY_ID/events" \
  -H "Authorization: Bearer $MEMBER_TOKEN" | jq '.'
```

### Get Upcoming Events Only
```bash
curl -s "$BASE_URL/mobile/communities/$COMMUNITY_ID/events?upcoming=true" \
  -H "Authorization: Bearer $MEMBER_TOKEN" | jq '.'
```

### Get Past Events
```bash
curl -s "$BASE_URL/mobile/communities/$COMMUNITY_ID/events?upcoming=false" \
  -H "Authorization: Bearer $MEMBER_TOKEN" | jq '.'
```

### Filter by Month/Year
```bash
curl -s "$BASE_URL/mobile/communities/$COMMUNITY_ID/events?month=12&year=2025" \
  -H "Authorization: Bearer $MEMBER_TOKEN" | jq '.'
```

### Limit Results
```bash
curl -s "$BASE_URL/mobile/communities/$COMMUNITY_ID/events?limit=10" \
  -H "Authorization: Bearer $MEMBER_TOKEN" | jq '.'
```

---

## 3. Mobile: Get My Events (Across All Communities)

### Get All My Events
```bash
curl -s "$BASE_URL/mobile/me/events" \
  -H "Authorization: Bearer $MEMBER_TOKEN" | jq '.'
```

### Get Upcoming Events
```bash
curl -s "$BASE_URL/mobile/me/events?upcoming=true" \
  -H "Authorization: Bearer $MEMBER_TOKEN" | jq '.'
```

### Response Fields
```json
{
  "id": "uuid",
  "title": "Event Title",
  "description": "Full description",
  "location": "Venue address",
  "starts_at": "2025-11-01T18:00:00Z",
  "ends_at": "2025-11-01T22:00:00Z",
  "status": "published",
  "event_type": "festival",
  "max_participants": 500,
  "current_participants": 125,
  "organizer_id": "uuid",
  "community_id": "uuid",
  "community_name": "Temple Name",
  "image_url": "https://...",
  "created_at": "2025-10-01T10:00:00Z"
}
```

---

## 4. Event Status Values

| Status | Description |
|--------|-------------|
| `draft` | Not visible to members |
| `published` | Visible and open |
| `cancelled` | Event cancelled |
| `completed` | Event finished |

---

## 5. Example: Create Multiple Events

```bash
# Festival Event
curl -X POST "$BASE_URL/communities/$COMMUNITY_ID/events" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Navratri Day 1",
    "start_date": "2025-10-01T18:00:00Z",
    "end_date": "2025-10-01T21:00:00Z",
    "location": "Main Hall",
    "event_type": "festival",
    "max_participants": 200
  }' | jq '.data.id'

# Workshop Event
curl -X POST "$BASE_URL/communities/$COMMUNITY_ID/events" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Sanskrit Learning Workshop",
    "start_date": "2025-10-15T10:00:00Z",
    "end_date": "2025-10-15T12:00:00Z",
    "location": "Library Room",
    "event_type": "workshop",
    "max_participants": 30
  }' | jq '.data.id'

# Meeting Event
curl -X POST "$BASE_URL/communities/$COMMUNITY_ID/events" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Monthly Committee Meeting",
    "start_date": "2025-10-20T19:00:00Z",
    "end_date": "2025-10-20T20:30:00Z",
    "location": "Conference Room",
    "event_type": "meeting",
    "max_participants": 15
  }' | jq '.data.id'
```

---

## 6. Calendar View Data

### Get Events for Calendar Month
```bash
# December 2025
curl -s "$BASE_URL/mobile/communities/$COMMUNITY_ID/events?month=12&year=2025&upcoming=false" \
  -H "Authorization: Bearer $MEMBER_TOKEN" | jq '.data | group_by(.starts_at | split("T")[0])'
```

This groups events by date for calendar display.
