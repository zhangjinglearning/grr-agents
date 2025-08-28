# MadPlan Backend

[![Backend CI/CD](https://github.com/USERNAME/REPO_NAME/actions/workflows/ci.yml/badge.svg)](https://github.com/USERNAME/REPO_NAME/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/USERNAME/REPO_NAME/branch/main/graph/badge.svg)](https://codecov.io/gh/USERNAME/REPO_NAME)
[![Render Deployment](https://img.shields.io/badge/Render-Deployed-success)](https://madplan-backend.onrender.com/api/health)

Backend API for the MadPlan Kanban board application built with Nest.js and MongoDB.

## Quick Start

### Environment Setup

1. **Copy environment template:**
   ```bash
   cp .env.template .env
   ```

2. **Configure MongoDB connection:**
   - Open `.env` file
   - Replace `MONGODB_URI` with your actual MongoDB Atlas connection string
   - Update `MONGODB_DATABASE_NAME` if needed (default: `madplan`)

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Start development server:**
   ```bash
   npm run start:dev
   ```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | Required |
| `MONGODB_DATABASE_NAME` | Database name | `madplan` |
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `3000` |
| `JWT_SECRET` | JWT signing secret | Required in production |
| `JWT_EXPIRES_IN` | JWT token expiration | `7d` |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:5173` |

### Database Connection

The application connects to MongoDB Atlas using the connection string format:
```
mongodb+srv://<username>:<password>@<cluster-name>.<hash>.mongodb.net/<database>?retryWrites=true&w=majority
```

### Security Notes

- Never commit `.env` file to version control
- Use strong, unique passwords for database users
- In production, restrict MongoDB Atlas IP whitelist
- Generate secure JWT secrets for production

## CI/CD Pipeline

This project uses GitHub Actions for continuous integration and deployment:

- **Continuous Integration**: Automatic testing on pull requests
- **Staging Deployment**: Auto-deploy to staging on merge to main
- **Production Deployment**: Deploy to production on release tags (v*.*.*)

### Pipeline Steps
1. **Lint & Type Check**: ESLint and TypeScript validation
2. **Unit Tests**: Jest test suite with coverage reporting
3. **Build Verification**: NestJS build validation
4. **Security Audit**: npm audit for vulnerabilities
5. **Deployment**: Automated deployment to Render

### Deployment Status
- **Staging**: [https://madplan-backend-staging.onrender.com](https://madplan-backend-staging.onrender.com/api/health)
- **Production**: [https://madplan-backend.onrender.com](https://madplan-backend.onrender.com/api/health)

## Development

This backend is designed to work with the MadPlan Vue.js frontend application.

### Tech Stack

- **Framework**: Nest.js ~10.3.0
- **Database**: MongoDB 7.0+ via MongoDB Atlas
- **API Style**: GraphQL
- **Testing**: Jest ~29.7.0
- **Language**: TypeScript ~5.4.5

### Project Structure

```
madplan-backend/
├── src/
│   ├── auth/          # Authentication module
│   ├── users/         # User management
│   ├── boards/        # Board functionality
│   ├── shared/        # Shared utilities
│   ├── app.module.ts  # Root module
│   └── main.ts        # Application entry
├── test/              # Test files
├── .env               # Environment variables (not in VCS)
├── .env.template      # Environment template
└── package.json       # Dependencies and scripts
```