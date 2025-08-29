# Development Environment Verification Checklist

Use this checklist to verify that your development environment is properly set up for the MadPlan project.

## Prerequisites ✅

- [ ] **Node.js 18+** installed (`node --version`)
- [ ] **npm 8+** installed (`npm --version`)
- [ ] **Git** installed and configured
- [ ] **MongoDB Atlas** account created (or Docker for local development)
- [ ] **Code Editor** (VS Code recommended)

## Repository Setup ✅

- [ ] **Repository cloned** from GitHub
- [ ] **Both directories exist**: `madplan-frontend/` and `madplan-backend/`
- [ ] **Dependencies installed** in both projects
  ```bash
  cd madplan-backend && npm install
  cd ../madplan-frontend && npm install
  ```

## Environment Configuration ✅

### Backend Configuration
- [ ] **`.env.template`** exists in `madplan-backend/`
- [ ] **`.env`** file created from template
- [ ] **MongoDB connection string** configured in `.env`
- [ ] **JWT secret** generated and configured
- [ ] **CORS origins** set to include frontend URL

### Frontend Configuration
- [ ] **`.env.local.template`** exists in `madplan-frontend/`
- [ ] **`.env.local`** file created from template
- [ ] **GraphQL endpoint** pointing to backend server
- [ ] **Development configuration** set appropriately

## Build Verification ✅

### Backend Build Test
```bash
cd madplan-backend
npm run build
```
- [ ] **Backend builds successfully** without errors
- [ ] **TypeScript compilation** completes
- [ ] **NestJS modules** load correctly

### Frontend Build Test
```bash
cd madplan-frontend
npm run build
```
- [ ] **Frontend builds successfully** without errors
- [ ] **Vue TypeScript** compilation completes
- [ ] **Tailwind CSS** processing works
- [ ] **Vite bundling** creates production assets

## Development Servers ✅

### Backend Server Test
```bash
cd madplan-backend
npm run start:dev
```
- [ ] **Server starts** on port 3000 (or configured port)
- [ ] **MongoDB connection** established successfully
- [ ] **GraphQL playground** accessible at `http://localhost:3000/graphql`
- [ ] **Health endpoint** returns status at `http://localhost:3000/api/health`
- [ ] **Hello World endpoint** responds at `http://localhost:3000`

### Frontend Server Test
```bash
cd madplan-frontend
npm run dev
```
- [ ] **Development server starts** on port 5173 (or configured port)
- [ ] **Vue application loads** at `http://localhost:5173`
- [ ] **Tailwind CSS styles** applied correctly
- [ ] **Router navigation** works between views
- [ ] **Hot Module Replacement** working on file changes

## GraphQL API Testing ✅

### GraphQL Playground Tests
Visit `http://localhost:3000/graphql` and test:

- [ ] **Hello query** returns expected response:
  ```graphql
  query {
    hello
  }
  ```
- [ ] **Health query** returns system status:
  ```graphql
  query {
    health
  }
  ```
- [ ] **Schema introspection** works (can browse schema)
- [ ] **GraphQL playground** interface loads correctly

### Frontend-Backend Communication
- [ ] **Apollo Client** configured correctly
- [ ] **GraphQL queries** can be executed from frontend
- [ ] **CORS** working for cross-origin requests
- [ ] **Network tab** shows successful API calls

## Testing Framework ✅

### Backend Tests
```bash
cd madplan-backend
npm test
```
- [ ] **Jest test runner** works
- [ ] **Unit tests** execute successfully
- [ ] **Test coverage** reporting available
- [ ] **TypeScript tests** compile and run

### Frontend Tests
```bash
cd madplan-frontend
npm test
```
- [ ] **Vitest test runner** works
- [ ] **Vue component tests** execute successfully
- [ ] **TypeScript tests** compile and run
- [ ] **Test UI** accessible via `npm run test:ui`

## Code Quality Tools ✅

### Backend Linting and Formatting
```bash
cd madplan-backend
npm run lint
npm run format
```
- [ ] **ESLint** runs without errors
- [ ] **Prettier** formats code correctly
- [ ] **TypeScript type checking** passes

### Frontend Linting and Formatting
```bash
cd madplan-frontend
npm run lint
npm run type-check
```
- [ ] **ESLint** runs without errors
- [ ] **Vue TypeScript** checking passes
- [ ] **Prettier** formats code correctly

## Documentation Verification ✅

- [ ] **Main README.md** contains comprehensive project information
- [ ] **Frontend README.md** has specific frontend documentation
- [ ] **Backend README.md** has specific backend documentation
- [ ] **Quick Start Guide** exists and is accurate
- [ ] **Development Setup Guide** is comprehensive
- [ ] **Troubleshooting Guide** covers common issues

## Git Configuration ✅

- [ ] **`.gitignore`** properly excludes sensitive files
- [ ] **Environment files** (`.env`, `.env.local`) excluded from git
- [ ] **Node modules** excluded from git
- [ ] **Build artifacts** excluded from git
- [ ] **Git hooks** working (if configured)

## Optional: Docker Development ✅

If using Docker for local development:

```bash
docker-compose up -d
```
- [ ] **MongoDB container** starts successfully
- [ ] **Mongo Express** admin interface accessible at `http://localhost:8081`
- [ ] **Redis container** starts (for future features)
- [ ] **Backend connects** to containerized MongoDB
- [ ] **Database seeding** scripts work

## Performance and Optimization ✅

### Development Performance
- [ ] **Hot reload** works quickly (< 2 seconds)
- [ ] **TypeScript compilation** is reasonably fast
- [ ] **Build times** are acceptable (backend < 10s, frontend < 30s)
- [ ] **Test execution** completes in reasonable time

### Production Build Verification
- [ ] **Production builds** generate optimized assets
- [ ] **Bundle sizes** are reasonable (check build output)
- [ ] **Source maps** generated for debugging
- [ ] **Asset optimization** working correctly

## Security Verification ✅

- [ ] **Environment variables** not exposed in frontend bundle
- [ ] **CORS** properly configured (not allowing all origins in production)
- [ ] **JWT secrets** are properly configured and secure
- [ ] **Database credentials** properly secured
- [ ] **No hardcoded secrets** in code

## Troubleshooting ✅

If any checklist items fail, refer to:

1. **[Troubleshooting Guide](./TROUBLESHOOTING_GUIDE.md)** - Common issues and solutions
2. **[Development Setup Guide](./DEVELOPMENT_SETUP_GUIDE.md)** - Detailed setup instructions
3. **Project documentation** in `/docs/` directory
4. **GitHub Issues** for project-specific problems

## Final Verification ✅

After completing all checklist items:

- [ ] **Both applications running simultaneously** without conflicts
- [ ] **Frontend can communicate** with backend successfully
- [ ] **GraphQL API** working correctly
- [ ] **MongoDB database** connected and accessible
- [ ] **All tests passing** in both projects
- [ ] **Documentation is accurate** and up-to-date

## Success! 🎉

✅ **Development environment is properly configured**
✅ **Ready to start developing MadPlan features**
✅ **Can collaborate with team members effectively**

---

**Estimated setup time**: 15-30 minutes for experienced developers, 30-60 minutes for new developers.

**Last updated**: Based on Story 1.1 implementation (2025-08-28)