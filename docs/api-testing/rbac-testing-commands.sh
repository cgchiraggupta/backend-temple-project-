#!/bin/bash
# RBAC Testing Commands
# Generated: December 12, 2025
# Purpose: Test role-based access control on protected endpoints
#
# RBAC Summary:
# | Route           | admin | board | finance | member/volunteer |
# |-----------------|-------|-------|---------|------------------|
# | /api/admin/*    | ✓     | ✗     | ✗       | ✗                |
# | /api/finance/*  | ✓     | ✓     | ✓       | ✗                |
# | /api/donations/*| ✓     | ✓     | ✓       | ✗                |
# | /api/expenses/* | ✓     | ✓     | ✓       | ✗                |
# | /api/budgets/*  | ✓     | ✓     | ✓       | ✗                |
# | /api/reports/*  | ✓     | ✓     | ✗       | ✗                |
# | /api/mobile/*   | ✓     | ✓     | ✓       | ✓                |

echo "=== RBAC TESTING SCRIPT ==="
echo ""

# =============================================
# STEP 1: Get Admin Token
# =============================================
echo "1. GETTING ADMIN TOKEN"
ADMIN_TOKEN=$(curl -s -X POST http://localhost:5000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email": "tester@admin.com", "password": "TempPass123!"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
echo "Admin token: ${ADMIN_TOKEN:0:50}..."
echo ""

# =============================================
# STEP 2: Test WITHOUT Authentication
# =============================================
echo "2. NO AUTHENTICATION TESTS (expect 401 for all)"
echo "Finance (no auth):"
curl -s http://localhost:5000/api/finance/summary
echo ""
echo "Admin (no auth):"
curl -s http://localhost:5000/api/admin/users
echo ""

# =============================================
# STEP 3: Test WITH Admin Token
# =============================================
echo ""
echo "3. ADMIN ROLE TESTS (expect SUCCESS for all)"
echo "Finance (admin):"
curl -s http://localhost:5000/api/finance/summary -H "Authorization: Bearer $ADMIN_TOKEN"
echo ""
echo "Admin Users (admin):"
curl -s http://localhost:5000/api/admin/users -H "Authorization: Bearer $ADMIN_TOKEN" | head -c 100
echo "..."
echo ""

# =============================================
# STEP 4: Get Board Token and Test
# =============================================
echo ""
echo "4. BOARD ROLE TESTS"
# First reset password for board user
echo "Resetting board password..."
BOARD_CREDS=$(curl -s -X POST http://localhost:5000/api/admin/resend-credentials \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"email": "aaronvern@board.com"}')
BOARD_PASS=$(echo $BOARD_CREDS | grep -o '"temporaryPassword":"[^"]*"' | cut -d'"' -f4)
echo "Board password: $BOARD_PASS"

BOARD_TOKEN=$(curl -s -X POST http://localhost:5000/api/users/login \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"aaronvern@board.com\", \"password\": \"$BOARD_PASS\"}" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
echo "Board token: ${BOARD_TOKEN:0:50}..."

echo "Finance (board - expect SUCCESS):"
curl -s http://localhost:5000/api/finance/summary -H "Authorization: Bearer $BOARD_TOKEN"
echo ""
echo "Admin (board - expect 403):"
curl -s http://localhost:5000/api/admin/users -H "Authorization: Bearer $BOARD_TOKEN"
echo ""

# =============================================
# STEP 5: Get Community Member Token and Test
# =============================================
echo ""
echo "5. COMMUNITY_MEMBER ROLE TESTS"
MEMBER_CREDS=$(curl -s -X POST http://localhost:5000/api/admin/resend-credentials \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"email": "aaronvernekar11@gmail.com"}')
MEMBER_PASS=$(echo $MEMBER_CREDS | grep -o '"temporaryPassword":"[^"]*"' | cut -d'"' -f4)
echo "Member password: $MEMBER_PASS"

MEMBER_TOKEN=$(curl -s -X POST http://localhost:5000/api/users/login \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"aaronvernekar11@gmail.com\", \"password\": \"$MEMBER_PASS\"}" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
echo "Member token: ${MEMBER_TOKEN:0:50}..."

echo "Finance (member - expect 403):"
curl -s http://localhost:5000/api/finance/summary -H "Authorization: Bearer $MEMBER_TOKEN"
echo ""
echo "Admin (member - expect 403):"
curl -s http://localhost:5000/api/admin/users -H "Authorization: Bearer $MEMBER_TOKEN"
echo ""
echo "Mobile (member - expect SUCCESS):"
curl -s http://localhost:5000/api/mobile/me/communities -H "Authorization: Bearer $MEMBER_TOKEN" | head -c 150
echo "..."
echo ""

# =============================================
# RESULTS SUMMARY
# =============================================
echo ""
echo "=== RBAC TEST RESULTS SUMMARY ==="
echo ""
echo "EXPECTED BEHAVIOR:"
echo "| Endpoint        | No Auth | Admin  | Board  | Finance | Member |"
echo "|-----------------|---------|--------|--------|---------|--------|"
echo "| /api/admin/*    | 401     | ✓      | 403    | 403     | 403    |"
echo "| /api/finance/*  | 401     | ✓      | ✓      | ✓       | 403    |"
echo "| /api/donations/*| 401     | ✓      | ✓      | ✓       | 403    |"
echo "| /api/reports/*  | 401     | ✓      | ✓      | 403     | 403    |"
echo "| /api/mobile/*   | 401     | ✓      | ✓      | ✓       | ✓      |"
echo ""
echo "=== RBAC Testing Complete ==="
