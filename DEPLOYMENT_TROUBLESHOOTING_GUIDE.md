# Deployment Troubleshooting Guide

This guide provides solutions for common deployment issues with Render and Vercel.

## Backend Deployment Issues (Render)

### Build Failures

**TypeScript Compilation Errors:**
```bash
# Symptom: Build fails with TS errors
# Solution: Check dependencies and TypeScript configuration
npm run build  # Run locally to identify issues
npm install     # Ensure all dependencies are installed
```

**Missing Dependencies:**
```bash
# Symptom: "Cannot find module" errors
# Solution: Add missing dependencies to package.json
npm install @nestjs/apollo @nestjs/config --save
```

**Build Timeout:**
```bash
# Symptom: Build exceeds time limit
# Solution: Optimize build process or upgrade Render plan
# Check build logs for performance bottlenecks
```

### Runtime Issues

**Application Crashes on Startup:**
```bash
# Check Render service logs for errors
# Common causes:
# 1. Missing environment variables
# 2. Database connection failures
# 3. Port configuration issues
```

**Database Connection Failures:**
```bash
# Verify MongoDB Atlas configuration:
# 1. IP whitelist includes 0.0.0.0/0
# 2. Database user has correct permissions
# 3. Connection string is correctly formatted
# 4. Database name matches configuration

# Test connection locally:
node scripts/test-connection.js
```

**Port Binding Issues:**
```javascript
// Ensure main.ts uses PORT environment variable
const port = process.env.PORT || 3000;
await app.listen(port);
```

### Performance Issues

**Cold Start Delays:**
- Free tier services sleep after 30 minutes of inactivity
- First request after sleep can take 30-60 seconds
- Consider upgrading to paid tier for production

**Memory Limit Exceeded:**
- Free tier has 512MB RAM limit
- Monitor memory usage in Render dashboard
- Optimize application memory usage or upgrade plan

### SSL and CORS Issues

**CORS Errors:**
```javascript
// Verify CORS configuration in main.ts
app.enableCors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'],
  credentials: true,
});

// Update CORS_ORIGINS environment variable with exact Vercel URL
```

**SSL Certificate Issues:**
- SSL is automatically provisioned by Render
- Check if custom domain DNS is correctly configured
- Allow 24-48 hours for certificate issuance

## Frontend Deployment Issues (Vercel)

### Build Failures

**Vite Build Errors:**
```bash
# Run build locally to identify issues
npm run build
npm run preview  # Test production build locally
```

**Environment Variable Issues:**
```bash
# Ensure all VITE_ prefixed variables are set in Vercel
# Variables must be available at build time
VITE_GRAPHQL_ENDPOINT=https://grr-agents.onrender.com/graphql
```

**TypeScript Errors:**
```bash
# Check TypeScript configuration
# Verify all imports and type definitions
npm run type-check  # If available
```

### Runtime Issues

**GraphQL Connection Failures:**
```javascript
// Verify backend URL is correct and accessible
// Check browser network tab for failed requests
// Ensure backend CORS allows Vercel domain
```

**Environment Variables Not Loading:**
```bash
# Vite environment variables must be prefixed with VITE_
# Set variables for all environments: Production, Preview, Development
```

### Performance Issues

**Large Bundle Size:**
```bash
# Analyze bundle size
npm run build -- --analyze  # If supported by build tool
# Optimize imports and dependencies
```

**Slow Page Loads:**
- Enable Vercel Analytics to identify performance bottlenecks
- Optimize images and static assets
- Implement code splitting for large applications

## Cross-Platform Issues

### CORS Configuration

**Frontend Can't Connect to Backend:**

1. **Check Backend CORS Settings:**
```bash
# Verify CORS_ORIGINS environment variable in Render
CORS_ORIGINS=https://grr-agents.vercel.app,https://your-custom-domain.com
```

2. **Check Frontend GraphQL Endpoint:**
```bash
# Verify VITE_GRAPHQL_ENDPOINT in Vercel
VITE_GRAPHQL_ENDPOINT=https://grr-agents.onrender.com/graphql
```

3. **Test CORS Manually:**
```bash
curl -H "Origin: https://grr-agents.vercel.app" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS https://grr-agents.onrender.com/graphql
```

### SSL and Security Issues

**Mixed Content Warnings:**
- Ensure both frontend and backend use HTTPS
- Check that all API calls use HTTPS URLs

**Certificate Verification Errors:**
- Both Vercel and Render provide automatic SSL
- Custom domains may require DNS configuration

## Deployment Testing

### Automated Testing Script

```bash
# Test backend deployment
cd madplan-backend
BACKEND_URL=https://grr-agents.onrender.com npm run test:deployment
```

### Manual Testing Checklist

**Backend Health Check:**
```bash
curl https://grr-agents.onrender.com/api/health
```

**GraphQL Endpoint Test:**
```bash
curl -X POST https://grr-agents.onrender.com/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ __schema { types { name } } }"}'
```

**Frontend Connectivity:**
1. Open browser developer tools
2. Navigate to Vercel URL
3. Check Network tab for GraphQL requests
4. Verify no CORS errors in Console

## Monitoring and Maintenance

### Health Monitoring

**Backend Monitoring:**
- Monitor service uptime in Render dashboard
- Set up alerts for service failures
- Review application logs regularly

**Frontend Monitoring:**
- Enable Vercel Analytics
- Monitor Core Web Vitals
- Track user experience metrics

### Log Analysis

**Backend Logs (Render):**
- Access logs through Render dashboard
- Look for error patterns and performance issues
- Monitor database connection health

**Frontend Logs (Vercel):**
- Check function logs in Vercel dashboard
- Monitor build and deployment logs
- Review runtime errors

### Performance Optimization

**Backend Optimization:**
- Monitor response times and database query performance
- Optimize GraphQL resolvers
- Implement caching strategies

**Frontend Optimization:**
- Minimize bundle size
- Optimize loading performance
- Implement lazy loading for components

## Emergency Recovery

### Service Outage Recovery

1. **Check Service Status:**
   - Render status page: status.render.com
   - Vercel status page: www.vercel-status.com

2. **Rollback to Previous Version:**
   - Use Render dashboard to redeploy previous version
   - Use Vercel dashboard to redeploy previous version

3. **Database Issues:**
   - Check MongoDB Atlas status
   - Verify connection settings
   - Consider temporary maintenance mode

### Data Recovery

**Backup Strategies:**
- Regular database backups through MongoDB Atlas
- Version control for code changes
- Environment variable backups

**Recovery Procedures:**
- Restore from MongoDB Atlas backup
- Redeploy from known working commit
- Restore environment variables from backup

## Common Error Codes

### HTTP Status Codes

- **500**: Internal server error - check backend logs
- **502**: Bad gateway - service may be starting or crashed
- **503**: Service unavailable - temporary outage or maintenance
- **CORS errors**: Check CORS configuration and domain whitelist

### GraphQL Errors

- **"Network error"**: Backend not accessible or CORS issue
- **"Schema not found"**: GraphQL endpoint configuration issue
- **"Unauthorized"**: Authentication/authorization issue

## Getting Help

### Support Resources

**Render Support:**
- Documentation: render.com/docs
- Community: community.render.com
- Support: render.com/support

**Vercel Support:**
- Documentation: vercel.com/docs
- Community: github.com/vercel/vercel/discussions
- Support: vercel.com/support

**MongoDB Atlas Support:**
- Documentation: docs.atlas.mongodb.com
- Support: support.mongodb.com

### Debug Information to Collect

When seeking help, provide:
- Error messages and logs
- Environment variable configurations (without sensitive data)
- Steps to reproduce the issue
- Service URLs and deployment details