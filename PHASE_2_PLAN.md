# Phase 2 Implementation Plan - Sloth Lee Dashboard Pages

## 🎯 Objective
Complete all remaining dashboard pages with Sloth Lee design system components, maintaining consistency with Phase 1 design.

## 📋 Pages to Redesign (Priority Order)

### 1. **TicketsPage** (/dashboard/tickets)
- **Status**: Partially complete - has basic logic, needs UI redesign
- **Components Needed**: 
  - Title section + description
  - Search input (ticket number/subject)
  - 3 stat cards: Total Tickets, Open Tickets, Assigned
  - DataTable: columns [Ticket #, Subject, Status Badge, Priority Badge, Assigned To, Created Date, Actions]
  - Pagination controls
  - Filter controls for status/priority/assigned
  - Sort presets (urgent, oldest, newest, unassigned)

### 2. **TicketDetailPage** (/dashboard/tickets/:id)
- **Status**: Stub - needs full implementation
- **Components Needed**:
  - Header: Ticket #{id} - Subject (with back button)
  - 4 stat cards: Status, Priority, Assigned To, Created Date
  - Description card
  - Timeline/Activity feed
  - Comments section
  - Action buttons (assign, change status, priority)

### 3. **ModerationPage** (/dashboard/moderation)
- **Status**: Partially complete - has basic logic
- **Components Needed**:
  - Title + description
  - Search/filter inputs
  - 3 stat cards: Total Cases, Open Cases, This Week
  - DataTable: columns [Case #, Action, Target, Moderator, Reason, Duration, Created, Actions]
  - Filters for action type, date range
  - Real-time case counter badge

### 4. **AnalyticsPage** (/dashboard/analytics)
- **Status**: Stub - needs full implementation
- **Components Needed**:
  - Title + description
  - Date range picker
  - 4 stat cards: Messages, Users, Moderation Events, Tickets Resolved
  - 4 charts: Messages over time, User activity heatmap, Top commands, Ticket resolution rate
  - Custom time period comparison

### 5. **AiAdvisorPage** (/dashboard/ai-advisor)
- **Status**: Stub - needs full implementation
- **Components Needed**:
  - Title + description
  - Prompt input area with submit button
  - Chat-like interface for AI responses
  - Suggestion pills (quick prompts)
  - Loading skeleton while generating
  - Copy response button

### 6. **LogsPage** (/dashboard/logs)
- **Status**: Stub - needs full implementation
- **Components Needed**:
  - Title + description
  - Search/filter inputs (user, action, date range)
  - DataTable: columns [Timestamp, User, Action, Resource, Status, Details]
  - Log level indicators (info, warning, error)
  - Real-time log tail option
  - Export CSV button

### 7. **UsersPage** (/dashboard/users)
- **Status**: Stub - needs full implementation
- **Components Needed**:
  - Title + description
  - Search input (username, email)
  - 3 stat cards: Total Users, Active This Week, New This Month
  - DataTable: columns [Username, Email, Role, Last Seen, Status, Actions]
  - Inline edit/manage buttons
  - Bulk actions (assign role, ban, kick)

### 8. **SettingsPage** (/dashboard/settings)
- **Status**: Stub - needs redesign with components
- **Components Needed**:
  - Title + description
  - Tabbed interface: General, Security, Appearance, Keyboard Shortcuts, Notifications, Integrations
  - Each section with appropriate inputs/toggles
  - Save/Apply buttons

### 9. **LoginPage** (/login)
- **Status**: Stub - needs full redesign
- **Components Needed**:
  - Centered login card (variant="elevated")
  - Sloth Lee branding/logo
  - Email input with validation
  - Password input with show/hide toggle
  - Remember me checkbox
  - Login button with loading state
  - Sign up / Forgot password links
  - Social login options (optional)

## 🎨 Design System to Use

### Components Ready
- ✅ Button (5 variants)
- ✅ Card (4 variants)
- ✅ StatCard (with trends)
- ✅ Badge (5 variants)
- ✅ Input (with icon)
- ✅ Select (dropdown)
- ✅ DataTable (with sorting/pagination)
- ✅ Skeleton (loading states)

### Colors (Tailwind Classes)
- **Primary**: `text-cyan` / `bg-cyan` - #00d4ff
- **Secondary**: `text-lime` / `bg-lime` - #00ff88
- **Accent**: `text-amber` / `bg-amber` - #ffb830
- **Danger**: `text-danger` / `bg-danger` - #ff4455
- **Background**: `bg-void` - #0a1420
- **Surfaces**: `bg-surface` / `bg-surface-strong`
- **Text**: `text-text-0` (primary) to `text-text-3` (subtle)

### Typography
- Headings: Use `font-display` with `font-bold`
- Titles: `text-xl font-semibold text-cyan`
- Descriptions: `text-sm text-text-2`

### Common Patterns
```tsx
// Header section
<div>
  <h1 className="text-3xl font-bold text-cyan font-display">Page Title</h1>
  <p className="text-text-2 mt-2">Page description</p>
</div>

// Stat cards grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
  <StatCard icon={<Icon />} label="..." value={...} trend={...} />
</div>

// DataTable with search
<Card variant="elevated">
  <CardContent className="pt-6">
    <Input placeholder="Search..." icon={<Search />} />
  </CardContent>
</Card>
<Card variant="elevated">
  <CardContent>
    <DataTable columns={columns} data={data} isLoading={loading} />
  </CardContent>
</Card>
```

## 📊 Implementation Checklist

- [ ] TicketsPage - UI redesign (keep existing logic)
- [ ] TicketDetailPage - Full implementation
- [ ] ModerationPage - UI redesign (keep existing logic)
- [ ] AnalyticsPage - Charts + stat cards
- [ ] AiAdvisorPage - Chat interface
- [ ] LogsPage - Audit log table
- [ ] UsersPage - User management table
- [ ] SettingsPage - Tabbed settings UI
- [ ] LoginPage - Authentication form
- [ ] Test all pages render without errors
- [ ] Verify responsive design (mobile/tablet/desktop)
- [ ] Performance check - build size
- [ ] Git commit Phase 2 completion

## ⏱️ Estimated Time
- Per page average: 15-20 minutes
- Total: ~3 hours for all 9 pages
- Plus testing + optimization: +30 minutes

## 🚀 Next Steps
1. Start with TicketsPage (most complete, easiest)
2. Move to ModerationPage (similar structure)
3. Complete data table pages (LogsPage, UsersPage)
4. Implement chart pages (AnalyticsPage)
5. UI-heavy pages (TicketDetailPage, AiAdvisorPage, SettingsPage)
6. Polish LoginPage last
7. Full build + test cycle
8. Git commit Phase 2 completion

---

**Phase 2 Kickoff**: Ready to begin implementation!
