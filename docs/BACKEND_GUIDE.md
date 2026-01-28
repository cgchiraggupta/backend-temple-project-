# Temple Steward Backend Guide

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage
- **Authentication**: JWT tokens

## Project Structure

```
temple-backend/
├── src/
│   ├── routes/           # API route handlers
│   ├── middleware/       # Express middleware
│   ├── services/         # Business logic services
│   ├── models/           # Data models
│   ├── database/         # SQL schemas
│   └── server.js         # Main server file
├── script/               # SQL scripts
├── .env                  # Environment variables
└── package.json
```

## Route Files

| File                 | Base Path            | Description                    | Auth Required |
| -------------------- | -------------------- | ------------------------------ | ------------- |
| users.js             | /api/users           | User authentication            | Partial       |
| communities.js       | /api/communities     | Community management           | Yes           |
| events.js            | /api/events          | Event management               | Yes           |
| publicEvents.js      | /api/public/events   | Public events for website      | No            |
| tasks.js             | /api/tasks           | Task management                | Yes           |
| priests.js           | /api/priests         | Priest management              | Partial*      |
| priestBookings.js    | /api/priest-bookings | Priest booking management      | Partial*      |
| pujas.js             | /api/pujas           | Puja series management         | Yes           |
| volunteers-simple.js | /api/volunteers      | Volunteer management           | Yes           |
| finance.js           | /api/finance         | Financial transactions         | Yes (Finance) |
| donations.js         | /api/donations       | Donation management            | Yes (Finance) |
| expenses.js          | /api/expenses        | Expense management             | Yes (Finance) |
| cms.js               | /api/cms             | CMS content management         | Partial*      |
| gallery.js           | /api/cms/gallery     | Gallery management             | Yes           |
| broadcasts.js        | /api/broadcasts      | Broadcast messages             | Yes           |
| templates.js         | /api/templates       | Message templates              | Yes           |
| mobileRoutes.js      | /api/mobile          | Mobile app optimized endpoints | Yes           |
| admin.js             | /api/admin           | Admin user management          | Yes (Admin)   |

\* **Partial Auth**: GET requests are public, POST/PUT/DELETE require authentication.

## Public Endpoints (No Auth Required)

These endpoints are designed for the public website and do not require authentication:

### Events
- `GET /api/public/events` - List public events
- `GET /api/public/events/:id` - Get single event
- `GET /api/public/events/stats/upcoming` - Get upcoming event count
- `GET /api/public/community-events` - List community events

### Priests & Bookings
- `GET /api/priests` - List all priests
- `GET /api/priests/:id` - Get priest details
- `POST /api/priest-bookings` - Submit booking request
- `GET /api/priest-bookings/busy-priests/:date` - Check priest availability

### CMS Content
- `GET /api/cms/public/banners` - Homepage banners
- `GET /api/cms/public/pujas` - Puja services
- `GET /api/cms/public/sai-aangan` - Mandir expansion info
- `GET /api/cms/public/upcoming-events` - Upcoming events
- `GET /api/cms/public/mandir-hours` - Temple hours
- `GET /api/cms/public/bal-vidya` - Children's education
- `GET /api/cms/public/about-mandir` - About the temple
- `POST /api/cms/contact` - Contact form submission

### Applications
- `GET /api/public/communities` - Browse communities
- `POST /api/public/communities/:id/apply` - Community application
- `POST /api/public/volunteers/apply` - Volunteer application

## Environment Variables

```env
# Server
PORT=5000
NODE_ENV=development

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_service_key

# JWT
JWT_SECRET=your_jwt_secret
```

## Middleware

### authMiddleware.js

Validates JWT tokens and attaches user to request.

```javascript
const { requireAuth } = require("./middleware/authMiddleware");

// Protected route
app.use("/api/protected", requireAuth, protectedRoutes);
```

## Database Connection

Uses Supabase client from `services/supabaseService.js`:

```javascript
const supabaseService = require("../services/supabaseService");

// Query example
const { data, error } = await supabaseService.client
	.from("table_name")
	.select("*");
```

## File Upload

Uses multer for handling file uploads:

```javascript
const multer = require("multer");
const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// Upload to Supabase Storage
const { data, error } = await supabase.storage
	.from("gallery-images")
	.upload(fileName, req.file.buffer, {
		contentType: req.file.mimetype,
	});
```

## Adding New Routes

### 1. Create Route File

```javascript
// src/routes/newFeature.js
const express = require("express");
const router = express.Router();
const supabaseService = require("../services/supabaseService");

router.get("/", async (req, res) => {
	try {
		const { data, error } = await supabaseService.client
			.from("new_table")
			.select("*");

		if (error) throw error;
		res.json({ success: true, data });
	} catch (error) {
		res.status(500).json({ success: false, message: error.message });
	}
});

module.exports = router;
```

### 2. Register in server.js

```javascript
const newFeatureRoutes = require("./routes/newFeature");
app.use("/api/new-feature", requireAuth, newFeatureRoutes);
```

## Error Handling

Standard error response format:

```javascript
res.status(500).json({
	success: false,
	message: "Error description",
	error: error.message,
	code: "ERROR_CODE",
});
```

## CORS Configuration

Allowed origins in server.js:

- Production: temple-management-cms.vercel.app
- Development: localhost:8080, localhost:5173

## Rate Limiting

- General: 500 requests per 15 minutes
- Auth routes: 20 requests per 15 minutes

## Running the Server

```bash
# Install dependencies
npm install

# Development
npm run dev

# Production
npm start
```

## Deployment (Railway)

1. Push changes to git
2. Railway auto-deploys from main branch
3. Environment variables set in Railway dashboard
