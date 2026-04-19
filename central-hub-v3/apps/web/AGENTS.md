<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Central Hub v4.0 Frontend

AI-powered mission control platform - full-scale frontend implementation.

## Architecture Overview

### Tech Stack
- **Framework**: Next.js 16 (App Router)
- **UI Library**: React 19
- **Language**: TypeScript 5 (Strict Mode)
- **Styling**: Tailwind CSS 4
- **State Management**: Zustand
- **Data Fetching**: TanStack Query (React Query)
- **HTTP Client**: Axios

### Project Structure

```
app/
├── dashboard/              # Dashboard pages
│   ├── page.tsx           # Overview (updated with real API)
│   ├── ai-hub/            # AI Central Hub (updated with real API)
│   │   ├── page.tsx
│   │   └── components/
│   │       ├── ai-overview.tsx
│   │       ├── ai-intelligence.tsx
│   │       ├── ai-recommendations.tsx
│   │       ├── ai-predictions.tsx
│   │       └── ai-command.tsx
│   ├── security/          # Security Dashboard (NEW v4.0)
│   ├── healing/           # Self-Healing Dashboard (NEW v4.0)
│   ├── scaling/           # Predictive Scaling (NEW v4.0)
│   ├── cloud/             # Multi-Cloud Manager (NEW v4.0)
│   ├── kubernetes/        # Kubernetes Dashboard (NEW v4.0)
│   ├── cicd/              # CI/CD Pipeline Manager (NEW v4.0)
│   └── discord/           # Discord Advanced (NEW v4.0)
│
├── components/
│   ├── layout/
│   │   └── sidebar.tsx    # Updated with 16 nav items
│   └── ui/                # Shared UI Components (NEW Phase 4)
│       ├── index.ts       # Barrel exports
│       ├── status-badge.tsx
│       ├── metric-card.tsx
│       ├── data-table.tsx
│       ├── timeline.tsx
│       ├── skeleton.tsx
│       ├── error-boundary.tsx
│       ├── confirmation-dialog.tsx
│       └── chart-wrapper.tsx
│
├── hooks/
│   ├── use-services.ts    # Service hooks
│   └── use-ai.ts          # AI & Agentic AI hooks (NEW Phase 3)
│
├── lib/
│   ├── api-client.ts      # Extended 740+ lines, 120+ endpoints
│   └── utils.ts           # Utility functions
│
├── stores/
│   └── auth-store.ts      # Zustand auth store
│
└── types/
    └── index.ts           # 800+ lines TypeScript definitions

## UI Components

### StatusBadge
Status indicator with 25 status types, 4 variants (default, dot, outline, subtle), and 3 sizes.

```tsx
import { StatusBadge } from '@/app/components/ui';

<StatusBadge status="healthy" size="md" variant="default" pulse />
<StatusBadge status="running" variant="dot" />
<StatusBadge status="critical" variant="outline" />
```

### MetricCard
Display metrics with trends, sparklines, and comparisons.

```tsx
import { MetricCard } from '@/app/components/ui';

<MetricCard
  title="CPU Usage"
  value="78%"
  trend={{ direction: 'up', value: '12%', label: 'vs last hour' }}
  sparkline={[45, 52, 48, 60, 55, 62, 70, 78]}
  color="cyan"
  icon={<CpuIcon />}
/>
```

### DataTable
Sortable, searchable table with pagination and row selection.

```tsx
import { DataTable, type Column } from '@/app/components/ui';

const columns: Column<Data>[] = [
  { key: 'name', title: 'Name', sortable: true },
  { key: 'status', title: 'Status', render: (row) => <StatusBadge status={row.status} /> },
];

<DataTable
  data={data}
  columns={columns}
  keyExtractor={(row) => row.id}
  searchable
  pagination
  pageSize={10}
/>
```

### Timeline
Chronological event display with grouping and action buttons.

```tsx
import { Timeline, type TimelineEvent } from '@/app/components/ui';

const events: TimelineEvent[] = [
  {
    id: '1',
    timestamp: new Date().toISOString(),
    title: 'Deployment Started',
    status: 'running',
    description: 'Deploying to production...',
  },
];

<Timeline events={events} groupByDate showTimeMarkers />
```

### Loading Skeletons
Consistent loading states across the app.

```tsx
import { Loading } from '@/app/components/ui';

<Loading.Card rows={3} />
<Loading.Table rows={5} columns={4} />
<Loading.Page statsCount={4} />
<Loading.Chart height={250} />
```

### ErrorBoundary
Catch and display errors gracefully with recovery options.

```tsx
import { ErrorBoundary, SectionError } from '@/app/components/ui';

<ErrorBoundary onError={(error, info) => console.error(error)}>
  <MyComponent />
</ErrorBoundary>

// Section-specific error
<SectionError
  title="Failed to load"
  message="Could not fetch data"
  onRetry={() => refetch()}
/>
```

### ConfirmationDialog
Modal dialog for confirming actions.

```tsx
import { ConfirmationDialog } from '@/app/components/ui';

<ConfirmationDialog
  isOpen={showDialog}
  onClose={() => setShowDialog(false)}
  onConfirm={handleDelete}
  title="Delete Service?"
  message="This action cannot be undone."
  variant="danger"
  confirmLabel="Delete"
  isLoading={isDeleting}
/>
```

### ChartWrapper
Consistent chart styling with error handling.

```tsx
import { ChartWrapper, MiniChart } from '@/app/components/ui';

<ChartWrapper
  title="CPU Usage"
  subtitle="Last 24 hours"
  height={250}
  legend={[{ color: '#06b6d4', label: 'Current' }]}
>
  {/* Chart content */}
</ChartWrapper>

<MiniChart data={[45, 52, 48, 60, 55]} color="#06b6d4" height={60} />
```

## API Integration

### TanStack Query Hooks

All data fetching is done through TanStack Query hooks in `app/hooks/`:

```tsx
// Service hooks
import { useServices, useService, useCreateService } from '@/app/hooks/use-services';

// AI hooks
import { 
  useAIInsights, 
  useAIPredictions,
  useAgents,
  useAgentPlans,
  useCreateAgentPlan,
} from '@/app/hooks/use-ai';
```

### API Client

The `api-client.ts` provides type-safe API access:

```tsx
import { api } from '@/app/lib/api-client';

// Services
const { data } = await api.services.list();

// AI
const { data } = await api.ai.analyze(serviceId);

// Agents
const { data } = await api.agents.createPlan(goal, agentType);
```

## Design System

### Colors
- Primary: Cyan (`#06b6d4`)
- Secondary: Violet (`#8b5cf6`)
- Success: Green (`#22c55e`)
- Warning: Yellow (`#eab308`)
- Error: Red (`#ef4444`)
- Background: Dark slate (`#0f172a`)

### Glassmorphism
Components use glassmorphism effect:
```css
.glass-card {
  @apply bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl;
}
```

### Status Colors
- Healthy: Green
- Warning: Yellow  
- Critical: Red
- Running: Violet
- Pending: Yellow
- Completed: Green
- Failed: Red

## Coding Conventions

### File Organization
- One component per file
- Co-locate sub-components in same directory
- Use barrel exports (`index.ts`) for public API

### Naming
- Components: PascalCase (`StatusBadge.tsx`)
- Hooks: camelCase with `use` prefix (`useServices.ts`)
- Types: PascalCase with descriptive names
- Files: kebab-case (`api-client.ts`)

### TypeScript
- Strict mode enabled
- Explicit return types on functions
- No `any` types without documentation
- Use `unknown` for API responses before validation

### Styling
- Use Tailwind utility classes
- Use `cn()` utility for conditional classes
- Avoid arbitrary values when possible
- Use CSS variables for theme values

## Performance

### Optimization Strategies
- TanStack Query caching with `staleTime` and `gcTime`
- Skeleton loading states for perceived performance
- Lazy loading for dashboard pages
- Optimistic updates for mutations

### Best Practices
- Use `React.memo()` for expensive components
- Use `useMemo()` for expensive calculations
- Use `useCallback()` for function props
- Avoid inline function definitions in JSX

## Git Workflow

### Commit Messages
Follow conventional commits:
```
Phase X: Brief description

- Detailed change 1
- Detailed change 2
- Detailed change 3
```

### Branching
- `main` - Production code
- Feature branches for major changes
- All changes go through PR review

## Environment

### Required Variables
```env
NEXT_PUBLIC_API_URL=https://central-hub-api-production.up.railway.app/api
NEXT_PUBLIC_WS_URL=wss://central-hub-api-production.up.railway.app
```

### Development
```bash
npm install
npm run dev
```

### Build
```bash
npm run build
```

## Stats

- **Total Lines Added**: ~8,852 lines
- **Components Created**: 40+
- **API Endpoints Covered**: 120+
- **TypeScript Types**: 40+ interfaces
- **Test Coverage**: Pending (Phase 6)

## Completed Phases

1. ✅ Phase 1: Foundation (API Client, Types, Sidebar)
2. ✅ Phase 2: Dashboard Pages (7 new pages)
3. ✅ Phase 3: Update Existing Pages (Overview, AI Hub)
4. ✅ Phase 4: Shared UI Components (9 components)
5. ⏳ Phase 5: Data Integration & Polish
6. ⏳ Phase 6: Testing & Optimization

## Links

- **Repository**: https://github.com/slothyproject/central-hub-v3
- **Production**: https://central-hub-web-production.up.railway.app
- **API Docs**: https://central-hub-api-production.up.railway.app/api/docs
