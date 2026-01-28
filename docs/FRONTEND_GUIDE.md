# Temple Steward Frontend Guide

## Tech Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + shadcn/ui components
- **State Management**: TanStack Query (React Query)
- **Routing**: React Router v6
- **Icons**: Lucide React

## Project Structure

```
src/
├── components/
│   ├── auth/           # Authentication components
│   ├── communities/    # Community management
│   ├── dashboard/      # Dashboard components
│   ├── events/         # Event management
│   ├── finance/        # Finance & donations
│   ├── layout/         # Layout components (Sidebar, Header)
│   ├── priests/        # Priest management
│   ├── pujas/          # Puja management
│   ├── ui/             # shadcn/ui components
│   ├── volunteers/     # Volunteer management
│   └── website/        # CMS website management
├── hooks/
│   ├── use-auth.tsx    # Authentication hook
│   ├── use-complete-api.tsx  # All API hooks
│   └── use-toast.tsx   # Toast notifications
├── pages/              # Page components
├── lib/                # Utility functions
└── App.tsx             # Main app with routing
```

## Key Components

### Layout

- `AdminLayout` - Main layout with sidebar
- `Sidebar` - Navigation sidebar with role-based menu items
- `DashboardHeader` - Top header with user info

### Pages

| Page       | Route         | Description               |
| ---------- | ------------- | ------------------------- |
| Dashboard  | `/`           | Main dashboard with stats |
| Events     | `/events`     | Event management          |
| Pujas      | `/pujas`      | Puja series management    |
| Finance    | `/finance`    | Financial management      |
| Donations  | `/donations`  | Donation tracking         |
| Volunteers | `/volunteers` | Volunteer management      |
| Priests    | `/priests`    | Priest management         |
| Website    | `/website`    | CMS content management    |
| Settings   | `/settings`   | User settings             |
| Reports    | `/reports`    | Reports & analytics       |

## API Hooks (use-complete-api.tsx)

### Authentication

```typescript
// No specific auth hooks - uses localStorage tokens
```

### Communities

```typescript
useCommunities(params?)      // Get communities
useCommunity(id)             // Get single community
```

### Events

```typescript
useEvents(params?)           // Get events
useCreateEvent()             // Create event
useUpdateEvent()             // Update event
```

### Tasks

```typescript
useTasks(params?)            // Get tasks
useCreateTask()              // Create task
useUpdateTask()              // Update task
useDeleteTask()              // Delete task
```

### Pujas

```typescript
usePujaSeries(params?)       // Get puja series
useCreatePujaSeries()        // Create puja
useUpdatePujaSeries()        // Update puja
useDeletePujaSeries()        // Delete puja
```

### Priests

```typescript
usePriests(params?)          // Get priests
useCreatePriest()            // Create priest
useUpdatePriest()            // Update priest
useDeletePriest()            // Delete priest
```

### Priest Bookings

```typescript
usePriestBookings(params?)   // Get bookings
usePriestBookingStats()      // Get stats
useUpdatePriestBooking()     // Update booking
useDeletePriestBooking()     // Delete booking
useBusyPriests(date, excludeId?)  // Get busy priests
```

### Finance

```typescript
useFinancialSummary(); // Get summary
useBudgetCategories(); // Get categories
useCreateBudgetCategory(); // Create category
useTransactions(); // Get transactions
useCreateTransaction(); // Create transaction
```

### Donations

```typescript
useDonationsTable(); // Get donations
useCreateDonation(); // Create donation
useDonationCategories(); // Get categories
```

### Volunteers

```typescript
useVolunteers(params?)       // Get volunteers
useCreateVolunteer()         // Create volunteer
useUpdateVolunteer()         // Update volunteer
useDeleteVolunteer()         // Delete volunteer
```

### CMS

```typescript
useBalVidya(); // Get Bal Vidya content
useCreateBalVidya(); // Create content
useUpdateBalVidya(); // Update content
```

## Role-Based Access

Roles are defined in the user object and control sidebar visibility:

```typescript
const ROLES = {
	admin: "admin",
	board_member: "board_member",
	priest_head: "priest_head",
	priest: "priest",
	volunteer: "volunteer",
	member: "member",
};
```

### Sidebar Menu Visibility

| Menu Item  | Allowed Roles                            |
| ---------- | ---------------------------------------- |
| Dashboard  | All                                      |
| Events     | All                                      |
| Pujas      | All                                      |
| Finance    | admin, board_member                      |
| Donations  | admin, board_member                      |
| Volunteers | admin, board_member                      |
| Priests    | admin, board_member, priest_head, priest |
| Website    | admin, board_member                      |
| Reports    | admin, board_member                      |
| Settings   | All                                      |

## Environment Variables

```env
VITE_API_URL=https://temple-backend-production-7324.up.railway.app/api
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Running the Project

```bash
# Install dependencies
npm install

# Development
npm run dev

# Build
npm run build

# Preview production build
npm run preview
```

## Adding New Features

### 1. Create API Hook

Add to `src/hooks/use-complete-api.tsx`:

```typescript
export function useNewFeature() {
	return useQuery({
		queryKey: ["new-feature"],
		queryFn: async () => {
			return await apiRequest("/new-endpoint");
		},
	});
}
```

### 2. Create Component

Create in appropriate folder under `src/components/`:

```typescript
import { useNewFeature } from "@/hooks/use-complete-api";

export function NewFeatureComponent() {
	const { data, isLoading } = useNewFeature();
	// ...
}
```

### 3. Add Route

Update `src/App.tsx`:

```typescript
<Route
	path="/new-feature"
	element={
		<RoleProtectedRoute allowedRoles={["admin"]}>
			<NewFeaturePage />
		</RoleProtectedRoute>
	}
/>
```

### 4. Add to Sidebar

Update `src/components/layout/Sidebar.tsx`:

```typescript
{
  name: 'New Feature',
  href: '/new-feature',
  icon: IconComponent,
  roles: ['admin']
}
```

## UI Components (shadcn/ui)

Common components used:

- `Button` - Buttons with variants
- `Card` - Content cards
- `Dialog` - Modal dialogs
- `Table` - Data tables
- `Select` - Dropdown selects
- `Input` - Text inputs
- `Textarea` - Multi-line inputs
- `Badge` - Status badges
- `Tabs` - Tab navigation
- `AlertDialog` - Confirmation dialogs

## Best Practices

1. **Use React Query** for all API calls
2. **Invalidate queries** after mutations
3. **Show loading states** with `isLoading`
4. **Handle errors** with toast notifications
5. **Use TypeScript** interfaces for data types
6. **Follow component structure** in existing code
