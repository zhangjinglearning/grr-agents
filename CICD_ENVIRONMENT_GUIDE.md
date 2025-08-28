# CI/CD Environment Configuration Guide

This guide provides comprehensive instructions for configuring GitHub Actions secrets and environment variables for the MadPlan CI/CD pipeline.

## Repository Secrets Configuration

### Backend Repository Secrets

Configure the following secrets in your GitHub repository settings (`Settings > Secrets and variables > Actions`):

#### Required Secrets

**`MONGODB_URI`**
- **Description**: MongoDB Atlas connection string for production database
- **Format**: `mongodb+srv://<username>:<password>@<cluster-name>.<hash>.mongodb.net/<database>`
- **Source**: From MongoDB Atlas dashboard (Story 0.1)
- **Environment**: Used in production and staging deployments

**`JWT_SECRET`**
- **Description**: Secret key for JWT token signing and verification
- **Format**: Secure random string (32+ characters recommended)
- **Generation**: `openssl rand -base64 32` or similar secure method
- **Security**: Never commit to repository, rotate periodically

**`RENDER_API_KEY`** (Optional for enhanced deployment control)
- **Description**: Render.com API key for deployment management
- **Format**: API key from Render dashboard
- **Source**: Render.com account settings > API Keys
- **Usage**: Enhanced deployment control and status checking

#### Staging-Specific Secrets

**`MONGODB_URI_STAGING`** (Optional)
- **Description**: Separate MongoDB connection for staging environment
- **Recommendation**: Use separate database or cluster for isolation

**`JWT_SECRET_STAGING`** (Optional)
- **Description**: Separate JWT secret for staging environment
- **Security**: Different from production for environment isolation

### Frontend Repository Secrets

#### Required Secrets

**`VITE_GRAPHQL_ENDPOINT`**
- **Description**: GraphQL API endpoint URL for connecting to backend
- **Format**: `https://your-backend-domain.com/graphql`
- **Production**: `https://grr-agents.onrender.com/graphql`
- **Staging**: `https://grr-agents.onrender.com/graphql`

**`VERCEL_TOKEN`**
- **Description**: Vercel deployment token for automated deployments
- **Source**: Vercel dashboard > Settings > Tokens
- **Scope**: Full access for deployment automation

**`VERCEL_PROJECT_ID`**
- **Description**: Vercel project identifier
- **Source**: Vercel project settings
- **Format**: Alphanumeric string identifier

#### Environment-Specific Secrets

**`VITE_GRAPHQL_ENDPOINT_STAGING`**
- **Description**: Staging environment GraphQL endpoint
- **Format**: `https://grr-agents.onrender.com/graphql`

**`VITE_GRAPHQL_ENDPOINT_PRODUCTION`**
- **Description**: Production environment GraphQL endpoint
- **Format**: `https://grr-agents.onrender.com/graphql`

## Environment Variables Setup

### Backend Environment Variables

#### Production Environment (`.env.production`)
```bash
# Database Configuration
MONGODB_URI=mongodb+srv://username:password@cluster.hash.mongodb.net/madplan-prod
DATABASE_NAME=madplan-prod

# Authentication
JWT_SECRET=your-super-secure-jwt-secret-key-here
JWT_EXPIRES_IN=7d

# Application Configuration
NODE_ENV=production
PORT=3000

# CORS Configuration
CORS_ORIGINS=https://grr-agents.vercel.app,https://your-custom-domain.com

# Security
BCRYPT_SALT_ROUNDS=12

# Logging
LOG_LEVEL=warn
```

#### Staging Environment (`.env.staging`)
```bash
# Database Configuration
MONGODB_URI=mongodb+srv://username:password@cluster.hash.mongodb.net/madplan-staging
DATABASE_NAME=madplan-staging

# Authentication
JWT_SECRET=your-staging-jwt-secret-key-here
JWT_EXPIRES_IN=1d

# Application Configuration
NODE_ENV=staging
PORT=3000

# CORS Configuration
CORS_ORIGINS=https://grr-agents.vercel.app

# Security
BCRYPT_SALT_ROUNDS=10

# Logging
LOG_LEVEL=debug
```

### Frontend Environment Variables

#### Production Environment (`.env.production`)
```bash
# API Configuration
VITE_GRAPHQL_ENDPOINT=https://grr-agents.onrender.com/graphql

# Application Configuration
VITE_APP_TITLE=MadPlan
VITE_APP_VERSION=1.0.0
VITE_APP_ENVIRONMENT=production

# Feature Flags
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_DEBUG=false
```

#### Staging Environment (`.env.staging`)
```bash
# API Configuration
VITE_GRAPHQL_ENDPOINT=https://grr-agents.onrender.com/graphql

# Application Configuration
VITE_APP_TITLE=MadPlan (Staging)
VITE_APP_VERSION=latest
VITE_APP_ENVIRONMENT=staging

# Feature Flags
VITE_ENABLE_ANALYTICS=false
VITE_ENABLE_DEBUG=true
```

## GitHub Actions Environment Configuration

### Environment Protection Rules

#### Staging Environment
- **Protection Rules**: None (automatic deployment)
- **Reviewers**: Not required
- **Wait Timer**: None
- **Deployment Branches**: `main` branch only

#### Production Environment
- **Protection Rules**: Required reviewers
- **Reviewers**: 1+ maintainers/admins
- **Wait Timer**: Optional (0-30 minutes)
- **Deployment Branches**: Release tags only (`v*.*.*`)

### Workflow Environment Variables

Environment variables accessible to GitHub Actions workflows:

```yaml
env:
  NODE_VERSION: '20'
  CACHE_VERSION: 'v1'
  
  # Backend specific
  MONGODB_URI: ${{ secrets.MONGODB_URI }}
  JWT_SECRET: ${{ secrets.JWT_SECRET }}
  
  # Frontend specific
  VITE_GRAPHQL_ENDPOINT: ${{ secrets.VITE_GRAPHQL_ENDPOINT }}
```

## Security Best Practices

### Secret Management

1. **Rotation Policy**: Rotate secrets every 90 days minimum
2. **Access Control**: Limit secret access to necessary personnel only
3. **Audit Logging**: Monitor secret access and usage
4. **Environment Separation**: Use different secrets for staging/production

### Environment Variable Security

1. **No Sensitive Data**: Never include passwords, API keys in environment files
2. **Prefix Validation**: Frontend variables must use `VITE_` prefix
3. **Runtime Validation**: Validate environment variables at application startup
4. **Documentation**: Document all required variables and their purposes

### CI/CD Security

1. **Branch Protection**: Require PR reviews before merging to main
2. **Secret Scanning**: Enable GitHub secret scanning
3. **Dependency Scanning**: Enable Dependabot for security updates
4. **Audit Trails**: Monitor deployment logs and access patterns

## Deployment Pipeline Configuration

### Staging Deployment Triggers
- **Automatic**: Push to `main` branch
- **Manual**: Workflow dispatch
- **Conditions**: All tests must pass

### Production Deployment Triggers
- **Release Tags**: Semantic versioning (`v1.0.0`, `v1.0.1`)
- **Manual Approval**: Required for production environment
- **Conditions**: All staging validations must pass

### Rollback Procedures

#### Backend Rollback
1. Access Render dashboard
2. Navigate to service deployment history
3. Select previous successful deployment
4. Click "Redeploy" on stable version

#### Frontend Rollback
1. Access Vercel dashboard
2. Navigate to project deployments
3. Select previous successful deployment
4. Promote to production domain

## Monitoring and Alerting

### Deployment Monitoring
- **Health Checks**: Automated health endpoint monitoring
- **Performance**: Response time and error rate tracking
- **Availability**: Uptime monitoring for both environments

### Alert Configuration
- **Deployment Failures**: Notify team via GitHub notifications
- **Health Check Failures**: Alert on service unavailability
- **Security Issues**: Immediate notification for vulnerabilities

## Troubleshooting

### Common Issues

#### Build Failures
1. Check dependency compatibility
2. Verify environment variable presence
3. Review build logs for specific errors

#### Deployment Failures
1. Validate secret configuration
2. Check environment variable syntax
3. Verify deployment target availability

#### Test Failures
1. Review test output logs
2. Check environment setup in CI
3. Validate mock data and fixtures

### Support Resources

- **GitHub Actions Documentation**: https://docs.github.com/en/actions
- **Render Deployment Guides**: https://render.com/docs
- **Vercel Deployment Guides**: https://vercel.com/docs

## Validation Checklist

- [ ] All required secrets configured in GitHub
- [ ] Environment variables documented and validated
- [ ] Staging deployment tested successfully
- [ ] Production deployment tested with release tag
- [ ] Security scanning enabled and passing
- [ ] Monitoring and alerting configured
- [ ] Team access and permissions verified
- [ ] Rollback procedures tested
- [ ] Documentation updated and accessible