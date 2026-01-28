# 🏛️ Temple Management System - Backend API

A robust, production-ready Node.js/Express backend API for the Temple Management System. This API serves as the central backend for the Admin Portal, Public Website, and Mobile App, providing comprehensive temple management capabilities including user management, events, volunteers, finances, CMS, and payment processing.

## 🏗️ Architecture

- **Runtime**: Node.js 18+ with Express.js
- **Database**: Supabase (PostgreSQL) with MongoDB legacy support
- **Authentication**: JWT-based with role-based access control (RBAC)
- **File Storage**: Supabase Storage
- **Email Service**: SendGrid
- **Payment Processing**: PayPal Integration
- **Security**: Helmet, CORS, Rate Limiting

## ✨ Key Features

### 🔐 Authentication & Authorization
- JWT-based authentication
- Multi-role RBAC system (Admin, Chairman, Finance, Priest, Volunteer, Community roles)
- Password hashing with bcrypt
- Session management

### 👥 User Management
- User registration and authentication
- Role-based access control
- User profile management
- Password reset functionality

### 🏘️ Community Management
- Community CRUD operations
- Member management and applications
- Community tasks and assignments
- Community statistics and analytics
- Timeline and announcements

### 📅 Event Management
- Event creation and management
- Recurring events support
- Event registration
- Public and private events
- Event uploads and media

### 💰 Financial Management
- Donation tracking and processing
- Expense management with file attachments
- Budget requests and approvals
- Financial reports and reconciliation
- PayPal payment integration

### 🎨 Content Management System (CMS)
- Banner management (4 banner slots)
- Puja catalog management
- Gallery management
- Event content management
- Mandir hours configuration
- Bal Vidya Mandir content
- Sai Aangan content

### 👨‍💼 Priest Management
- Priest directory
- Booking management system
- Availability calendar
- Confirmation email system

### 🤝 Volunteer Management
- Volunteer registration
- Shift scheduling
- Attendance tracking (check-in/check-out)
- Hours tracking and reporting

### 📊 Reporting & Analytics
- Financial reports
- Community analytics
- Event analytics
- Volunteer reports
- Custom report generation

## 📁 Project Structure

```
src/
├── config/              # Configuration files (constants, roles, database)
├── controllers/         # Request handlers and business logic
│   ├── budget/         # Budget management
│   ├── community/      # Community operations
│   ├── event/          # Event management
│   ├── financial/      # Financial operations
│   ├── kanban/         # Kanban board
│   └── task/           # Task management
├── database/           # Database schemas, seeds, and migrations
│   └── migrations/     # Database migration scripts
├── middleware/         # Express middleware
│   ├── authMiddleware.js      # JWT authentication
│   ├── rbacMiddleware.js      # Role-based access control
│   ├── uploadMiddleware.js    # File upload handling
│   └── validationMiddleware.js # Input validation
├── models/             # Data models (Supabase-backed)
├── routes/             # API route definitions
├── services/           # Business logic services
│   ├── budget/         # Budget services
│   ├── community/      # Community services
│   ├── event/          # Event services
│   ├── financial/      # Financial services
│   └── kanban/         # Kanban services
├── utils/              # Utility functions
│   ├── activityLogger.js      # Activity logging
│   ├── asyncHandler.js        # Async error handling
│   ├── csvExporter.js         # CSV export
│   └── dateHelpers.js         # Date utilities
├── validators/         # Input validation schemas
└── server.js           # Main application entry point
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ 
- **npm** or **yarn**
- **Supabase** account with project configured
- **SendGrid** account (for email services)
- **PayPal** account (for payment processing)

### Installation

```bash
# Clone the repository
git clone git@github.com:cgchiraggupta/backend-temple-project-.git
cd temple-backend-testing-v3-feature-paypal-integration-v2

# Install dependencies
npm install

# Copy environment variables template
cp .env.example .env

# Edit .env with your configuration (see Environment Variables section)
nano .env

# Start development server
npm run dev

# Or start production server
npm start
```

### Environment Variables

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_role_key

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_min_32_characters

# Email Service (SendGrid)
SENDGRID_API_KEY=your_sendgrid_api_key
EMAIL_FROM=noreply@temple.org
EMAIL_FROM_NAME=Temple Management System

# PayPal Configuration (for payment processing)
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_MODE=sandbox  # or 'live' for production

# MongoDB (Legacy - optional)
MONGODB_URI=mongodb://localhost:27017/temple_db
```

### Database Setup

1. **Supabase Setup:**
   - Create a new Supabase project
   - Run the SQL schema from `src/database/complete-schema.sql`
   - Configure storage buckets for file uploads

2. **Run Migrations:**
   ```bash
   npm run migrate:users-communities
   ```

3. **Seed Database (Optional):**
   ```bash
   npm run seed
   ```

## 📚 API Documentation

### Base URL
```
Development: http://localhost:5000/api
Production: https://your-api-domain.com/api
```

### Authentication

Most endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

### Key Endpoints

#### Authentication
- `POST /api/users/register` - User registration
- `POST /api/users/login` - User login
- `POST /api/users/refresh-token` - Refresh JWT token
- `GET /api/users/profile` - Get user profile (Protected)
- `PUT /api/users/profile` - Update user profile (Protected)

#### Communities
- `GET /api/communities` - List all communities (Protected)
- `POST /api/communities` - Create community (Admin)
- `GET /api/communities/:id` - Get community details
- `PUT /api/communities/:id` - Update community (Admin)
- `DELETE /api/communities/:id` - Delete community (Admin)
- `POST /api/communities/:id/members` - Add member
- `GET /api/communities/:id/members` - List members
- `POST /api/communities/:id/applications` - Submit application

#### Events
- `GET /api/events` - List events (Protected)
- `POST /api/events` - Create event (Protected)
- `GET /api/events/:id` - Get event details
- `PUT /api/events/:id` - Update event (Protected)
- `DELETE /api/events/:id` - Delete event (Admin)
- `GET /api/public/events` - Public events (No auth)
- `POST /api/events/:id/register` - Register for event

#### Finance
- `GET /api/finance/summary` - Financial summary (Finance role)
- `POST /api/donations` - Record donation (Finance)
- `GET /api/donations` - List donations (Finance)
- `POST /api/expenses` - Record expense (Finance)
- `GET /api/expenses` - List expenses (Finance)
- `POST /api/budget-requests` - Create budget request
- `GET /api/budgets` - List budgets

#### CMS (Content Management)
- `GET /api/cms/banners` - Get banners (Public)
- `POST /api/cms/banners` - Create/update banner (Admin)
- `GET /api/cms/pujas` - Get puja catalog (Public)
- `POST /api/cms/pujas` - Create puja (Admin)
- `GET /api/cms/gallery` - Get gallery (Public)
- `POST /api/cms/gallery` - Upload to gallery (Admin)

#### Volunteers
- `GET /api/volunteers` - List volunteers (Protected)
- `POST /api/volunteers` - Register volunteer
- `POST /api/volunteers/:id/check-in` - Check in volunteer
- `POST /api/volunteers/:id/check-out` - Check out volunteer
- `GET /api/volunteers/:id/hours` - Get volunteer hours

#### Priests
- `GET /api/priests` - List priests (Public)
- `POST /api/priest-bookings` - Book a priest (Public)
- `GET /api/priest-bookings` - List bookings (Protected)

### Public Endpoints (No Authentication Required)

- `GET /api/public/events` - Public events listing
- `GET /api/cms/public/*` - Public CMS content (banners, pujas, gallery)
- `POST /api/priest-bookings` - Book a priest
- `POST /api/public/volunteers/apply` - Volunteer application
- `GET /api/priests` - Priest directory

Full API documentation is available in [`docs/API_ENDPOINTS.md`](docs/API_ENDPOINTS.md).

## 🔐 Role-Based Access Control

The API supports multiple user roles with hierarchical permissions:

| Role | Description | Access Level |
|------|-------------|--------------|
| `admin` | System administrator | Full system access |
| `chairman` | Board chairman | Board leadership access |
| `chair_board` | Board member | Board-level permissions |
| `board` | Board member | Board-level access |
| `finance_team` | Finance team member | Financial management |
| `priest` | Priest | Priest dashboard, bookings |
| `volunteer` | Volunteer | Volunteer portal access |
| `community_lead` | Community leader | Community management |
| `community_owner` | Community owner | Community ownership |
| `community_member` | Community member | Basic community access |

## 🧪 Development

```bash
# Run in development mode with auto-reload (nodemon)
npm run dev

# Run production server
npm start

# Run database migrations
npm run migrate:users-communities

# Seed database with sample data
npm run seed
```

### Development Tools

- **Nodemon**: Auto-reload on file changes
- **Morgan**: HTTP request logger
- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing
- **Express Rate Limit**: API rate limiting

## 🏥 Health Check

```bash
curl http://localhost:5000/health
```

Response:
```json
{
  "status": "OK",
  "timestamp": "2026-01-28T00:00:00.000Z",
  "database": "Supabase",
  "version": "1.0.0"
}
```

## 🧪 Testing

```bash
# Run tests (if test suite is configured)
npm test

# Run tests with coverage
npm run test:coverage
```

## 📦 Deployment

### Railway (Recommended)

1. Connect your GitHub repository to Railway
2. Set environment variables in Railway dashboard
3. Deploy automatically on push to main branch

### Vercel

1. Import project from GitHub
2. Configure environment variables
3. Set build command: `npm install`
4. Set start command: `npm start`

### Docker (Optional)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt with salt rounds
- **Rate Limiting**: Prevents API abuse
- **Helmet**: Security headers
- **CORS**: Configured for specific origins
- **Input Validation**: Express-validator for all inputs
- **SQL Injection Protection**: Parameterized queries via Supabase
- **File Upload Validation**: Type and size restrictions

## 📊 Monitoring & Logging

- **Activity Logging**: User actions logged to database
- **Error Logging**: Centralized error handling
- **Request Logging**: Morgan HTTP logger
- **Email Logging**: Email send status tracking

## 🔗 Related Repositories

- [Admin Portal](https://github.com/cgchiraggupta/admin--portal-) - Admin Dashboard (React/Vite)
- [Public Website](https://github.com/cgchiraggupta/public-website-) - Public Website (Next.js)

## 📝 API Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error information"
}
```

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| Node.js | Runtime environment |
| Express.js | Web framework |
| Supabase | PostgreSQL database & storage |
| MongoDB | Legacy database support |
| JWT | Authentication |
| SendGrid | Email service |
| PayPal | Payment processing |
| Multer | File upload handling |
| bcryptjs | Password hashing |
| Express Validator | Input validation |
| Helmet | Security headers |
| CORS | Cross-origin support |
| Morgan | HTTP logging |

## 📄 License

Private - Temple Management System

## 👥 Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## 📞 Support

For issues and questions, please open an issue on GitHub or contact the development team.

---

**Version**: 1.0.0  
**Last Updated**: January 2026
