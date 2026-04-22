# Central Hub API

Express.js backend API for Central Hub - Railway/Discord/Website management platform.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Set up database:**
   ```bash
   npx prisma generate
   npx prisma migrate dev --name init
   ```

4. **Run development server:**
   ```bash
   npm run dev
   ```

## Database Schema

### User
- id: UUID
- password: Hashed password
- createdAt: DateTime

### Service
- id: UUID
- name: String
- platform: String ('railway', 'discord', 'website')
- externalId: String (ID from external platform)
- status: String
- config: JSON
- url: String
- repositoryUrl: String
- createdAt: DateTime

### Variable
- id: UUID
- serviceId: String
- name: String
- value: String
- isSecret: Boolean
- category: String

### Deployment
- id: UUID
- serviceId: String
- status: String
- url: String
- logs: String
- error: String
- createdAt: DateTime

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with password

### Services
- `GET /api/services` - List all services
- `GET /api/services/:id` - Get service details

### Variables
- `GET /api/services/:id/variables` - Get service variables

### Deployments
- `GET /api/services/:id/deployments` - Get service deployments

## Default Password

The default password is set via `DEFAULT_PASSWORD` environment variable or defaults to:
```
central-hub-2025
```

This is automatically hashed and stored in the database on first startup.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `JWT_SECRET` | Secret for JWT tokens | Required |
| `DEFAULT_PASSWORD` | Initial login password | central-hub-2025 |
| `FRONTEND_URL` | CORS allowed origin | http://localhost:3000 |
| `PORT` | Server port | 3001 |

## Production Deployment

1. Set up PostgreSQL database (Railway, Supabase, etc.)
2. Generate secure JWT_SECRET
3. Change DEFAULT_PASSWORD
4. Deploy to Railway/Vercel/etc.
5. Set environment variables
