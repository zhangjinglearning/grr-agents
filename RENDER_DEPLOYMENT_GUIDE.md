# Render Deployment Setup Guide

This guide walks through setting up the MadPlan backend deployment on Render.com.

## Prerequisites

- GitHub account with madplan-backend repository
- MongoDB Atlas connection string (from Story 0.1)
- Render.com account (free tier available)

## Step 1: Create Render Account

1. Go to [render.com](https://render.com)
2. Click "Get Started" and sign up with your GitHub account
3. Authorize Render to access your repositories

## Step 2: Create Web Service

1. From the Render dashboard, click "New +"
2. Select "Web Service"
3. Connect your GitHub account if not already connected
4. Select the `madplan-backend` repository
5. Configure the service:

### Service Configuration

| Setting | Value | Description |
|---------|-------|-------------|
| **Name** | `madplan-backend` | Service name identifier |
| **Region** | `Ohio (US East)` | Closest to MongoDB Atlas us-east-1 |
| **Branch** | `main` | Auto-deploy from main branch |
| **Runtime** | `Node` | Node.js application |
| **Build Command** | `npm install && npm run build` | Install deps and build |
| **Start Command** | `npm run start:prod` | Production startup |
| **Plan** | `Starter (Free)` | 0.5 CPU, 512MB RAM |

## Step 3: Environment Variables

Configure these environment variables in the Render dashboard:

### Required Environment Variables

```bash
# Database Configuration
MONGODB_URI=mongodb+srv://madplan_dev_db_user:vmJHv64NaMrt3ND3@madplan-dev.iiosjam.mongodb.net/madplan?retryWrites=true&w=majority&appName=madplan-dev

# Application Configuration  
NODE_ENV=production
PORT=10000

# JWT Configuration (generate a secure random string)
JWT_SECRET=your-super-secure-jwt-secret-here-min-32-chars
JWT_EXPIRES_IN=7d

# CORS Configuration (will be updated after Vercel setup)
CORS_ORIGINS=http://localhost:5173,https://your-vercel-domain.vercel.app

# Optional: MongoDB Database Name
MONGODB_DATABASE_NAME=madplan
```

### Setting Environment Variables

1. In your Render service dashboard, go to "Environment" tab
2. Click "Add Environment Variable" for each variable above
3. Copy the exact name and value (replace placeholders with actual values)
4. Click "Save Changes"

## Step 4: Deploy

1. Once environment variables are set, click "Manual Deploy" or push to main branch
2. Monitor the deployment logs for any errors
3. Wait for deployment to complete (usually 2-5 minutes)

## Step 5: Verify Deployment

Your backend will be available at: `https://madplan-backend.onrender.com`

### Health Check Endpoints

Test these endpoints to verify deployment:

```bash
# Basic health check
curl https://your-service-name.onrender.com/health

# GraphQL endpoint
curl -X POST https://your-service-name.onrender.com/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ __schema { types { name } } }"}'
```

## Step 6: SSL Certificate

SSL certificates are automatically provisioned by Render for all web services. Your backend will be accessible via HTTPS only.

## Troubleshooting

### Common Issues

**Build Failures:**
- Check that package.json includes all required dependencies
- Verify build command is correct: `npm run build`
- Review build logs for specific errors

**Environment Variable Issues:**
- Ensure all required environment variables are set
- Check for typos in variable names
- MongoDB URI should be URL-encoded if it contains special characters

**Connection Issues:**
- Verify MongoDB Atlas IP whitelist includes 0.0.0.0/0 for Render access
- Test MongoDB connection from local environment first
- Check Render service logs for connection errors

**Deployment Timeouts:**
- Free tier services may take 5-10 minutes to start from sleep
- Check if service is sleeping and make a request to wake it up

### Useful Commands

```bash
# Check service status
curl -I https://your-service-name.onrender.com

# View live logs (from Render dashboard)
# Navigate to your service > Logs tab

# Test GraphQL endpoint
curl -X POST https://your-service-name.onrender.com/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { __typename }"}'
```

## Security Notes

- All traffic is automatically HTTPS
- Environment variables are encrypted at rest
- Use strong, unique JWT secrets (minimum 32 characters)
- Regularly rotate JWT secrets
- Monitor service logs for suspicious activity

## Performance Considerations

- Free tier services sleep after 30 minutes of inactivity
- Cold starts can take 30-60 seconds
- Consider upgrading to paid tier for production workloads
- Monitor service metrics in Render dashboard

## Next Steps

After successful backend deployment:
1. Document your Render service URL
2. Update frontend environment variables to point to this URL
3. Configure CORS origins to include your Vercel frontend URL
4. Test end-to-end connectivity between frontend and backend