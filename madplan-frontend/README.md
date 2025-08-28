# MadPlan Frontend

[![Frontend CI/CD](https://github.com/USERNAME/REPO_NAME/actions/workflows/ci.yml/badge.svg)](https://github.com/USERNAME/REPO_NAME/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/USERNAME/REPO_NAME/branch/main/graph/badge.svg)](https://codecov.io/gh/USERNAME/REPO_NAME)
[![Vercel Deployment](https://img.shields.io/badge/Vercel-Deployed-success)](https://madplan-frontend.vercel.app)

Studio Ghibli-inspired Kanban board frontend application built with Vue 3, TypeScript, and Tailwind CSS.

## Quick Start

### Prerequisites
- Node.js 20+ 
- npm 9+

### Environment Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   # Copy environment template
   cp .env.template .env.local
   
   # Edit .env.local and set:
   VITE_GRAPHQL_ENDPOINT=http://localhost:3000/graphql
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:5173`

## CI/CD Pipeline

This project uses GitHub Actions for continuous integration and deployment:

- **Continuous Integration**: Automatic testing on pull requests
- **Staging Deployment**: Auto-deploy to staging on merge to main
- **Production Deployment**: Deploy to production on release tags (v*.*.*)

### Pipeline Steps
1. **Lint & Type Check**: ESLint and Vue TSC validation
2. **Unit Tests**: Vitest test suite with coverage reporting
3. **Build Verification**: Vite build validation
4. **Security Audit**: npm audit for vulnerabilities
5. **Deployment**: Automated deployment to Vercel

### Deployment Status
- **Staging**: [https://madplan-frontend-staging.vercel.app](https://madplan-frontend-staging.vercel.app)
- **Production**: [https://madplan-frontend.vercel.app](https://madplan-frontend.vercel.app)

## Development

### Tech Stack
- **Framework**: Vue 3 (~3.4.21) with Composition API
- **Build Tool**: Vite (~5.2.0)
- **Language**: TypeScript (~5.4.5)
- **Styling**: Tailwind CSS (~3.4.3)
- **State Management**: Pinia (~2.1.7)
- **GraphQL Client**: Apollo Client (~3.9.0)
- **Testing**: Vitest (~1.5.0)
- **Router**: Vue Router (~4.3.0)

### Project Structure
```
madplan-frontend/
├── public/                 # Static assets
├── src/
│   ├── components/         # Reusable Vue components
│   ├── views/             # Page components
│   ├── router/            # Vue Router configuration
│   ├── stores/            # Pinia state management
│   ├── services/          # API and business logic
│   ├── assets/            # Images, fonts, etc.
│   ├── App.vue            # Root component
│   └── main.ts            # Application entry point
├── .github/workflows/     # CI/CD pipelines
├── tests/                 # Test files
└── package.json           # Dependencies and scripts
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm run test` - Run unit tests
- `npm run test:coverage` - Run tests with coverage
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_GRAPHQL_ENDPOINT` | Backend GraphQL API URL | Yes |
| `VITE_APP_TITLE` | Application title | No |
| `VITE_APP_VERSION` | Application version | No |

### Development Workflow

1. **Feature Development**
   ```bash
   # Create feature branch
   git checkout -b feature/new-feature
   
   # Make changes and test locally
   npm run dev
   npm run test
   npm run lint
   
   # Build verification
   npm run build
   npm run preview
   ```

2. **Quality Checks**
   ```bash
   # Run all quality checks
   npm run lint
   npm run type-check
   npm run test:coverage
   npm run build
   ```

3. **Commit and Push**
   ```bash
   git add .
   git commit -m "feat: add new feature"
   git push origin feature/new-feature
   ```

### Backend Integration

This frontend connects to the MadPlan NestJS backend via GraphQL:
- **Local Development**: `http://localhost:3000/graphql`
- **Staging**: `https://madplan-backend-staging.onrender.com/graphql`
- **Production**: `https://madplan-backend.onrender.com/graphql`

### Design System

The application follows a Studio Ghibli-inspired design:
- **Color Palette**: Earth tones with green and blue accents
- **Typography**: Clean, readable fonts
- **Components**: Reusable UI components with consistent styling
- **Accessibility**: WCAG 2.1 AA compliance

### Testing Strategy

- **Unit Tests**: Component and utility function tests
- **Integration Tests**: Vue component integration tests
- **E2E Tests**: Full user workflow testing (future)
- **Coverage Target**: 80%+ test coverage

### Performance Optimization

- **Bundle Splitting**: Automatic code splitting by route
- **Lazy Loading**: Dynamic imports for non-critical components
- **Image Optimization**: Responsive images with proper sizing
- **Caching**: Service worker caching for offline support

## Deployment

### Manual Deployment

```bash
# Build for production
npm run build

# Deploy to Vercel (with Vercel CLI)
npx vercel --prod
```

### Automatic Deployment

- **Staging**: Pushes to `main` branch automatically deploy to staging
- **Production**: Creating release tags (v1.0.0) deploys to production

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Ensure all quality checks pass
5. Submit a pull request

### Code Style

- Follow Vue 3 Composition API patterns
- Use TypeScript for type safety
- Follow ESLint configuration
- Write comprehensive tests
- Document complex logic

## Troubleshooting

### Common Issues

**Build Errors**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

**GraphQL Connection Issues**
- Verify `VITE_GRAPHQL_ENDPOINT` is correct
- Check backend service status
- Review browser network tab for CORS errors

**Test Failures**
```bash
# Run tests in watch mode for debugging
npm run test -- --watch
```

For more detailed troubleshooting, see [CI/CD Troubleshooting Guide](../CICD_TROUBLESHOOTING_GUIDE.md).

## Support

- **Documentation**: Project documentation in `/docs`
- **Issues**: GitHub Issues for bug reports and feature requests
- **Discussions**: GitHub Discussions for general questions