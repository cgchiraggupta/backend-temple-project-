# Community Member Workflow - API Testing Commands

## Prerequisites
```bash
# Get an admin token first
ADMIN_TOKEN="YOUR_ADMIN_TOKEN"

# Base URL
BASE_URL="http://localhost:5000/api"
```

---

## 1. List Available Communities (Public)

```bash
curl -s "$BASE_URL/public/communities" | jq '.'
```

---

## 2. Public Community Member Application (No Auth Required)

### Submit Community Membership Application
```bash
COMMUNITY_ID="your-community-id"

curl -X POST "$BASE_URL/public/community-applications" \
  -H "Content-Type: application/json" \
  -d '{
    "community_id": "'$COMMUNITY_ID'",
    "applicant_name": "Raj Sharma",
    "applicant_email": "raj.sharma@example.com",
    "applicant_phone": "9876543212",
    "why_join": "I want to be part of this spiritual community",
    "additional_message": "I have been attending events for 2 years",
    "previous_experience": "Active member at another temple"
  }' | jq '.'
```

---

## 3. Admin: Manage Community Applications

### List All Community Applications
```bash
curl -s "$BASE_URL/communities/applications" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.'
```

### Filter by Community
```bash
curl -s "$BASE_URL/communities/applications?community_id=$COMMUNITY_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.'
```

### Filter by Status
```bash
curl -s "$BASE_URL/communities/applications?status=pending" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.'
```

### View Single Application
```bash
APPLICATION_ID="your-application-id"
curl -s "$BASE_URL/communities/applications/$APPLICATION_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.'
```

### Approve Application (Creates Member + User Account)
```bash
curl -X PUT "$BASE_URL/communities/applications/$APPLICATION_ID/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" | jq '.'
```

### Reject Application
```bash
curl -X PUT "$BASE_URL/communities/applications/$APPLICATION_ID/reject" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"rejection_reason": "Application does not meet requirements"}' | jq '.'
```

---

## 4. Admin: Manage Community Members

### List Community Members
```bash
curl -s "$BASE_URL/communities/$COMMUNITY_ID/members" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.'
```

### Add Member Directly
```bash
curl -X POST "$BASE_URL/communities/$COMMUNITY_ID/members" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "existing-user-id",
    "role": "member"
  }' | jq '.'
```

### Update Member Role
```bash
MEMBER_ID="your-member-id"
curl -X PUT "$BASE_URL/communities/$COMMUNITY_ID/members/$MEMBER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "moderator"}' | jq '.'
```

### Remove Member
```bash
curl -X DELETE "$BASE_URL/communities/$COMMUNITY_ID/members/$MEMBER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.'
```

---

## 5. Mobile: My Communities (Requires Auth)

### Get My Communities
```bash
MEMBER_TOKEN="your-member-jwt-token"
curl -s "$BASE_URL/mobile/me/communities" \
  -H "Authorization: Bearer $MEMBER_TOKEN" | jq '.'
```

### Get Community Details
```bash
curl -s "$BASE_URL/mobile/communities/$COMMUNITY_ID" \
  -H "Authorization: Bearer $MEMBER_TOKEN" | jq '.'
```

---

## Notes

- When an application is approved, a user account is created with a temporary password
- The member receives an email with login credentials
- Application status values: `pending`, `approved`, `rejected`, `deleted`
- Member roles: `member`, `moderator`, `admin`
