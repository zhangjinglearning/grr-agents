# MadPlan Development Troubleshooting Guide

Common issues and solutions for MadPlan development environment setup and daily development.

## Table of Contents

1. [Environment Setup Issues](#environment-setup-issues)
2. [Database Connection Issues](#database-connection-issues)
3. [Development Server Issues](#development-server-issues)
4. [Build and Compilation Issues](#build-and-compilation-issues)
5. [Testing Issues](#testing-issues)
6. [IDE and Tooling Issues](#ide-and-tooling-issues)
7. [Performance Issues](#performance-issues)
8. [Networking and CORS Issues](#networking-and-cors-issues)

## Environment Setup Issues

### Issue: "Cannot find module" errors after npm install

**Symptoms:**
```
Error: Cannot find module '@nestjs/core'
Module not found: Can't resolve 'vue'
```

**Solutions:**
1. **Clear npm cache and reinstall:**
   ```bash
   rm -rf node_modules package-lock.json
   npm cache clean --force
   npm install
   ```

2. **Check Node.js version compatibility:**
   ```bash
   node --version  # Should be 18+
   npm --version   # Should be 8+
   ```

3. **Use exact Node.js version (with nvm):**
   ```bash
   nvm install 18.19.0
   nvm use 18.19.0
   ```

### Issue: Environment variables not loading

**Symptoms:**
```
MONGODB_URI is undefined
Environment variables undefined in browser
```

**Solutions:**

**Backend (.env file):**
1. Ensure `.env` file exists in root directory
2. Check file has no BOM (Byte Order Mark)
3. Restart development server after changes
4. Verify with: `console.log(process.env.MONGODB_URI)`

**Frontend (.env.local file):**
1. Ensure variables start with `VITE_`
2. Restart Vite dev server after changes  
3. Check with: `console.log(import.meta.env.VITE_GRAPHQL_ENDPOINT)`

### Issue: Permission denied errors (macOS/Linux)

**Symptoms:**
```
Error: EACCES: permission denied
npm ERR! Error: EACCES: permission denied, mkdir '/usr/local/lib/node_modules'
```

**Solutions:**
1. **Fix npm permissions:**
   ```bash
   mkdir ~/.npm-global
   npm config set prefix '~/.npm-global'
   echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.profile
   source ~/.profile
   ```

2. **Use nvm (recommended):**
   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   nvm install node
   ```

## Database Connection Issues

### Issue: MongoDB connection refused

**Symptoms:**
```
MongoNetworkError: connect ECONNREFUSED 127.0.0.1:27017
Error: getaddrinfo ENOTFOUND cluster.mongodb.net
```

**Solutions:**

**For Local MongoDB:**
1. **Check if MongoDB is running:**
   ```bash
   # Check Docker containers
   docker ps
   
   # Check local MongoDB service
   brew services list | grep mongodb  # macOS
   sudo systemctl status mongod       # Linux
   ```

2. **Start MongoDB:**
   ```bash
   # Docker
   docker-compose up -d mongodb
   
   # Local installation
   brew services start mongodb-community  # macOS
   sudo systemctl start mongod             # Linux
   ```

**For MongoDB Atlas:**
1. **Check network access:**
   - Verify IP whitelist in Atlas (allow 0.0.0.0/0 for development)
   - Check firewall/VPN settings

2. **Verify connection string:**
   ```bash
   # Test with MongoDB CLI
   mongosh "your-connection-string"
   ```

3. **Check credentials:**
   - Ensure database user exists and has correct permissions
   - Verify password doesn't contain special characters needing URL encoding

### Issue: Authentication failed

**Symptoms:**
```
MongoServerError: Authentication failed
MongoServerError: user is not allowed to do action [find] on [dbname.collection]
```

**Solutions:**
1. **Check database user permissions:**
   - User needs `readWrite` role on the database
   - Verify username/password in connection string

2. **Create database user (Atlas):**
   - Go to Database Access → Add New Database User
   - Set username/password
   - Grant `readWrite` permissions

3. **URL encode special characters:**
   ```bash
   # If password contains @, %, or other special chars
   # @ becomes %40, % becomes %25, etc.
   ```

## Development Server Issues

### Issue: Port already in use

**Symptoms:**
```
Error: listen EADDRINUSE: address already in use :::3000
Error: Port 5173 is already in use
```

**Solutions:**

**Find and kill process:**
```bash
# Find process using port 3000
lsof -ti :3000
kill -9 $(lsof -ti :3000)

# Or use npx
npx kill-port 3000
```

**Use different port:**
```bash
# Backend
PORT=3001 npm run start:dev

# Frontend  
npm run dev -- --port 5174
```

**Update configuration:**
```bash
# Backend .env
PORT=3001

# Frontend .env.local
VITE_DEV_PORT=5174

# Update CORS_ORIGINS in backend .env
CORS_ORIGINS=http://localhost:5174
```

### Issue: Hot reload not working

**Symptoms:**
- Changes not reflected automatically
- Need to manually refresh browser
- TypeScript changes not detected

**Solutions:**

**Backend (NestJS):**
1. **Check watch mode:**
   ```bash
   npm run start:dev  # Should use --watch flag
   ```

2. **Clear dist folder:**
   ```bash
   rm -rf dist
   npm run build
   npm run start:dev
   ```

**Frontend (Vite):**
1. **Check HMR configuration:**
   ```javascript
   // vite.config.ts
   server: {
     hmr: {
       overlay: true
     }
   }
   ```

2. **Disable browser cache during development**
3. **Check file watchers limit (Linux):**
   ```bash
   echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
   sudo sysctl -p
   ```

## Build and Compilation Issues

### Issue: TypeScript compilation errors

**Symptoms:**
```
TS2307: Cannot find module 'vue' or its corresponding type declarations
TS2322: Type 'string' is not assignable to type 'number'
```

**Solutions:**

**Frontend (Vue + TypeScript):**
1. **Check Vue TypeScript setup:**
   ```bash
   # Ensure correct Volar extensions are installed
   # Disable Vetur if using Volar
   ```

2. **Update type declarations:**
   ```bash
   npm install --save-dev @types/node
   ```

3. **Check tsconfig.json:**
   ```json
   {
     "compilerOptions": {
       "moduleResolution": "node",
       "allowSyntheticDefaultImports": true,
       "strict": true
     },
     "include": ["src/**/*", "vite.config.ts"]
   }
   ```

**Backend (NestJS + TypeScript):**
1. **Clear build cache:**
   ```bash
   rm -rf dist
   npm run build
   ```

2. **Check decorator support:**
   ```json
   // tsconfig.json
   {
     "compilerOptions": {
       "experimentalDecorators": true,
       "emitDecoratorMetadata": true
     }
   }
   ```

### Issue: Build fails with memory errors

**Symptoms:**
```
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed
JavaScript heap out of memory
```

**Solutions:**
1. **Increase Node.js memory limit:**
   ```bash
   export NODE_OPTIONS="--max-old-space-size=4096"
   npm run build
   ```

2. **Add to package.json scripts:**
   ```json
   {
     "scripts": {
       "build": "NODE_OPTIONS=--max-old-space-size=4096 vite build"
     }
   }
   ```

## Testing Issues

### Issue: Jest/Vitest tests failing

**Symptoms:**
```
Cannot find module from test file
ReferenceError: TextEncoder is not defined
```

**Solutions:**

**Backend (Jest):**
1. **Check test environment:**
   ```json
   // package.json
   {
     "jest": {
       "testEnvironment": "node",
       "moduleFileExtensions": ["js", "json", "ts"],
       "rootDir": "src",
       "testRegex": ".*\\.spec\\.ts$",
       "transform": {
         "^.+\\.(t|j)s$": "ts-jest"
       }
     }
   }
   ```

2. **Mock environment variables:**
   ```javascript
   // test/setup.ts
   process.env.NODE_ENV = 'test';
   process.env.JWT_SECRET = 'test-secret';
   ```

**Frontend (Vitest):**
1. **Check vitest.config.ts:**
   ```javascript
   export default defineConfig({
     test: {
       environment: 'jsdom',
       globals: true,
       setupFiles: ['src/test/setup.ts']
     }
   })
   ```

2. **Install missing dependencies:**
   ```bash
   npm install --save-dev jsdom @vitest/ui
   ```

### Issue: GraphQL tests failing

**Symptoms:**
```
GraphQL schema not found
Cannot execute GraphQL query in tests
```

**Solutions:**
1. **Mock GraphQL client:**
   ```javascript
   import { createMockClient } from 'mock-apollo-client';
   
   const mockClient = createMockClient();
   ```

2. **Use test database:**
   ```bash
   # In test environment
   MONGODB_URI=mongodb://localhost:27017/madplan-test
   ```

## IDE and Tooling Issues

### Issue: VS Code Volar/Vetur conflicts

**Symptoms:**
- Duplicate TypeScript errors
- Vue files not highlighting correctly
- Conflicting auto-completion

**Solutions:**
1. **Disable Vetur if using Volar:**
   - Open VS Code Extensions
   - Search "Vetur" and disable
   - Keep "Vue Language Features (Volar)" enabled

2. **Configure workspace settings:**
   ```json
   // .vscode/settings.json
   {
     "vetur.validation.template": false,
     "vetur.validation.script": false,
     "vetur.validation.style": false
   }
   ```

### Issue: ESLint/Prettier conflicts

**Symptoms:**
```
Delete `⏎` prettier/prettier
Parsing error: Unexpected token
```

**Solutions:**
1. **Update ESLint config:**
   ```json
   // .eslintrc.js
   {
     "extends": [
       "eslint:recommended",
       "prettier"
     ],
     "rules": {
       "prettier/prettier": "error"
     }
   }
   ```

2. **Install prettier-eslint:**
   ```bash
   npm install --save-dev eslint-config-prettier eslint-plugin-prettier
   ```

## Performance Issues

### Issue: Slow development server startup

**Symptoms:**
- Long wait times for server start
- Slow hot reload
- High CPU usage

**Solutions:**

**Backend optimization:**
1. **Use incremental compilation:**
   ```bash
   # In .env
   TS_INCREMENTAL=true
   ```

2. **Exclude unnecessary files:**
   ```json
   // tsconfig.json
   {
     "exclude": ["node_modules", "dist", "test"]
   }
   ```

**Frontend optimization:**
1. **Configure Vite for performance:**
   ```javascript
   // vite.config.ts
   {
     optimizeDeps: {
       include: ['vue', 'vue-router', '@apollo/client']
     },
     server: {
       fs: {
         strict: false
       }
     }
   }
   ```

2. **Use SWC instead of TypeScript (if needed):**
   ```bash
   npm install --save-dev @swc/core
   ```

### Issue: Large bundle sizes

**Symptoms:**
- Slow production builds
- Large JavaScript bundles
- Poor loading performance

**Solutions:**
1. **Analyze bundle:**
   ```bash
   npm run build -- --analyze  # If configured
   # Or use webpack-bundle-analyzer
   ```

2. **Configure code splitting:**
   ```javascript
   // vite.config.ts
   build: {
     rollupOptions: {
       output: {
         manualChunks: {
           vendor: ['vue', 'vue-router'],
           apollo: ['@apollo/client']
         }
       }
     }
   }
   ```

## Networking and CORS Issues

### Issue: CORS errors in browser

**Symptoms:**
```
Access to XMLHttpRequest blocked by CORS policy
Cross-Origin Request Blocked
```

**Solutions:**

1. **Check backend CORS configuration:**
   ```typescript
   // main.ts
   app.enableCors({
     origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'],
     credentials: true,
   });
   ```

2. **Update environment variables:**
   ```bash
   # Backend .env
   CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
   ```

3. **Use Vite proxy for development:**
   ```javascript
   // vite.config.ts
   server: {
     proxy: {
       '/graphql': 'http://localhost:3000',
       '/api': 'http://localhost:3000'
     }
   }
   ```

### Issue: GraphQL requests failing

**Symptoms:**
```
NetworkError: Failed to fetch
GraphQL endpoint not reachable
```

**Solutions:**
1. **Check endpoint URL:**
   ```javascript
   // Verify in browser DevTools Network tab
   console.log(import.meta.env.VITE_GRAPHQL_ENDPOINT);
   ```

2. **Test GraphQL endpoint directly:**
   ```bash
   curl -X POST http://localhost:3000/graphql \
        -H "Content-Type: application/json" \
        -d '{"query": "{ __typename }"}'
   ```

3. **Check GraphQL Playground:**
   - Visit http://localhost:3000/graphql
   - Should load GraphQL Playground interface

## Getting Help

If you're still experiencing issues:

1. **Check the logs:**
   ```bash
   # Backend logs
   npm run start:dev
   
   # Frontend logs  
   npm run dev
   
   # Docker logs
   docker-compose logs -f
   ```

2. **Search existing issues:**
   - Check GitHub issues for similar problems
   - Search Stack Overflow with specific error messages

3. **Create minimal reproduction:**
   - Isolate the issue to smallest possible example
   - Include environment details (OS, Node version, etc.)

4. **Contact the team:**
   - Create GitHub issue with reproduction steps
   - Join our Discord for real-time help
   - Email: dev-support@madplan.com

## Useful Commands

```bash
# System information
node --version && npm --version
git --version
docker --version

# Clear all caches
npm cache clean --force
rm -rf node_modules package-lock.json
npm install

# Reset development environment
docker-compose down -v
docker-compose up -d
npm run seed:dev

# Health checks
curl http://localhost:3000/api/health
curl http://localhost:5173
```