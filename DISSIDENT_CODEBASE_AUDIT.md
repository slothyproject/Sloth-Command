# Dissident Bot Codebase - Comprehensive Audit Report

**Audit Date:** April 17, 2026  
**Project:** Dissident - All-in-one Discord Bot for VRChat and Gaming Communities  
**Version:** 2.11.0  
**Total Lines of Code:** ~68,973  
**Test Status:** 925 tests passing

---

## 1. PROJECT STRUCTURE

### Root Directory Overview
```
dissident/
├── .github/           # GitHub Actions workflows and templates
├── alembic/           # Database migration files
├── bot/               # Main Discord bot (Python/discord.py)
├── data/              # SQLite database, backups, bot state
├── db/                # Database schemas and models
├── deploy/            # Deployment configurations
├── docs/              # Documentation (wiki, manual)
├── homepage/          # Astro.js public homepage
├── logs/              # Application logs
├── mobile-app/        # React Native mobile app
├── plugins_sdk/       # Plugin SDK for extensions
├── scripts/           # Utility scripts
├── tests/             # Test suite (925+ tests)
├── web/               # Additional web components
├── web_panel/         # Flask admin dashboard
├── wiki-deploy/       # Deployed wiki HTML files
└── worker/            # Background task workers
```

### Key Files
- `__main__.py` - Bot entry point
- `__init__.py` - Package initialization
- `package.json` - Node.js dependencies (homepage)
- `pyproject.toml` - Python project configuration
- `requirements.txt` - Python dependencies
- `VERSION.json` - Single source of truth for version

---

## 2. CONFIGURATION FILES

### Docker Configuration

**Dockerfile** (Root - Bot Service)
- Base: `python:3.12-slim`
- Installs system deps: gcc, libpq-dev, curl
- Installs Python requirements from both root and bot/
- Runs `/app/bot/start.sh`

**Dockerfile.web** (Multi-stage for Railway)
- Stage 1: Build Astro homepage with Node.js 22
- Stage 2: Build Tailwind CSS for web panel
- Stage 3: Production Flask app with Gunicorn
- Exposes port 8080
- Healthcheck: `curl -f http://localhost:8080/`

**docker-compose.yml** (Development)
```yaml
Services:
  - postgres: PostgreSQL 16-alpine
  - redis: Redis 7-alpine (256mb maxmemory)
  - bot: Main Discord bot
  - worker: Background task processor
```

**docker-compose.prod.yml** - Production stack configuration

### Railway Configuration

**railway.toml**
```toml
[build]
builder = "dockerfile"
dockerfilePath = "Dockerfile.web"

[deploy]
numReplicas = 1
startCommand = "gunicorn --bind 0.0.0.0:8080 --workers 2 --worker-class gevent --timeout 120 web_panel.app:app"
healthcheckPath = "/health"
healthcheckTimeout = 30
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10

[env]
PORT = "8080"
FLASK_ENV = "production"
ENABLE_SOCKETIO = "true"
```

### GitHub Actions Workflows

Located in `.github/workflows/`:

| Workflow | Purpose | Trigger |
|----------|---------|---------|
| `deploy.yml` | Deploy to Railway | push to main/master |
| `railway-deploy.yml` | Deploy Bot service | push to main/master |
| `deploy-dashboard.yml` | Deploy Dashboard | push to main/master |
| `ci.yml` | Run smoke tests | push/PR to main |
| `test.yml` | Run full test suite | workflow_dispatch |
| `docker.yml` | Build Docker images | push to main |
| `health-check.yml` | Service health monitoring | schedule |
| `backup.yml` | Database backups | schedule |
| `pr-check.yml` | PR validation | pull_request |
| `sync-env.yml` | Environment sync | workflow_dispatch |
| `automated-setup.yml` | Automated project setup | workflow_dispatch |

### Environment Files

**`.env.example`** - Template for local development:
```bash
DISSIDENT_TOKEN=your_bot_token_here
GITHUB_TOKEN=your_github_token_here
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret
ADMIN_USER=admin
ADMIN_PASS=your_secure_password
SECRET_KEY=your-random-secret-key
```

**`.env.railway`** - Railway-specific variables:
```bash
DATABASE_HOST=your_postgres_host.railway.app
DATABASE_PORT=5432
DATABASE_USER=dissident
DATABASE_PASSWORD=ChooseA SecurePassword123!
REDIS_HOST=your_redis_host.railway.app
REDIS_PORT=6379
SECRET_KEY=generate_a_random_secret_key_here_32_chars
OLLAMA_BASE_URL=https://your-ollama-service.railway.app
```

---

## 3. API ENDPOINTS

### Web Panel API Routes (web_panel/app.py)

#### Authentication
```
POST   /api/login              - Login with credentials
POST   /api/logout             - Logout user
GET    /api/me                 - Get current user info
GET    /login                  - Login page
GET    /admin-login            - Admin login page
GET    /register               - Server registration page
```

#### Dashboard & Core
```
GET    /                       - Homepage or redirect to dashboard
GET    /homepage               - Static Astro homepage
GET    /homepage/<path>        - Homepage assets
GET    /dashboard              - Main dashboard (protected)
GET    /api/ping               - Health ping
GET    /api/health             - Detailed health check
GET    /api/debug              - Debug info (debug mode only)
GET    /api/debug/logs         - Recent logs (debug mode only)
```

#### Bot Data
```
GET    /api/stats              - Bot statistics
GET    /api/servers            - List all servers
GET    /api/servers/<id>       - Get specific server
POST   /api/servers            - Add new server (admin)
POST   /api/servers/invite     - Generate invite code
DELETE /api/servers/<id>       - Delete server (admin)
GET    /api/commands           - List all commands
GET    /api/guilds             - Get guilds from stats
GET    /api/activity           - Recent activity
```

#### Charts & Analytics
```
GET    /api/charts             - Chart data for dashboard
GET    /api/charts/activity    - Activity chart data (blueprint)
GET    /api/charts/commands    - Command usage charts (blueprint)
GET    /api/analytics          - Analytics overview
```

#### Feature Pages
```
GET    /activity               - Activity page
GET    /moderation             - Moderation dashboard
GET    /api/moderation         - Get moderation cases
POST   /api/moderation/<action> - Execute moderation action

GET    /economy                - Economy dashboard
GET    /api/economy            - Economy stats
POST   /api/economy/<action>   - Economy actions (award/take/reset)

GET    /tickets                - Tickets page
GET    /api/tickets            - List tickets
POST   /api/ticket/<id>/<action> - Ticket actions

GET    /users                  - Users management
GET    /database               - Database browser
GET    /api/database/stats     - DB statistics
GET    /api/database/tables    - List tables
GET    /api/database/table/<name> - Table data

GET    /commands               - Commands page
POST   /api/commands/execute   - Execute command

GET    /notifications          - Notifications page
GET    /api/notifications      - Get notifications
POST   /api/notifications      - Create notification
DELETE /api/notifications/<id> - Delete notification

GET    /scheduled              - Scheduled tasks
GET    /api/scheduled          - List scheduled tasks
POST   /api/scheduled          - Create task
PATCH  /api/scheduled/<id>     - Update task
DELETE /api/scheduled/<id>     - Delete task
POST   /api/scheduled/<id>/run - Run task
POST   /api/scheduled/run-all  - Run all tasks

GET    /webhooks               - Webhooks page
GET    /api/webhooks           - List webhooks
POST   /api/webhooks           - Create webhook
PATCH  /api/webhooks/<id>      - Update webhook
DELETE /api/webhooks/<id>      - Delete webhook
POST   /api/webhooks/<id>/test - Test webhook

GET    /plugins                - Plugins page
GET    /api/plugins            - List plugins
POST   /api/plugin/<name>/<action> - Plugin actions

GET    /backups                - Backups page
GET    /api/backup/list        - List backups
POST   /api/backup             - Create backup

GET    /analytics              - Analytics page
GET    /logs                   - Logs page
GET    /api/logs               - Get logs

GET    /health                 - Health monitoring
GET    /settings               - Settings page

GET    /servers                - Multi-server view
GET    /servers/<id>           - Server-specific dashboard

GET    /premium                - Premium plugins
GET    /api/premium/plugins    - List premium plugins
GET    /api/premium/plugin/<id> - Get plugin details
POST   /api/premium/purchase   - Purchase plugin
GET    /api/premium/licenses   - Get user licenses
POST   /api/premium/validate   - Validate license key

GET    /themes                 - Themes page
GET    /api/themes             - List themes
GET    /api/themes/<id>        - Get theme
POST   /api/themes             - Create custom theme

GET    /marketplace            - Plugin marketplace
GET    /api/marketplace/plugins - List marketplace plugins
GET    /api/marketplace/plugin/<id> - Get plugin details
POST   /api/marketplace/install - Install plugin
POST   /api/marketplace/uninstall - Uninstall plugin

GET    /reviews                - Reviews page
GET    /api/reviews/plugin/<id> - Get plugin reviews
GET    /api/reviews/plugin/<id>/stats - Review stats
POST   /api/reviews            - Create review
POST   /api/reviews/<id>/helpful - Mark helpful
```

#### Admin Actions
```
POST   /api/actions/<action>   - Admin actions (sync_commands, reload_cogs, clear_cache, backup, restart)
POST   /api/error-report       - Client error reporting
```

#### Public API (No Auth Required)
```
GET    /api/public/stats       - Public stats for homepage
GET    /api/public/activity    - Public activity data
```

#### Uptime Monitoring
```
GET    /api/uptime             - Service uptime status
GET    /api/uptime/<service>   - Specific service status
```

#### Error Tracking
```
GET    /api/errors             - Get errors from Sentry/local
POST   /api/errors/submit      - Submit error report
GET    /api/bug-reports        - List bug reports
PUT    /api/bug-reports/<id>   - Update bug report
DELETE /api/bug-reports/<id>   - Delete bug report
```

#### Server Registration
```
POST   /api/register/validate  - Validate registration code
POST   /api/register/servers   - Get Discord servers
POST   /api/register/complete  - Complete registration
```

### Dashboard API Blueprint (web_panel/dashboard_api.py)

Additional routes under `/api/*`:
```
POST   /api/auth/login         - Blueprint auth login
POST   /api/auth/logout        - Blueprint auth logout
GET    /api/auth/me            - Get current user
GET    /api/stats              - Bot statistics
GET    /api/servers            - Server list
GET    /api/commands           - Command list
GET    /api/plugins            - Plugin list
GET    /api/dashboard/state    - Dashboard state
POST   /api/dashboard/theme    - Set theme
GET    /api/users              - List users (admin)
POST   /api/users              - Create user
PUT    /api/users/<id>         - Update user
DELETE /api/users/<id>         - Delete user
POST   /api/users/<id>/password - Change password
GET    /api/users/<id>/audit   - User audit log
GET    /api/activity           - Activity feed
GET    /api/charts/activity    - Activity chart data
GET    /api/charts/commands    - Command usage charts
GET    /api/uptime             - Uptime status
GET    /api/uptime/<service>   - Service uptime
GET    /api/analytics          - Analytics data
GET    /api/public/stats       - Public stats
GET    /api/public/activity    - Public activity
GET    /api/errors             - Error list
POST   /api/errors/submit      - Submit error
GET    /api/bug-reports        - Bug reports
PUT    /api/bug-reports/<id>   - Update bug report
DELETE /api/bug-reports/<id>   - Delete bug report
```

### Bot API Server (bot/api/server.py)

Internal API for bot stats (not exposed as HTTP routes):
- `get_stats()` - Real-time bot statistics
- `get_commands()` - All registered commands
- `get_cogs()` - Loaded cogs info
- `get_guilds()` - Guild information

---

## 4. FRONTEND PAGES

### Web Panel Templates (web_panel/templates/)

**Base Templates:**
- `base.html` - Main dashboard layout
- `auth_base.html` - Authentication pages layout

**Authentication Pages:**
- `login.html` - User login
- `admin_login.html` - Admin login
- `register.html` - Server registration

**Dashboard Pages:**
- `dashboard.html` - Main dashboard with stats
- `activity.html` - Activity feed
- `analytics.html` - Analytics and charts
- `servers.html` - Server list/management
- `servers/dashboard.html` - Individual server dashboard

**Feature Pages:**
- `moderation.html` - Moderation tools
- `economy.html` - Economy management
- `tickets.html` - Ticket system
- `users.html` - User management
- `commands.html` - Command center
- `notifications.html` - Notifications
- `scheduled.html` - Scheduled tasks
- `webhooks.html` - Webhook management
- `plugins.html` - Plugin management
- `marketplace.html` - Plugin marketplace
- `premium.html` - Premium plugins
- `backups.html` - Backup management
- `database.html` - Database browser
- `logs.html` - System logs
- `health.html` - Health monitoring
- `settings.html` - System settings
- `themes.html` - Theme management
- `reviews.html` - Plugin reviews

**Error Pages:**
- `404.html` - Not found
- `error.html` - Generic error

**Components:**
- `components/sidebar.html` - Navigation sidebar
- `components/navbar.html` - Top navigation
- `components/stats_card.html` - Stat display cards
- `components/data_table.html` - Data tables
- `components/toast.html` - Toast notifications

### Static Homepage (web_panel/static/homepage/)

Built from `homepage/` Astro.js project:
- `index.html` - Public landing page
- Assets served from `homepage/<path>`

### Wiki Deploy (wiki-deploy/)

HTML versions of documentation:
- `index.html` - Wiki home
- `Home.html` - Main documentation
- `AI-Wizard.html` - AI features
- `Architecture.html` - System design
- `Contributing.html` - Developer guide
- `Implementation-Status.html` - Current status
- `Sync-System.html` - Sync documentation
- `Troubleshooting.html` - Common issues

---

## 5. DATABASE SCHEMA

### PostgreSQL Tables (db/schema.sql)

**Core Tables:**
1. `users` - Web panel users
   - id, username, hashed_password, is_admin, is_active, created_at, updated_at, last_login

2. `guilds` - Tracked Discord servers
   - id, discord_id, name, owner_id, settings (JSONB), is_active, joined_at, last_sync

**Moderation:**
3. `moderation_cases` - Moderation actions
   - id, case_number, case_type, guild_id, user_id, moderator_id, moderator_name, reason, is_appealed, is_active, created_at, expires_at

4. `verification_sessions` - Captcha verification
   - id, user_id, guild_id, code, attempts, verified, verified_at, failed_at, created_at, expires_at

**Tickets:**
5. `tickets` - Support tickets
   - id, ticket_number, guild_id, channel_id, user_id, user_name, subject, status, priority, assigned_to, created_at, updated_at, resolved_at, closed_at

6. `ticket_messages` - Ticket messages
   - id, ticket_id, author_id, author_name, is_bot, content, created_at

**Events & Tasks:**
7. `events` - Server events
   - id, guild_id, discord_event_id, name, description, start_time, end_time, location, organizer_id, organizer_name, created_at, updated_at

8. `scheduled_tasks` - APScheduler tasks
   - id, task_id, name, task_type, target_id, scheduled_at, executed, executed_at, result, created_at

**Audit & Logging:**
9. `audit_logs` - Comprehensive audit log
   - id, action, actor_id, actor_name, target_type, target_id, target_name, details (JSONB), ip_address, created_at

### SQLAlchemy Models (bot/db/models.py)

**Extended Models (64+ tables):**

**Leveling/XP:**
- `GuildXPConfig` - XP configuration per guild
- `MemberXP` - Per-member XP and level
- `LevelUpReward` - Role rewards for levels
- `RoleReward` - Achievement-based role rewards
- `RoleRewardProgress` - Progress tracking

**Engagement:**
- `GuildWelcomeConfig` - Welcome/goodbye messages
- `GuildStarboardConfig` - Starboard configuration
- `StarboardEntry` - Starred messages
- `GuildEvent` - Server events
- `EventParticipant` - Event RSVPs
- `Report` - User reports
- `SelfRoleReaction` - Self-assignable roles

**Verification:**
- `VerificationAttempt` - Rate limiting for verification
- `VerificationSession` - Captcha sessions
- `GuildVerificationConfig` - Verification settings
- `CaptchaSession` - Active captcha challenges

**Tickets:**
- `Ticket` - Support tickets
- `TicketMessage` - Messages within tickets
- `TicketCategory` - Ticket categories
- `TicketNote` - Staff notes on tickets
- `TicketSLA` - SLA deadline tracking
- `TicketPanel` - Ticket panel messages

**Setup & Sync:**
- `SetupRun` - Setup wizard runs
- `Snapshot` - Guild state snapshots
- `SyncRun` - Sync reconciliation runs
- `GuildResource` - Bot-created resources
- `GuildResourceMapping` - ID mappings
- `RoleLegacyMapping` - Role ID migrations

**Security:**
- `AntiNukeSettings` - Anti-raid configuration
- `AntiNukeWhitelist` - Whitelisted users/roles
- `AntiNukeAction` - Logged anti-nuke actions
- `AntiNukeAppeal` - Unban appeals

**Staff Management:**
- `GuildStaffRole` - Discord role to staff level mapping
- `ModerationCase` - Moderation actions (detailed)

**Analytics:**
- `ServerAnalytics` - Daily server stats
- `CommandAnalytics` - Command usage stats
- `MemberActivity` - Member activity tracking
- `MessageEvent` - Individual message events
- `MemberEvent` - Join/leave events

**AutoMod:**
- `AutoModConfig` - Rule configuration
- `AutoModViolation` - Violation log

**Other:**
- `AuditLog` - Comprehensive audit trail
- `EventReminder` - Event reminders
- `Custom Commands` - User-defined commands
- `Birthdays` - Birthday tracking
- `Giveaways` - Giveaway management
- `Economy` - Currency, inventory
- `Leveling` - XP and ranks
- `Polls` - Poll data
- `Reminders` - User reminders
- `Suggestions` - Server suggestions
- `Temporary Voice` - Temp voice channels
- `Tournaments` - Tournament data
- `VRChat` - VRChat integration data

---

## 6. ENVIRONMENT VARIABLES

### Required Variables

**Discord Bot:**
```bash
DISSIDENT_TOKEN              # Discord bot token (REQUIRED)
DISSIDENT_COMMAND_PREFIX     # Command prefix (default: !)
DISSIDENT_OWNER_IDS          # Comma-separated owner IDs
```

**Database:**
```bash
DATABASE_HOST                # PostgreSQL host
DATABASE_PORT                # PostgreSQL port (default: 5432)
DATABASE_USER                # PostgreSQL user
DATABASE_PASSWORD            # PostgreSQL password (REQUIRED)
DATABASE_NAME                # PostgreSQL database name
# OR Railway provides DATABASE_URL
```

**Redis:**
```bash
REDIS_HOST                   # Redis host
REDIS_PORT                   # Redis port (default: 6379)
REDIS_PASSWORD               # Redis password (if any)
# OR Railway provides REDIS_URL
```

**Web Panel:**
```bash
SECRET_KEY                   # Flask secret key (REQUIRED for sessions)
ADMIN_USER                   # Admin username (default: admin)
ADMIN_PASS                   # Admin password (REQUIRED)
FLASK_DEBUG                  # Debug mode (default: false)
PORT                         # Web server port (default: 8080)
CSRF_SECRET                  # CSRF protection key
```

**Discord OAuth:**
```bash
DISCORD_CLIENT_ID            # OAuth app ID
DISCORD_CLIENT_SECRET        # OAuth app secret
```

### Optional Variables

**AI/LLM:**
```bash
OLLAMA_BASE_URL              # Ollama API URL
OLLAMA_MODEL                 # Model name (default: llama2:latest)
OPENAI_API_KEY               # OpenAI API key
```

**Monitoring:**
```bash
SENTRY_DSN                   # Sentry error tracking DSN
UPTIMEROBOT_API_KEY          # UptimeRobot API key
DISCORD_WEBHOOK              # Webhook for notifications
```

**Railway-Specific:**
```bash
RAILWAY_TOKEN                # Railway CLI token
RAILWAY_PROJECT_ID           # Project ID (4e4e0f03-0c70-443a-ab59-757c492a8142)
RAILWAY_DASHBOARD_URL        # Dashboard service URL
RAILWAY_BOT_URL              # Bot service URL
RAILWAY_STATIC_URL           # Static hosting URL
```

**Feature Toggles:**
```bash
ENABLE_SOCKETIO              # Enable Socket.IO (default: true)
DISSIDENT_RUN_MIGRATIONS     # Run DB migrations on startup (default: true)
DISSIDENT_LOG_LEVEL          # Log level (DEBUG, INFO, WARNING, ERROR)
```

**Worker Settings:**
```bash
WORKER_PROCESSES             # Worker process count (default: 2)
```

---

## 7. DEPLOYMENT ISSUES

### Current Deployment Configuration

**Railway Project:** `4e4e0f03-0c70-443a-ab59-757c492a8142`

**Services:**
| Service | Type | URL | Status |
|---------|------|-----|--------|
| Dashboard | Web | dashboard-production-26dc.up.railway.app | Needs verification |
| Bot | Worker | railway-bot-production-4542.up.railway.app | Needs verification |
| PostgreSQL | Database | Internal | Needs verification |
| Redis | Cache | Internal | Needs verification |

### Identified Issues

1. **Multiple Documentation Files** - 27+ markdown files in root, indicating:
   - Complex deployment history
   - Multiple setup attempts
   - Scattered troubleshooting info

2. **Environment Variable Confusion** - Multiple env files:
   - `.env` - Current local config
   - `.env.example` - Template
   - `.env.railway` - Railway template
   - `railway-variables.txt` - Variable list
   - `railway-variables-template.txt` - Template
   - `dashboard-env.txt` - Dashboard specific

3. **Dockerfile Complexity** - Multiple Dockerfiles:
   - `Dockerfile` - Bot service
   - `Dockerfile.web` - Web dashboard (multi-stage)
   - `web_panel/Dockerfile` - Alternative web Dockerfile
   - `bot/Dockerfile` - Bot-specific
   - `deploy/Dockerfile` - Deployment-specific
   - `railway.Dockerfile` - Railway-specific

4. **GitHub Actions Workflows** - 15+ workflows, potential redundancy:
   - Multiple deployment workflows (`deploy.yml`, `railway-deploy.yml`, `deploy-dashboard.yml`)
   - May cause conflicts or duplicate deployments

5. **Bot State File Dependency** - Web panel relies on `data/bot_state.json`:
   - Dashboard shows "Bot is offline" if file missing
   - File shared between bot and web panel
   - May not work correctly in Railway multi-service setup

6. **Railway Configuration** - `railway.toml` configured for single service:
   - Only deploys web dashboard
   - Bot service needs separate configuration
   - May need `railway.json` or separate services

7. **Database Migrations** - Alembic setup present but:
   - Migration status unknown
   - May need manual intervention for Railway PostgreSQL

8. **Redis Configuration** - Socket.IO attempts Redis connection:
   - Falls back to memory if Redis unavailable
   - May affect real-time features in multi-worker setup

### Recommended Fixes

1. **Consolidate Documentation** - Merge setup guides into single file
2. **Clean Up Dockerfiles** - Remove redundant Dockerfiles, use `Dockerfile.web`
3. **Simplify Workflows** - Consolidate deployment workflows
4. **Fix Bot State Sharing** - Use Redis or database for bot-web communication
5. **Verify Railway Services** - Ensure all 4 services are properly configured
6. **Test End-to-End** - Verify bot commands, web panel, and database connectivity
7. **Environment Audit** - Document all required vs optional variables
8. **Add Health Checks** - Implement proper `/health` endpoint checks

### Deployment Checklist

- [ ] Railway project has 4 services configured
- [ ] PostgreSQL database is created and accessible
- [ ] Redis cache is created and accessible
- [ ] `DISSIDENT_TOKEN` is set in bot service
- [ ] `SECRET_KEY` and `ADMIN_PASS` are set in dashboard service
- [ ] Database migrations have run successfully
- [ ] Bot shows as "online" in dashboard
- [ ] Web panel login works
- [ ] Discord bot responds to commands
- [ ] Real-time features (Socket.IO) work
- [ ] Health check endpoints return 200

---

## 8. ADDITIONAL FINDINGS

### Cogs Loaded: 71
The bot has 71 cog modules including:
- AI Advisor/Wizard (natural language setup)
- Moderation (warn, mute, kick, ban, purge)
- Economy & Gambling
- Tickets & Support
- Verification & Captcha
- AutoMod & AntiNuke
- Leveling & XP
- Giveaways & Events
- Music & Voice
- And 50+ more features

### Tech Stack
- **Backend:** Python 3.12, discord.py 2.5+, Flask, SQLAlchemy, FastAPI
- **Frontend:** Astro.js (homepage), Tailwind CSS, Vanilla JS (panel)
- **Database:** PostgreSQL (production), SQLite (development)
- **Cache:** Redis
- **AI:** Ollama/LiteLLM integration
- **Deployment:** Docker, Railway, GitHub Actions
- **Monitoring:** Sentry, UptimeRobot

### Security Features
- CSRF protection
- Rate limiting (Flask-Limiter)
- Secure session cookies
- Password hashing (Werkzeug)
- Discord OAuth integration
- Anti-nuke/raid protection
- Permission system (RBAC)

### Testing
- 925+ tests passing
- Smoke tests in CI
- Full test suite on demand
- pytest with async support

---

## SUMMARY

The Dissident Bot codebase is a comprehensive, feature-rich Discord bot platform with:
- **71 cogs** providing extensive functionality
- **Modern web dashboard** with real-time features
- **Professional deployment** setup for Railway
- **Comprehensive database** schema (64+ tables)
- **Production-ready** infrastructure with Docker
- **925+ passing tests**

**Current Status:** The deployment appears configured but needs verification. The main issues are scattered documentation, multiple redundant files, and potential service communication issues between bot and dashboard in Railway's environment.

**Next Steps:**
1. Verify Railway service configuration
2. Run database migrations
3. Test bot and dashboard connectivity
4. Consolidate documentation
5. Clean up redundant files
