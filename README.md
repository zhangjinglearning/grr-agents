# MadPlan - Studio Ghibli-Inspired Kanban Board

[![Frontend CI/CD](https://github.com/zhangjinglearning/grr-agents/actions/workflows/ci.yml/badge.svg)](https://github.com/zhangjinglearning/grr-agents/actions/workflows/ci.yml)
[![Vercel Frontend](https://img.shields.io/badge/Frontend-Vercel-success)](https://grr-agents.vercel.app)
[![Render Backend](https://img.shields.io/badge/Backend-Render-success)](https://grr-agents.onrender.com/api/health)

A beautiful, Studio Ghibli-inspired Kanban board application built with modern web technologies. This project features a Vue 3 frontend and a NestJS backend in a monorepo structure.

## 🎨 Features

- **Studio Ghibli-Inspired Design**: Beautiful, nature-inspired UI with earth tones and magical elements
- **Modern Tech Stack**: Vue 3, TypeScript, NestJS, GraphQL, and MongoDB
- **Real-time Updates**: GraphQL subscriptions for collaborative editing
- **Responsive Design**: Works beautifully on desktop, tablet, and mobile devices
- **Comprehensive Testing**: Unit, integration, and E2E testing coverage
- **CI/CD Pipeline**: Automated testing and deployment workflows

## 🏗️ Architecture

This is a **monorepo** containing both frontend and backend applications:

```
grr-agents/
├── madplan-frontend/     # Vue 3 + TypeScript frontend
├── madplan-backend/      # NestJS + GraphQL backend
├── docs/                 # Project documentation
└── shared resources     # Docker, scripts, guides
```

### Tech Stack

**Frontend:**
- Vue 3 (~3.4.21) with Composition API
- TypeScript (~5.4.5)
- Vite build system
- Tailwind CSS (~3.4.3) with Studio Ghibli theme
- Pinia (~2.1.7) for state management
- Apollo Client for GraphQL
- Vitest for testing

**Backend:**
- NestJS (~10.3.0) with TypeScript
- GraphQL with Apollo Server
- MongoDB with Mongoose
- Jest for testing
- JWT authentication

**Infrastructure:**
- MongoDB Atlas for database
- Vercel for frontend hosting
- Render for backend hosting
- GitHub Actions for CI/CD

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm 8+
- MongoDB Atlas account (or Docker for local database)

### 1. Clone and Install

```bash
git clone https://github.com/zhangjinglearning/grr-agents.git
cd grr-agents

# Install dependencies for both applications
cd madplan-backend && npm install
cd ../madplan-frontend && npm install
```

### 2. Environment Setup

**Backend Configuration:**
```bash
cd madplan-backend
cp .env.template .env
# Edit .env with your MongoDB Atlas connection string and JWT secret
```

**Frontend Configuration:**
```bash
cd madplan-frontend
cp .env.local.template .env.local
# .env.local is pre-configured for local development
```

### 3. Start Development Servers

```bash
# Terminal 1: Start backend
cd madplan-backend
npm run start:dev

# Terminal 2: Start frontend
cd madplan-frontend
npm run dev
```

### 4. Access Applications

- **Frontend**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:3000/api/health](http://localhost:3000/api/health)
- **GraphQL Playground**: [http://localhost:3000/graphql](http://localhost:3000/graphql)

## 📚 Documentation

- **[Quick Start Guide](./QUICK_START.md)** - Get up and running in 10 minutes
- **[Development Setup Guide](./DEVELOPMENT_SETUP_GUIDE.md)** - Comprehensive development environment setup
- **[Troubleshooting Guide](./TROUBLESHOOTING_GUIDE.md)** - Common issues and solutions
- **[Architecture Documentation](./docs/architecture/)** - Technical architecture details
- **[API Documentation](./docs/architecture/api-specification.md)** - GraphQL schema and endpoints
- **[Deployment Guides](./docs/)** - MongoDB Atlas, Render, and Vercel setup guides

## 🧪 Testing

### Run Tests

```bash
# Backend tests
cd madplan-backend
npm test
npm run test:cov  # with coverage

# Frontend tests  
cd madplan-frontend
npm test
npm run test:coverage  # with coverage
```

### Build for Production

```bash
# Backend
cd madplan-backend
npm run build

# Frontend
cd madplan-frontend
npm run build
```

## 🚢 Deployment

### Current Deployments

- **Frontend (Staging/Production)**: [https://grr-agents.vercel.app](https://grr-agents.vercel.app)
- **Backend (Staging/Production)**: [https://grr-agents.onrender.com](https://grr-agents.onrender.com/api/health)
- **Database**: MongoDB Atlas (us-east-1)

### Deployment Process

1. **Staging**: Automatic deployment on push to `main` branch
2. **Production**: Automatic deployment on release tags (`v*.*.*`)

See deployment guides for detailed setup instructions:
- [MongoDB Atlas Setup](./MONGODB_ATLAS_SETUP_GUIDE.md)
- [Render Backend Deployment](./RENDER_DEPLOYMENT_GUIDE.md)
- [Vercel Frontend Deployment](./VERCEL_DEPLOYMENT_GUIDE.md)

## 🤝 Development Workflow

1. **Clone the repository**
2. **Install dependencies** in both directories
3. **Set up environment variables** using provided templates
4. **Start development servers** for both frontend and backend
5. **Make changes** with hot reload active
6. **Run tests** and quality checks
7. **Commit and push** - CI/CD pipeline will test and deploy

### Code Quality

We maintain high code quality through:
- TypeScript for type safety
- ESLint for code linting
- Prettier for code formatting
- Comprehensive test coverage
- Automated CI/CD quality gates

## 🏡 Local Development with Docker

For developers who prefer containerized development:

```bash
# Start local MongoDB and Redis
docker-compose up -d

# Update backend .env to use local database
MONGODB_URI=mongodb://localhost:27017/madplan-dev

# Start applications normally
cd madplan-backend && npm run start:dev
cd madplan-frontend && npm run dev
```

## 🐛 Troubleshooting

Common issues and solutions:

- **Port conflicts**: Change ports in `.env` files
- **MongoDB connection**: Verify Atlas connection string and IP whitelist
- **CORS errors**: Check `CORS_ORIGINS` in backend `.env`
- **Build failures**: Clear `node_modules` and reinstall dependencies

For detailed troubleshooting, see [TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md).

## 📝 Project Structure

```
grr-agents/
├── madplan-frontend/
│   ├── src/
│   │   ├── components/     # Reusable Vue components
│   │   ├── views/         # Page components
│   │   ├── router/        # Vue Router configuration
│   │   ├── stores/        # Pinia state management
│   │   ├── services/      # API services
│   │   └── assets/        # Static assets
│   ├── public/            # Public assets
│   └── package.json       # Frontend dependencies
├── madplan-backend/
│   ├── src/
│   │   ├── auth/          # Authentication module
│   │   ├── users/         # User management
│   │   ├── boards/        # Board functionality
│   │   ├── shared/        # Shared utilities
│   │   └── main.ts        # Application entry
│   └── package.json       # Backend dependencies
├── docs/                  # Documentation
│   ├── architecture/      # Technical documentation
│   ├── stories/          # Development stories
│   └── prd/              # Product requirements
└── docker-compose.yml    # Local development services
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes with tests
4. Ensure all quality checks pass
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Development Guidelines

- Follow existing code style and conventions
- Write comprehensive tests for new features
- Update documentation for significant changes
- Ensure all CI/CD checks pass
- Use descriptive commit messages

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by Studio Ghibli's beautiful art and storytelling
- Built with modern web development best practices
- Thanks to the open-source community for amazing tools and libraries

---

**Happy coding! 🎨🚀**
