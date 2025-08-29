# MadPlan Development Setup Guide

Complete step-by-step guide to set up the MadPlan development environment.

## Prerequisites

- **Node.js** 18+ and **npm** 8+
- **Git** for version control
- **Docker** and **Docker Compose** (optional, for local database)
- **MongoDB Atlas** account (or local MongoDB installation)
- **Visual Studio Code** (recommended IDE)

## Quick Start

```bash
# 1. Clone repositories
https://github.com/zhangjinglearning/grr-agents.git

# 2. Set up backend
cd madplan-backend
npm install
cp .env.template .env
# Edit .env with your configurations
npm run start:dev

# 3. Set up frontend (new terminal)
cd ../madplan-frontend
npm install
cp .env.local.template .env.local
# Edit .env.local with backend URL
npm run dev

# 4. Open http://localhost:5173 in your browser
```

## Detailed Setup Instructions

### 1. Environment Configuration

#### Backend Environment (.env)

Copy `.env.template` to `.env` and configure:

```bash
# Copy template
cp .env.template .env

# Edit with your favorite editor
nano .env  # or code .env for VS Code
```

**Required configurations:**
- `MONGODB_URI`: Your MongoDB connection string
- `JWT_SECRET`: Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `PORT`: Backend port (default: 3000)
- `CORS_ORIGINS`: Frontend URL (default: http://localhost:5173)

#### Frontend Environment (.env.local)

Copy `.env.local.template` to `.env.local`:

```bash
# Copy template
cp .env.local.template .env.local

# Configure backend endpoint
VITE_GRAPHQL_ENDPOINT=http://localhost:3000/graphql
VITE_API_BASE_URL=http://localhost:3000/api
```

### 2. Database Setup Options

#### Option A: MongoDB Atlas (Cloud)

1. Create account at https://mongodb.com/atlas
2. Create M0 cluster (free tier)
3. Get connection string
4. Update `MONGODB_URI` in `.env`

#### Option B: Local MongoDB with Docker

```bash
# Start MongoDB and admin interface
docker-compose up -d

# View logs
docker-compose logs -f mongodb

# Access admin interface at http://localhost:8081
# Credentials: admin / admin123
```

#### Option C: Local MongoDB Installation

Install MongoDB locally and update connection string:
```
MONGODB_URI=mongodb://localhost:27017/madplan-dev
```

### 3. Development Servers

#### Start Backend Server

```bash
cd madplan-backend

# Development mode (auto-restart on changes)
npm run start:dev

# Debug mode (with debugger)
npm run start:debug

# Production build test
npm run build && npm run start:prod
```

Backend will be available at: http://localhost:3000
- GraphQL Playground: http://localhost:3000/graphql
- Health check: http://localhost:3000/api/health

#### Start Frontend Server

```bash
cd madplan-frontend

# Development mode (hot reload)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

Frontend will be available at: http://localhost:5173

### 4. Development Tools

#### VS Code Configuration

Install recommended extensions:
- Vue Language Features (Volar)
- TypeScript Vue Plugin (Volar)
- ESLint
- Prettier
- Tailwind CSS IntelliSense
- Apollo GraphQL

#### Database Administration

**MongoDB Compass** (recommended):
- Download from https://mongodb.com/compass
- Connect using your MongoDB URI

**Docker MongoDB Express** (if using Docker):
- Available at http://localhost:8081
- Username: admin, Password: admin123

#### GraphQL Development

- **GraphQL Playground**: http://localhost:3000/graphql (development only)
- **Apollo Studio**: Connect with your GraphQL endpoint

### 5. Seeding Development Data

```bash
# Seed sample data for development
cd madplan-backend
node scripts/seed-development-data.js

# Or use npm script (if added to package.json)
npm run seed:dev
```

This creates:
- 3 sample users
- 3 sample boards with different themes
- Multiple lists and cards with realistic data

### 6. Testing Setup

#### Backend Testing

```bash
cd madplan-backend

# Run all tests
npm test

# Watch mode (re-run on changes)
npm run test:watch

# Coverage report
npm run test:cov

# Debug tests
npm run test:debug
```

#### Frontend Testing

```bash
cd madplan-frontend

# Run all tests
npm test

# Watch mode
npm run test:watch

# UI test runner
npm run test:ui

# Coverage report
npm run test:coverage
```

### 7. Code Quality

#### Backend

```bash
# Lint TypeScript files
npm run lint

# Format with Prettier
npm run format

# Type checking
npx tsc --noEmit
```

#### Frontend

```bash
# Lint Vue and TypeScript files
npm run lint

# Format with Prettier
npm run format

# Type checking
npm run type-check
```

## Development Workflow

### Daily Development Routine

1. **Pull latest changes**
   ```bash
   git pull origin main
   ```

2. **Update dependencies** (if package.json changed)
   ```bash
   npm install
   ```

3. **Start development servers**
   ```bash
   # Terminal 1: Backend
   cd madplan-backend && npm run start:dev
   
   # Terminal 2: Frontend  
   cd madplan-frontend && npm run dev
   ```

4. **Optional: Start database** (if using Docker)
   ```bash
   docker-compose up -d
   ```

### Code Changes Workflow

1. **Create feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make changes** with hot reload active

3. **Test your changes**
   ```bash
   npm test
   npm run lint
   ```

4. **Commit and push**
   ```bash
   git add .
   git commit -m "feat: your feature description"
   git push origin feature/your-feature-name
   ```

5. **Create pull request** on GitHub

### Database Workflow

- **Reset development data**: Re-run seeding script
- **View data**: Use MongoDB Compass or admin interface
- **Backup data**: `mongodump` command or Atlas backup
- **Schema changes**: Update initialization scripts

## Port Configuration

| Service | Default Port | Environment Variable | Notes |
|---------|-------------|---------------------|-------|
| Backend (NestJS) | 3000 | `PORT` | GraphQL + REST API |
| Frontend (Vue/Vite) | 5173 | `VITE_DEV_PORT` | Development server |
| MongoDB | 27017 | - | Database connection |
| Mongo Express | 8081 | - | Admin interface |
| Redis | 6379 | - | Optional caching |

### Resolving Port Conflicts

If ports are in use:

1. **Change backend port**:
   ```bash
   # In .env
   PORT=3001
   ```

2. **Change frontend port**:
   ```bash
   # In .env.local
   VITE_DEV_PORT=5174
   
   # Or start with custom port
   npm run dev -- --port 5174
   ```

3. **Update CORS settings** in backend `.env`:
   ```bash
   CORS_ORIGINS=http://localhost:5174
   ```

## Environment Variables Reference

### Backend (.env)

```bash
# Database
MONGODB_URI=your-mongodb-connection-string
MONGODB_DATABASE_NAME=madplan-dev

# Server
NODE_ENV=development
PORT=3000
HOST=localhost

# Authentication
JWT_SECRET=your-32-character-secret
JWT_EXPIRES_IN=7d

# CORS
CORS_ORIGINS=http://localhost:5173
CORS_CREDENTIALS=true

# GraphQL
GRAPHQL_PLAYGROUND=true
GRAPHQL_INTROSPECTION=true

# Development
DEBUG_ENABLED=true
LOG_LEVEL=debug
```

### Frontend (.env.local)

```bash
# API Configuration
VITE_GRAPHQL_ENDPOINT=http://localhost:3000/graphql
VITE_API_BASE_URL=http://localhost:3000/api

# App Configuration
VITE_NODE_ENV=development
VITE_APP_NAME=MadPlan
VITE_DEBUG_MODE=true

# Development
VITE_DEV_PORT=5173
VITE_DEV_HOST=localhost
VITE_HMR_ENABLED=true
```

## Next Steps

1. **Explore the codebase**: Start with `src/main.ts` files
2. **Run tests**: Ensure everything works
3. **Make a small change**: Test the hot reload
4. **Read the API docs**: GraphQL Playground
5. **Join our Discord**: Get help from the team

## Troubleshooting

See [TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md) for common issues and solutions.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines.