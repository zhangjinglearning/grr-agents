# MadPlan Backend

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