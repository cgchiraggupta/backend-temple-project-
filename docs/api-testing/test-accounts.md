# Test Accounts for RBAC Testing

> **⚠️ WARNING:** These are test credentials. Do not use in production!
> 
> Generated: December 12, 2025

## Account Credentials by Role

### Admin
| Email | Password | Role | Access |
|-------|----------|------|--------|
| `tester@admin.com` | `TempPass123!` | admin | Full access to all endpoints |

### Board
| Email | Password | Role | Access |
|-------|----------|------|--------|
| `aaronvern@board.com` | `59tc5j^GU#B1` | board | Finance, Reports, Mobile (NOT Admin) |

### Community Member
| Email | Password | Role | Access |
|-------|----------|------|--------|
| `aaronvernekar11@gmail.com` | `PxjNX3LjC!1L` | community_member | Mobile only (NOT Finance, Admin, Reports) |

### Volunteer
| Email | Password | Role | Access |
|-------|----------|------|--------|
| `aaronvernekar+vol@gmail.com` | `Xvx0&uWNsali` | volunteer | Mobile only (NOT Finance, Admin, Reports) |

---

## Access Matrix

| Endpoint | admin | board | finance | community_member | volunteer |
|----------|-------|-------|---------|------------------|-----------|
| `/api/admin/*` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/api/finance/*` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `/api/donations/*` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `/api/expenses/*` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `/api/budgets/*` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `/api/reports/*` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `/api/mobile/*` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/api/communities/*` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/api/volunteers/*` | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Quick Login Commands

```bash
# Admin Login
curl -s -X POST http://localhost:5000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email": "tester@admin.com", "password": "TempPass123!"}'

# Board Login
curl -s -X POST http://localhost:5000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email": "aaronvern@board.com", "password": "59tc5j^GU#B1"}'

# Community Member Login
curl -s -X POST http://localhost:5000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email": "aaronvernekar11@gmail.com", "password": "PxjNX3LjC!1L"}'

# Volunteer Login
curl -s -X POST http://localhost:5000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email": "aaronvernekar+vol@gmail.com", "password": "Xvx0&uWNsali"}'
```
