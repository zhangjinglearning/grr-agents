# Deployment Environment Configuration Guide

This guide covers environment variable setup for both Render (backend) and Vercel (frontend) deployments.

## Backend Environment Variables (Render)

### Required Variables

| Variable | Description | Example Value | Notes |
|----------|-------------|---------------|-------|
| `MONGODB_URI` | MongoDB Atlas connection string | `mongodb+srv://user:pass@cluster.mongodb.net/db` | From Story 0.1 setup |
| `NODE_ENV` | Runtime environment | `production` | Required for production mode |
| `PORT` | Application port | `10000` | Render assigns this automatically |
| `JWT_SECRET` | JWT token signing key | `your-super-secure-32-char-secret` | Generate strong random string |
| `JWT_EXPIRES_IN` | JWT token expiration | `7d` | Token validity period |
| `CORS_ORIGINS` | Allowed frontend domains | `https://your-app.vercel.app` | Update after Vercel deployment |

### Optional Variables

| Variable | Description | Example Value |
|----------|-------------|---------------|
| `MONGODB_DATABASE_NAME` | Database name override | `madplan` |
| `GRAPHQL_INTROSPECTION` | Enable GraphQL introspection | `true` |
| `GRAPHQL_PLAYGROUND` | Enable GraphQL playground | `false` |

### Setting Variables in Render

1. Go to your Render service dashboard
2. Navigate to "Environment" tab
3. Click "Add Environment Variable"
4. Enter name and value for each variable
5. Click "Save Changes"

## Frontend Environment Variables (Vercel)

### Required Variables

| Variable | Description | Example Value | Notes |
|----------|-------------|---------------|-------|
| `VITE_GRAPHQL_ENDPOINT` | Backend GraphQL URL | `https://your-backend.onrender.com/graphql` | Update after Render deployment |

### Optional Variables

| Variable | Description | Example Value |
|----------|-------------|---------------|
| `VITE_NODE_ENV` | Build environment | `production` |
| `VITE_APP_NAME` | Application name | `MadPlan` |
| `VITE_APP_VERSION` | Application version | `1.0.0` |

### Setting Variables in Vercel

1. Go to your Vercel project dashboard  
2. Navigate to "Settings" → "Environment Variables"
3. Add each variable for Production, Preview, and Development environments
4. Click "Save"

## Security Best Practices

### JWT Secret Generation

Generate a strong JWT secret:

```bash
# Option 1: Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Option 2: Using OpenSSL
openssl rand -hex 32

# Option 3: Using online generator
# Visit: https://generate-random.org/api-key-generator?count=1&length=64&type=mixed-numbers
```

### MongoDB URI Security

- Never include credentials in client-side code
- Use environment variables only
- Ensure Atlas IP whitelist includes 0.0.0.0/0 for Render access
- Consider using MongoDB Atlas Private Endpoint for production

### CORS Configuration

Update CORS origins after deployment:

```bash
# Example CORS_ORIGINS value after both deployments
CORS_ORIGINS=https://madplan-frontend.vercel.app,https://www.yourdomain.com
```

## Deployment Sequence

Follow this sequence for proper environment configuration:

### Step 1: Deploy Backend to Render
1. Set all backend environment variables
2. Deploy and test health endpoint
3. Note the Render service URL

### Step 2: Deploy Frontend to Vercel  
1. Set `VITE_GRAPHQL_ENDPOINT` to Render backend URL
2. Deploy and test GraphQL connectivity
3. Note the Vercel deployment URL

### Step 3: Update CORS Configuration
1. Update `CORS_ORIGINS` in Render to include Vercel URL
2. Redeploy backend service
3. Test end-to-end connectivity

## Verification Commands

### Backend Health Check
```bash
curl https://your-backend.onrender.com/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-08-28T...",
  "service": "madplan-backend", 
  "version": "1.0.0",
  "environment": "production",
  "database": "connected"
}
```

### GraphQL Endpoint Test
```bash
curl -X POST https://your-backend.onrender.com/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ __schema { types { name } } }"}'
```

### Frontend Connectivity Test
1. Open browser developer tools
2. Navigate to your Vercel URL
3. Check Network tab for GraphQL requests
4. Verify no CORS errors in Console

## Troubleshooting

### Common Issues

**CORS Errors:**
- Verify `CORS_ORIGINS` includes exact Vercel URL (with https://)
- Check for trailing slashes or subdomain mismatches
- Ensure backend redeploys after CORS changes

**Database Connection Issues:**
- Verify MongoDB Atlas IP whitelist includes 0.0.0.0/0
- Check `MONGODB_URI` format and credentials
- Test connection with MongoDB Compass or CLI

**Environment Variable Not Loading:**
- Ensure variable names are exact matches
- Check for typos or extra spaces
- Verify variables are set for correct environment

**Build Failures:**
- Verify all required dependencies are in package.json
- Check TypeScript compilation errors
- Review build logs for specific error messages

### Health Check URLs

- **Backend Health**: `https://your-backend.onrender.com/api/health`
- **GraphQL Playground**: `https://your-backend.onrender.com/graphql` (development only)
- **Frontend**: `https://your-frontend.vercel.app`

## Production Considerations

### Security Hardening
- Rotate JWT secrets regularly
- Use strong, unique secrets (minimum 32 characters)
- Enable rate limiting for production
- Monitor for unusual API usage patterns

### Performance Optimization
- Enable database connection pooling
- Configure appropriate timeout values
- Monitor response times and error rates
- Consider CDN for static assets

### Monitoring
- Set up error tracking (e.g., Sentry)
- Monitor service uptime and performance
- Configure alerts for service failures
- Review logs regularly for security issues