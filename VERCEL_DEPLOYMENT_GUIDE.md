# Vercel Deployment Setup Guide

This guide walks through setting up the MadPlan frontend deployment on Vercel.

## Prerequisites

- GitHub account with madplan-frontend repository
- Backend deployed on Render (from previous step)
- Vercel account (free tier available)

## Step 1: Create Vercel Account

1. Go to [vercel.com](https://vercel.com)
2. Click "Start Deploying" and sign up with your GitHub account
3. Authorize Vercel to access your repositories

## Step 2: Import Project

1. From the Vercel dashboard, click "Add New..." → "Project"
2. Find and select the `madplan-frontend` repository
3. Click "Import"

## Step 3: Configure Project Settings

### Framework Detection
Vercel should automatically detect:
- **Framework Preset**: `Vue.js`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### Manual Configuration (if needed)

| Setting | Value | Description |
|---------|-------|-------------|
| **Project Name** | `madplan-frontend` | Project identifier |
| **Framework** | `Vue.js` | Framework preset |
| **Root Directory** | `.` | Project root |
| **Build Command** | `npm run build` | Vite build command |
| **Output Directory** | `dist` | Vite output folder |
| **Install Command** | `npm install` | Package installation |

## Step 4: Environment Variables

Configure these environment variables in the Vercel project settings:

### Required Environment Variables

```bash
# GraphQL API Endpoint (replace with your Render backend URL)
VITE_GRAPHQL_ENDPOINT=https://grr-agents.onrender.com/graphql

# Optional: Environment identifier
VITE_NODE_ENV=production

# Optional: Application name
VITE_APP_NAME=MadPlan

# Optional: Version info
VITE_APP_VERSION=1.0.0
```

### Setting Environment Variables

1. In your Vercel project dashboard, go to "Settings" tab
2. Click "Environment Variables" in the sidebar
3. Add each variable:
   - **Name**: Variable name (e.g., `VITE_GRAPHQL_ENDPOINT`)
   - **Value**: Variable value (e.g., `https://grr-agents.onrender.com/graphql`)
   - **Environment**: Select "Production", "Preview", and "Development"
4. Click "Save" for each variable

## Step 5: Deploy

1. Once environment variables are set, click "Deploy" or push to main branch
2. Monitor the deployment logs for any errors
3. Wait for deployment to complete (usually 1-3 minutes)

## Step 6: Configure Custom Domain (Optional)

### Using Vercel Domain
Your app will be available at: `https://grr-agents.vercel.app`

### Custom Domain Setup
1. Go to "Settings" → "Domains" in your Vercel project
2. Add your custom domain
3. Configure DNS records as instructed by Vercel
4. Wait for SSL certificate provisioning

## Step 7: Verify Deployment

Test your deployed frontend:

1. Visit your Vercel URL
2. Check that the application loads properly
3. Verify GraphQL connectivity (check browser network tab)
4. Test user interactions and API calls

## Step 8: SSL Certificate

SSL certificates are automatically provisioned by Vercel for all deployments. Your frontend will be accessible via HTTPS by default.

## Troubleshooting

### Common Issues

**Build Failures:**
- Check that package.json includes all required dependencies
- Verify Vite configuration is correct
- Review build logs for TypeScript errors or missing files

**Environment Variable Issues:**
- Ensure all VITE_ prefixed variables are set
- Check for typos in variable names
- Variables must be available at build time for Vite

**GraphQL Connection Issues:**
- Verify backend URL is correct and accessible
- Check CORS configuration on backend
- Test backend endpoint directly

**Performance Issues:**
- Enable Vercel Analytics in project settings
- Check bundle size and optimize if needed
- Review Core Web Vitals metrics

### Useful Commands

```bash
# Test deployment locally (requires Vercel CLI)
vercel dev

# Check deployment status
vercel ls

# View deployment logs
vercel logs

# Test production build locally
npm run build && npm run preview
```

## Configuration Files

### vercel.json (Optional)

Create a `vercel.json` file in your project root for advanced configuration:

```json
{
  "name": "madplan-frontend",
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ],
  "routes": [
    {
      "handle": "filesystem"
    },
    {
      "src": "/.*",
      "dest": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Access-Control-Allow-Origin",
          "value": "*"
        }
      ]
    }
  ]
}
```

## Performance Optimization

### Vercel Analytics
1. Go to "Analytics" tab in your project dashboard
2. Enable Vercel Analytics for performance monitoring
3. Monitor Core Web Vitals and user experience metrics

### Build Optimization
- Use dynamic imports for code splitting
- Optimize images with Vercel Image Optimization
- Enable compression and caching headers
- Monitor bundle size and dependencies

## Security Notes

- All traffic is automatically HTTPS
- Environment variables are encrypted
- Vercel provides DDoS protection
- Review security headers in vercel.json
- Monitor deployment logs for security issues

## Next Steps

After successful frontend deployment:
1. Document your Vercel URL
2. Update backend CORS configuration to include your Vercel domain
3. Test end-to-end functionality
4. Set up monitoring and alerts
5. Consider custom domain for production use

## Integration with Backend

Ensure your backend (Render) is configured to accept requests from your Vercel domain:

1. Update `CORS_ORIGINS` environment variable on Render
2. Include your Vercel URL: `https://grr-agents.vercel.app`
3. Test API connectivity from deployed frontend
4. Monitor both frontend and backend logs during testing