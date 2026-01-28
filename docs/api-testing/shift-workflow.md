# Volunteer Shift Workflow - API Testing Commands

## Prerequisites
```bash
ADMIN_TOKEN="YOUR_ADMIN_TOKEN"
VOLUNTEER_TOKEN="YOUR_VOLUNTEER_JWT_TOKEN"
BASE_URL="http://localhost:5000/api"
```

---

## 1. Admin: Create & Manage Shifts

### Create a New Shift
```bash
curl -X POST "$BASE_URL/volunteers/shifts" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Temple Cleanup Shift",
    "description": "Help clean and organize the temple premises",
    "shift_date": "2025-12-15",
    "start_time": "08:00:00",
    "end_time": "12:00:00",
    "location": "Main Temple Hall",
    "max_volunteers": 10,
    "shift_status": "open"
  }' | jq '.'
```

### List All Shifts
```bash
curl -s "$BASE_URL/volunteers/shifts" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.'
```

### Get Single Shift
```bash
SHIFT_ID="your-shift-id"
curl -s "$BASE_URL/volunteers/shifts/$SHIFT_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.'
```

### Update Shift
```bash
curl -X PUT "$BASE_URL/volunteers/shifts/$SHIFT_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "max_volunteers": 15,
    "description": "Updated description"
  }' | jq '.'
```

### Delete Shift
```bash
curl -X DELETE "$BASE_URL/volunteers/shifts/$SHIFT_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.'
```

---

## 2. Mobile: Volunteer Views Available Shifts

### Get Available Shifts (Open for Signup)
```bash
curl -s "$BASE_URL/mobile/shifts/available" \
  -H "Authorization: Bearer $VOLUNTEER_TOKEN" | jq '.'
```

**Response includes:**
- Shifts with `shift_status: open`
- `spots_available` count
- Excludes shifts already signed up for

---

## 3. Mobile: Volunteer Signs Up for Shift

### Sign Up for a Shift
```bash
curl -X POST "$BASE_URL/mobile/shifts/$SHIFT_ID/signup" \
  -H "Authorization: Bearer $VOLUNTEER_TOKEN" \
  -H "Content-Type: application/json" | jq '.'
```

**Creates attendance record with:**
- `status: scheduled`

---

## 4. Mobile: View My Shifts

### Get My Signed-Up Shifts
```bash
curl -s "$BASE_URL/mobile/me/shifts" \
  -H "Authorization: Bearer $VOLUNTEER_TOKEN" | jq '.'
```

### Filter Upcoming Only
```bash
curl -s "$BASE_URL/mobile/me/shifts?upcoming=true" \
  -H "Authorization: Bearer $VOLUNTEER_TOKEN" | jq '.'
```

**Response includes attendance status:**
- `scheduled` - Signed up
- `present` - Checked in
- `completed` - Checked out

---

## 5. Mobile: Check-In to Shift

### Check In (On Shift Day)
```bash
curl -X POST "$BASE_URL/mobile/shifts/$SHIFT_ID/checkin" \
  -H "Authorization: Bearer $VOLUNTEER_TOKEN" \
  -H "Content-Type: application/json" | jq '.'
```

**Updates attendance:**
- `status: present`
- Records `check_in_time`

---

## 6. Mobile: Check-Out from Shift

### Check Out
```bash
curl -X POST "$BASE_URL/mobile/shifts/$SHIFT_ID/checkout" \
  -H "Authorization: Bearer $VOLUNTEER_TOKEN" \
  -H "Content-Type: application/json" | jq '.'
```

**Updates attendance:**
- `status: completed`
- Records `check_out_time`
- Calculates `hours_worked`
- Updates volunteer's `total_hours`

---

## 7. Mobile: Cancel Shift Signup

### Cancel Before Shift Starts
```bash
curl -X DELETE "$BASE_URL/mobile/shifts/$SHIFT_ID/cancel" \
  -H "Authorization: Bearer $VOLUNTEER_TOKEN" | jq '.'
```

**Requirements:**
- Can only cancel if status is `scheduled`
- Cannot cancel after check-in

---

## 8. Volunteer Profile Stats

### View Profile with Shift Stats
```bash
curl -s "$BASE_URL/mobile/me/volunteer-profile" \
  -H "Authorization: Bearer $VOLUNTEER_TOKEN" | jq '.'
```

**Response includes:**
```json
{
  "shifts_completed": 5,
  "total_hours": 25.5
}
```

---

## Complete Workflow Example

```bash
# 1. Admin creates shift
SHIFT_ID=$(curl -s -X POST "$BASE_URL/volunteers/shifts" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Morning Seva","shift_date":"2025-12-15","start_time":"06:00","end_time":"09:00","location":"Temple","max_volunteers":5}' \
  | jq -r '.data.id')

echo "Created shift: $SHIFT_ID"

# 2. Volunteer sees available shifts
curl -s "$BASE_URL/mobile/shifts/available" -H "Authorization: Bearer $VOLUNTEER_TOKEN" | jq '.data[].title'

# 3. Volunteer signs up
curl -X POST "$BASE_URL/mobile/shifts/$SHIFT_ID/signup" -H "Authorization: Bearer $VOLUNTEER_TOKEN" | jq '.message'

# 4. Volunteer checks in (on shift day)
curl -X POST "$BASE_URL/mobile/shifts/$SHIFT_ID/checkin" -H "Authorization: Bearer $VOLUNTEER_TOKEN" | jq '.message'

# 5. Volunteer checks out
curl -X POST "$BASE_URL/mobile/shifts/$SHIFT_ID/checkout" -H "Authorization: Bearer $VOLUNTEER_TOKEN" | jq '.message'

# 6. View updated profile
curl -s "$BASE_URL/mobile/me/volunteer-profile" -H "Authorization: Bearer $VOLUNTEER_TOKEN" | jq '{shifts_completed,total_hours}'
```

---

## Attendance Status Values

| Status | Description |
|--------|-------------|
| `scheduled` | Signed up for shift |
| `pending` | Awaiting confirmation |
| `present` | Checked in |
| `completed` | Checked out, shift done |
| `absent` | Did not show up |
| `late` | Arrived late |
| `excused` | Excused absence |
