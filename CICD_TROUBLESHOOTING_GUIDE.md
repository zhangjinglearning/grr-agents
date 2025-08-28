# CI/CD Pipeline Troubleshooting Guide

This guide provides solutions for common issues encountered in the MadPlan CI/CD pipeline.

## GitHub Actions Workflow Issues

### Build Failures

#### TypeScript Compilation Errors
**Symptoms:**
- Build fails with TypeScript error messages
- `tsc --noEmit` step fails in workflow

**Solutions:**
```bash
# Check TypeScript configuration locally
cd madplan-backend  # or madplan-frontend
npm run type-check

# Fix common issues:
# 1. Update tsconfig.json with correct paths
# 2. Install missing @types packages
# 3. Fix type annotations in source code
```

#### Lint Failures
**Symptoms:**
- ESLint step fails with code quality issues
- Formatting or style guide violations

**Solutions:**
```bash
# Run lint locally to identify issues
npm run lint

# Auto-fix common issues
npm run lint -- --fix

# Common fixes:
# 1. Remove unused imports
# 2. Fix indentation and spacing
# 3. Add missing semicolons or remove extra ones
```

#### Test Failures
**Symptoms:**
- Unit tests fail in CI but pass locally
- Coverage thresholds not met

**Solutions:**
```bash
# Run tests with same conditions as CI
npm test -- --coverage --watchAll=false

# Common issues:
# 1. Environment variable differences
# 2. Time zone or locale issues
# 3. Async test timing issues
# 4. Mock configuration problems
```

#### Dependency Installation Issues
**Symptoms:**
- `npm ci` fails with dependency resolution errors
- Package version conflicts

**Solutions:**
```bash
# Clear cache and reinstall locally
rm package-lock.json node_modules -rf
npm install

# For CI issues:
# 1. Commit updated package-lock.json
# 2. Check for Node.js version compatibility
# 3. Review dependency version ranges
```

### Deployment Issues

#### Render Backend Deployment Failures
**Symptoms:**
- Render build fails after successful GitHub Actions
- Service doesn't start properly
- Health check endpoints return errors

**Troubleshooting Steps:**
1. **Check Render Service Logs**
   ```bash
   # Access Render dashboard > Service > Logs
   # Look for startup errors, memory issues, or environment variable problems
   ```

2. **Verify Environment Variables**
   ```bash
   # In Render dashboard > Service > Environment
   # Ensure all required variables are set:
   # MONGODB_URI, JWT_SECRET, CORS_ORIGINS, NODE_ENV
   ```

3. **Test Build Locally**
   ```bash
   cd madplan-backend
   npm run build
   npm run start:prod
   ```

#### Vercel Frontend Deployment Failures
**Symptoms:**
- Vercel build fails with Vite errors
- Environment variables not loading
- Frontend can't connect to backend

**Troubleshooting Steps:**
1. **Check Build Logs**
   ```bash
   # Access Vercel dashboard > Project > Deployments > [Failed deployment]
   # Review build logs for specific error messages
   ```

2. **Verify Environment Variables**
   ```bash
   # In Vercel dashboard > Project > Settings > Environment Variables
   # Ensure VITE_GRAPHQL_ENDPOINT is set correctly
   ```

3. **Test Build Locally**
   ```bash
   cd madplan-frontend
   npm run build
   npm run preview
   ```

### Secrets and Environment Variables

#### Missing Secrets Error
**Symptoms:**
- Workflow fails with "secret not found" errors
- Environment variables are undefined

**Solutions:**
1. **Verify Secret Configuration**
   - Go to repository Settings > Secrets and variables > Actions
   - Ensure all required secrets are added
   - Check secret names match workflow references exactly

2. **Required Secrets Checklist:**
   **Backend:**
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `RENDER_API_KEY` (optional)

   **Frontend:**
   - `VITE_GRAPHQL_ENDPOINT`
   - `VERCEL_TOKEN`
   - `VERCEL_PROJECT_ID`

#### Environment-Specific Issues
**Symptoms:**
- Staging works but production fails
- Wrong environment variables loaded

**Solutions:**
1. **Check Environment Protection Rules**
   - Repository Settings > Environments
   - Verify staging and production environments exist
   - Check environment-specific secrets

2. **Verify Branch/Tag Triggers**
   ```yaml
   # Staging: pushes to main branch
   if: github.event_name == 'push' && github.ref == 'refs/heads/main'
   
   # Production: release tags only
   if: github.event_name == 'release'
   ```

## Integration Issues

### Backend-Frontend Communication

#### CORS Errors
**Symptoms:**
- Frontend can't connect to backend API
- Browser console shows CORS policy errors
- OPTIONS requests are blocked

**Solutions:**
1. **Backend CORS Configuration**
   ```typescript
   // In main.ts
   app.enableCors({
     origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'],
     credentials: true,
   });
   ```

2. **Environment Variables**
   ```bash
   # Backend CORS_ORIGINS should include frontend domains
   CORS_ORIGINS=https://madplan-frontend.vercel.app,https://staging-frontend.vercel.app
   ```

3. **Test CORS Manually**
   ```bash
   curl -H "Origin: https://your-frontend.vercel.app" \
        -H "Access-Control-Request-Method: POST" \
        -X OPTIONS https://your-backend.onrender.com/graphql
   ```

#### GraphQL Connection Issues
**Symptoms:**
- Frontend shows "Network error" for GraphQL queries
- GraphQL endpoint returns 404 or 500 errors

**Solutions:**
1. **Verify GraphQL Endpoint**
   ```bash
   # Test GraphQL endpoint directly
   curl -X POST https://your-backend.onrender.com/graphql \
        -H "Content-Type: application/json" \
        -d '{"query": "{ __schema { types { name } } }"}'
   ```

2. **Check Frontend Configuration**
   ```typescript
   // Verify VITE_GRAPHQL_ENDPOINT in production build
   const apolloClient = new ApolloClient({
     uri: import.meta.env.VITE_GRAPHQL_ENDPOINT,
     // ...
   });
   ```

### Database Connection Issues

#### MongoDB Atlas Connectivity
**Symptoms:**
- Backend health checks fail
- Database connection timeouts
- Authentication errors

**Solutions:**
1. **Check IP Whitelist**
   ```bash
   # In MongoDB Atlas dashboard > Network Access
   # Ensure 0.0.0.0/0 is allowed for cloud deployments
   # Or add specific IP ranges for Render/Vercel
   ```

2. **Verify Connection String**
   ```bash
   # Format: mongodb+srv://username:password@cluster.hash.mongodb.net/database
   # Common issues:
   # - Special characters in password need URL encoding
   # - Incorrect database name
   # - Wrong cluster hostname
   ```

3. **Test Connection Locally**
   ```bash
   cd madplan-backend
   node scripts/test-connection.js
   ```

## Performance Issues

### Build Performance

#### Slow Build Times
**Symptoms:**
- GitHub Actions workflows timeout
- Builds take longer than expected
- High resource usage

**Optimizations:**
1. **Dependency Caching**
   ```yaml
   - name: Setup Node.js
     uses: actions/setup-node@v4
     with:
       node-version: ${{ env.NODE_VERSION }}
       cache: 'npm'
       cache-dependency-path: 'package-lock.json'
   ```

2. **Parallel Job Execution**
   ```yaml
   # Ensure jobs run in parallel when possible
   jobs:
     lint:
       # ...
     test:
       # Don't depend on lint unnecessarily
     build:
       needs: [lint, test]  # Only depend when necessary
   ```

3. **Optimize Bundle Size**
   ```bash
   # Frontend bundle analysis
   cd madplan-frontend
   npm run build -- --analyze
   
   # Backend build optimization
   cd madplan-backend
   npm run build
   ```

### Runtime Performance

#### Cold Start Issues
**Symptoms:**
- First request after deployment takes very long
- Services appear to be "sleeping"

**Solutions:**
1. **Render Free Tier Limitations**
   - Services sleep after 15 minutes of inactivity
   - First request can take 30-60 seconds to wake up
   - Consider upgrading to paid tier for production

2. **Health Check Optimization**
   ```typescript
   // Lightweight health check endpoint
   @Get('health')
   getHealth(): { status: string; timestamp: string } {
     return {
       status: 'ok',
       timestamp: new Date().toISOString()
     };
   }
   ```

## Security Issues

### Secret Exposure

#### Accidental Secret Commits
**Symptoms:**
- GitHub security alerts
- API keys or passwords in commit history
- Security scanning failures

**Solutions:**
1. **Immediate Response**
   ```bash
   # Rotate exposed secrets immediately
   # Update all affected services
   # Review commit history for other exposures
   ```

2. **Prevention**
   ```bash
   # Add to .gitignore
   .env
   .env.local
   .env.production
   .env.staging
   *.key
   *.pem
   
   # Use git-secrets or similar tools
   git secrets --scan
   ```

### Dependency Vulnerabilities

#### Security Audit Failures
**Symptoms:**
- `npm audit` step fails in CI
- High severity vulnerabilities detected

**Solutions:**
```bash
# Review vulnerabilities
npm audit

# Fix automatically where possible
npm audit fix

# For high-severity issues requiring manual review
npm audit fix --force  # Use with caution

# Update specific packages
npm update package-name
```

## Monitoring and Alerting

### Health Check Failures

#### Service Unavailable
**Symptoms:**
- Health check endpoints return 503 or timeout
- Monitoring alerts triggered

**Investigation Steps:**
1. **Check Service Status**
   - Render dashboard for backend status
   - Vercel dashboard for frontend status
   - GitHub Actions workflow status

2. **Review Logs**
   ```bash
   # Backend logs (Render dashboard)
   # Frontend build logs (Vercel dashboard)
   # GitHub Actions logs for deployment steps
   ```

3. **Test Manually**
   ```bash
   # Run integration tests
   cd scripts
   node test-cicd-pipeline.js staging
   node test-cicd-pipeline.js production
   ```

### Performance Monitoring

#### Response Time Degradation
**Symptoms:**
- API response times increasing
- Frontend loading slowly
- User experience issues

**Analysis:**
1. **Backend Performance**
   ```bash
   # Check database query performance
   # Review API endpoint response times
   # Monitor memory and CPU usage in Render
   ```

2. **Frontend Performance**
   ```bash
   # Analyze bundle size and loading times
   # Check Vercel analytics
   # Review Core Web Vitals
   ```

## Recovery Procedures

### Rollback Strategies

#### Production Rollback
1. **Backend Rollback (Render)**
   - Go to Render dashboard > Service
   - Navigate to Deployments tab
   - Find last known good deployment
   - Click "Redeploy from this deployment"

2. **Frontend Rollback (Vercel)**
   - Go to Vercel dashboard > Project
   - Navigate to Deployments tab
   - Find last known good deployment
   - Click "Promote to Production"

3. **Database Rollback**
   ```bash
   # If database migration issues
   # Use MongoDB Atlas backup/restore
   # Coordinate with application rollback
   ```

#### Emergency Procedures
1. **Service Outage**
   - Check status pages (Render, Vercel, MongoDB Atlas)
   - Enable maintenance mode if available
   - Communicate with users about outage
   - Implement workarounds if possible

2. **Security Incident**
   - Rotate all affected secrets immediately
   - Review access logs
   - Deploy emergency security patches
   - Monitor for unauthorized access

## Getting Help

### Support Channels
- **GitHub Actions**: GitHub community discussions
- **Render**: Render community forum and support
- **Vercel**: Vercel documentation and community
- **MongoDB Atlas**: MongoDB support portal

### Debugging Information to Collect
When seeking help, provide:
- Workflow run URLs and failure logs
- Environment configuration (without secrets)
- Steps to reproduce the issue
- Relevant error messages and stack traces
- Service deployment URLs and status