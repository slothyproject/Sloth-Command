# Central Hub 3.0

Enterprise-grade Railway management platform with AI-powered automation.

## 🚀 Features

### Core Features
- **Service Management** - Manage Railway services with full CRUD operations
- **Variable Editor** - Environment variable management with categories and bulk operations
- **Real-time Monitoring** - Live deployment tracking and health monitoring
- **AI Central Hub** - Intelligent insights, predictions, and recommendations
- **Analytics Dashboard** - Comprehensive metrics, costs, and performance tracking

### AI-Powered Features
- **Pattern Recognition** - Detect correlations and anomalies in service metrics
- **Predictive Analytics** - Forecast CPU usage, memory, and costs
- **Smart Recommendations** - Auto-fix issues and optimize performance
- **Natural Language Interface** - Command your services with plain English

### Advanced Features
- **Global Command Palette** (⌘K) - Quick search and navigation
- **Keyboard Shortcuts** - Vim-like shortcuts for power users
- **PWA Support** - Install as app with offline capabilities
- **Dark/Light Mode** - Automatic theme switching
- **Responsive Design** - Works on desktop, tablet, and mobile

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript (Strict) |
| **Styling** | Tailwind CSS + Custom Glassmorphism |
| **State** | Zustand + TanStack Query |
| **Charts** | Recharts |
| **UI Components** | shadcn/ui |
| **Backend** | Express.js + PostgreSQL |
| **AI** | Ollama Cloud Integration |

## 📦 Installation

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- Railway API token

### Quick Start

```bash
# Clone the repository
git clone https://github.com/slothyproject/central-hub-v3.git
cd central-hub-v3

# Install dependencies
cd apps/web
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Run development server
npm run dev
```

### Environment Variables

```env
# API
NEXT_PUBLIC_API_URL=http://localhost:3001/api

# Optional
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

## 🏗️ Project Structure

```
apps/web/
├── app/
│   ├── components/
│   │   ├── layout/         # Sidebar, TopNav, CommandPalette
│   │   ├── providers/      # Theme, Query providers
│   │   ├── ui/            # Reusable UI components
│   │   └── error-boundary.tsx
│   ├── dashboard/
│   │   ├── ai-hub/        # AI Central Hub
│   │   ├── analytics/      # Analytics dashboard
│   │   ├── services/       # Service management
│   │   └── settings/        # User settings
│   ├── hooks/              # TanStack Query hooks
│   ├── lib/                # Utilities, API client
│   ├── stores/             # Zustand stores
│   ├── login/              # Login page
│   ├── layout.tsx          # Root layout
│   └── globals.css         # Global styles
├── public/                 # Static assets
└── package.json

packages/shared-types/      # TypeScript definitions
```

## 🎯 Usage Guide

### Managing Services

1. **View Services** - Go to `/dashboard/services`
   - Grid view for visual overview
   - List view for detailed information
   - Filter by status, search by name

2. **Service Details** - Click any service card
   - Overview tab: Status, URLs, deployment info
   - Variables tab: Environment variables with categories
   - Deployments tab: Deployment history
   - Logs tab: Real-time logs

3. **Actions**
   - Deploy: Redeploy service to Railway
   - Restart: Restart service containers
   - Bulk Actions: Select multiple services for batch operations

### AI Features

1. **Overview** - Health scores and insights
   - Service health distribution
   - AI insights by severity
   - Recent activity

2. **Intelligence** - Pattern detection
   - Service correlation charts
   - Anomaly detection alerts
   - Performance baselines

3. **Recommendations** - Optimization suggestions
   - Cost savings opportunities
   - Performance improvements
   - Security updates

4. **Predictions** - Forecasting
   - CPU/Memory predictions
   - Cost projections
   - Confidence scores

5. **Command** - Natural language
   - Type commands like "deploy all services"
   - Get AI-powered responses
   - Quick action buttons

### Analytics

- **Traffic Overview** - Request volume and error rates
- **Cost Breakdown** - Spending by service
- **Response Times** - P50, P95, P99 percentiles
- **Time Range** - View last 24h, 7d, 30d, or 90d

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘ K` | Open Command Palette |
| `⌘ /` | Toggle Help |
| `⌘ B` | Toggle Sidebar |
| `⌘ T` | Toggle Theme |
| `ESC` | Close Modal |
| `⌘ S` | Save Changes |
| `⌘ D` | Deploy Service |
| `⌘ R` | Restart Service |

## 🎨 Design System

### Colors
- **Background**: Slate 900 (`#0f172a`)
- **Surface**: Slate 800 (`#1e293b`)
- **Primary**: Cyan 500 (`#06b6d4`)
- **Secondary**: Violet 500 (`#8b5cf6`)
- **Accent**: Gradient from Cyan to Violet

### Components
- **Glass Cards** - `glass-card` class with backdrop blur
- **Buttons** - Primary, secondary, ghost variants
- **Inputs** - Glassmorphism inputs with focus rings
- **Badges** - Status indicators with severity colors

### Typography
- **Font**: Inter (system fallback)
- **Headings**: Bold, tight letter-spacing
- **Body**: Normal weight, relaxed line-height

## 🔧 Development

### Running Tests

```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# Linting
npm run lint

# Type checking
npm run type-check
```

### Building for Production

```bash
# Build application
npm run build

# Start production server
npm start
```

### Code Quality

- **ESLint** - Linting with Next.js config
- **Prettier** - Code formatting
- **TypeScript** - Strict mode enabled
- **Husky** - Pre-commit hooks

## 📊 Performance

### Optimizations
- ✅ Code splitting with Next.js
- ✅ Image optimization
- ✅ Font optimization
- ✅ Lazy loading for charts
- ✅ Skeleton screens for loading states

### Metrics
- **Lighthouse Score**: 90+
- **First Contentful Paint**: < 1.5s
- **Time to Interactive**: < 3s
- **Bundle Size**: < 500KB initial

## 🚢 Deployment

### Vercel (Recommended)

1. Connect GitHub repository to Vercel
2. Configure environment variables
3. Deploy!

### Railway

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and deploy
railway login
railway link
railway up
```

### Docker

```bash
# Build image
docker build -t central-hub .

# Run container
docker run -p 3000:3000 --env-file .env central-hub
```

## 📝 API Documentation

### Authentication
- **Login**: `POST /api/auth/login`
- **Refresh**: `POST /api/auth/refresh`
- **Logout**: `POST /api/auth/logout`

### Services
- **List**: `GET /api/services`
- **Get**: `GET /api/services/:id`
- **Create**: `POST /api/services`
- **Update**: `PATCH /api/services/:id`
- **Delete**: `DELETE /api/services/:id`
- **Sync**: `POST /api/services/sync`
- **Deploy**: `POST /api/services/:id/deploy`
- **Restart**: `POST /api/services/:id/restart`

### Variables
- **List**: `GET /api/services/:id/variables`
- **Create**: `POST /api/services/:id/variables`
- **Update**: `PATCH /api/services/:id/variables/:varId`
- **Delete**: `DELETE /api/services/:id/variables/:varId`

### AI
- **Analyze**: `GET /api/ai/analyze/:serviceId`
- **Predict**: `GET /api/ai/predict/:serviceId`
- **Chat**: `POST /api/ai/chat`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Commit Convention

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `style:` Formatting
- `refactor:` Code restructuring
- `test:` Tests
- `chore:` Maintenance

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)
- Charts by [Recharts](https://recharts.org/)
- Icons from [Lucide](https://lucide.dev/)

## 📞 Support

- **Email**: support@centralhub.io
- **Discord**: [Join our server](https://discord.gg/centralhub)
- **Docs**: https://docs.centralhub.io

---

**Central Hub v3.0** - Enterprise Railway Management Platform

Built with ❤️ by the Central Hub Team
