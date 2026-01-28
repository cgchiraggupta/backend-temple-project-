# Test Credentials Strategy

**Base Email:** `saibabausa.dev@gmail.com`

Use these email aliases to create distinct test users for each role. The `+tag` allows you to receive all emails at your main inbox while the system treats them as unique users.

## System Roles

| Role | Name | Email Alias | Password | Access Level |
|------|------|-------------|----------|--------------|
| **Admin** | Test Admin | `saibabausa.dev+admin@gmail.com` | GT^tCY4t&rn6 | Full system access (User Management, Settings) |
| **Board Member** | Test Board | `saibabausa.dev+board@gmail.com` |26c*QVNr*0j9| Board Panel, Approvals, Strategy |
| **Community Owner** | Test Owner | `saibabausa.dev+owner@gmail.com` | U@BGLeYt24N%| Manage Communities, Events, Tasks |
| **Volunteer Head** | Test VolHead | `saibabausa.dev+volhead@gmail.com` |8@1oHrVRgD2R | Manage Volunteers, Shifts, Applications |
| **Priest** | Test Priest | `saibabausa.dev+priest@gmail.com` |FGn4%$9O6RoX | Priest Dashboard, Services, Calendar |
| **Finance Team** | Test Finance | `saibabausa.dev+finance@gmail.com` |Y4$a9d%yne8^ | Finance Dashboard, Budget Requests |

## Standard Users

### Volunteers
| Role | Name | Email Alias | Password | Description |
|------|------|-------------|----------|-------------|
| **Volunteer 1** | Test Volunteer 0 1 | `saibabausa.dev+vol1@gmail.com` | b^hBTB^cR$8V| Standard active volunteer |
| **Volunteer 2** | Test Volunteer 2 | `saibabausa.dev+vol2@gmail.com` | | Volunteer with shift history |
| **Volunteer 3** | Test Volunteer 3 | `saibabausa.dev+vol3@gmail.com` | | New applicant / Pending volunteer |

### Community Members
| Role | Name | Email Alias | Password | Description |
|------|------|-------------|----------|-------------|
| **Member 1** | Test Member 1 | `saibabausa.dev+member1@gmail.com` | JCzgClaTav5T| Active community member |
| **Member 2** | Test Member 2 | `saibabausa.dev+member2@gmail.com` |@U!cSeoNz9QW | Member of multiple communities |
| **Member 3** | Test Member 3 | `saibabausa.dev+member3@gmail.com` |z*@XC4E9LS@#| Inactive / New member |

## Multi-Role Examples

You can combine roles when creating a user. Use these examples for testing multi-role scenarios:

| Scenario | Name | Email Alias | Password | Assigned Roles |
|----------|------|-------------|----------|----------------|
| **Priest + Finance** | Priest Finance | `saibabausa.dev+priest_finance@gmail.com` |x2n09wIDeHJ%| `Priest`, `Finance Team` |
| **Owner + Volunteer** | Board Volunteer | `saibabausa.dev+owner_vol@gmail.com` | Iiq2$NOR&mh4| `Board Member`, `Volunteer Head` |
| **Super User** | Super User | `saibabausa.dev+all@gmail.com` | | All available roles |

## How to Create These Users
1. Log in as an **Admin** or **Board Member**.
2. Go to the **Admin Panel**.
3. Enter the **Name** (e.g., "Test Priest") and the **Email Alias** from above.
4. Select the corresponding **Role(s)** from the checkboxes.
5. Click **Register User**.

> **Note:** The password will be auto-generated and sent to `saibabausa.dev@gmail.com` (filtered by the alias if you have filters set up). You can also see the generated credentials in the server logs if running locally.