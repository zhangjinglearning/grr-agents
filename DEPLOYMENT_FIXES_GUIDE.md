# Deployment Fixes and Configuration Guide

This guide details the fixes applied to resolve deployment issues and complete the configuration.

## Issues Found and Fixed

### 1. Backend Deployment (Render) - 502 Bad Gateway ❌ → ✅

**Problem**: Backend returning 502 errors on https://grr-agents.onrender.com

**Root Causes**:
- App binding to localhost only (should bind to 0.0.0.0 for cloud deployment)
- Missing environment variables on Render
- CORS not including Vercel frontend URL

**Fixes Applied**:
- Updated `main.ts` to listen on `0.0.0.0` instead of localhost
- Added Vercel frontend URL to CORS origins
- Added environment logging for debugging

### 2. Environment Variables Configuration ❌ → ✅

**Frontend Environment Variables Created**:
```bash
# .env (development)
VITE_GRAPHQL_ENDPOINT=http://localhost:3000/graphql
VITE_NODE_ENV=development
VITE_APP_NAME=MadPlan
VITE_APP_VERSION=1.0.0

# .env.production
VITE_GRAPHQL_ENDPOINT=https://grr-agents.onrender.com/graphql
VITE_NODE_ENV=production
VITE_APP_NAME=MadPlan
VITE_APP_VERSION=1.0.0
```

## Required Actions to Complete Deployment

### Step 1: Update Render Environment Variables

You need to add/update these environment variables in your Render service dashboard:

```bash
# Database Configuration
MONGODB_URI=mongodb+srv://madplan_dev_db_user:vmJHv64NaMrt3ND3@madplan-dev.iiosjam.mongodb.net/madplan?retryWrites=true&w=majority&appName=madplan-dev

# Application Configuration  
NODE_ENV=production
PORT=10000

# JWT Configuration
JWT_SECRET=1c1f5b04ebe7a946271c598791fa7e93
JWT_EXPIRES_IN=7d

# CORS Configuration (UPDATE THIS)
CORS_ORIGINS=https://grr-agents.vercel.app,http://localhost:5173

# Database Name
MONGODB_DATABASE_NAME=madplan
```

### Step 2: Redeploy Backend on Render

After updating environment variables:
1. Go to your Render dashboard
2. Find your `grr-agents` service
3. Click "Manual Deploy" or push changes to trigger auto-deploy

### Step 3: Update Vercel Environment Variables

Add these environment variables to your Vercel project:

```bash
# Production Environment Variables for Vercel
VITE_GRAPHQL_ENDPOINT=https://grr-agents.onrender.com/graphql
VITE_NODE_ENV=production
VITE_APP_NAME=MadPlan
VITE_APP_VERSION=1.0.0
```

### Step 4: Test Deployments

Run these commands to verify everything works:

```bash
# Test backend deployment
npm run test:deployment

# Test MongoDB connection
npm run test:connection
```

## Verification Checklist

- [ ] Render backend responds to https://grr-agents.onrender.com/api/health
- [ ] GraphQL endpoint accessible at https://grr-agents.onrender.com/graphql
- [ ] CORS headers include Vercel domain
- [ ] Vercel frontend can connect to backend API
- [ ] MongoDB Atlas connection working from deployed backend

## Next Steps After Fixes

1. **Monitor Render Logs**: Check for startup errors and fix environment issues
2. **Test GraphQL Schema**: Verify GraphQL playground works in production
3. **End-to-End Testing**: Test complete user flows from frontend to backend
4. **Performance Optimization**: Monitor response times and optimize if needed

## Troubleshooting Commands

```bash
# Check backend health
curl https://grr-agents.onrender.com/api/health

# Test GraphQL
curl -X POST https://grr-agents.onrender.com/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ __schema { types { name } } }"}'

# Local development
npm run start:dev  # Backend
npm run dev        # Frontend
```