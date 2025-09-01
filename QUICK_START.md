# MadPlan Quick Start Guide

Get up and running with MadPlan development in 10 minutes.

## 🚀 Prerequisites (5 minutes)

Install these tools if you haven't already:

```bash
# Check if you have Node.js 18+
node --version

# If not installed, visit https://nodejs.org or use nvm:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
```

## 🏃‍♂️ 3-Step Setup

### Step 1: Clone and Install (2 minutes)

```bash
# Clone repositories
git clone https://github.com/zhangjinglearning/grr-agents.git

# Install backend dependencies
cd madplan-backend
npm install

# Install frontend dependencies
cd ../madplan-frontend
npm install
```

### Step 2: Environment Configuration (2 minutes)

**Backend setup:**
```bash
cd madplan-backend
cp .env.template .env

# Edit .env file - replace these values:
# MONGODB_URI=your-mongodb-atlas-connection-string
# JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
```

**Frontend setup:**
```bash
cd ../madplan-frontend
cp .env.local.template .env.local

# .env.local is already configured for local development
# No changes needed for quick start
```

### Step 3: Start Development Servers (1 minute)

```bash
# Terminal 1: Start backend
cd madplan-backend
npm run start:dev

# Terminal 2: Start frontend
cd madplan-frontend
npm run dev
```

## 🎉 You're Ready!

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000/api/health
- **GraphQL Playground**: http://localhost:3000/graphql

## 🛠 Common Commands

```bash
# Backend commands
npm run start:dev      # Start with hot reload
npm run build         # Build for production
npm test              # Run tests
npm run lint          # Check code style

# Frontend commands  
npm run dev           # Start development server
npm run build         # Build for production
npm test              # Run tests
npm run type-check    # Check TypeScript
```

## 📱 Test Your Setup

1. **Open frontend**: http://localhost:5173
2. **Check backend health**: http://localhost:3000/api/health
3. **Try GraphQL**: http://localhost:3000/graphql

## 🐛 Having Issues?

**Most common fixes:**

```bash
# Port conflicts
PORT=3001 npm run start:dev  # Backend
npm run dev -- --port 5174   # Frontend

# Module not found
rm -rf node_modules package-lock.json
npm install

# Permission errors (macOS/Linux)
sudo chown -R $(whoami) ~/.npm
```

**Still stuck?** See [TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md)

## 🎯 Next Steps

1. **Make your first change**: Edit `src/App.vue` in frontend
2. **Explore GraphQL**: Try queries in the playground
3. **Run tests**: `npm test` in both directories
4. **Read the docs**: [DEVELOPMENT_SETUP_GUIDE.md](./DEVELOPMENT_SETUP_GUIDE.md)

## 🗄 Optional: Local Database

Want to use local MongoDB instead of Atlas?

```bash
# Start local MongoDB with Docker
docker-compose up -d

# Update backend .env
MONGODB_URI=mongodb://localhost:27017/madplan-dev

# Seed sample data
npm run seed:dev  # (if script exists)
```

Database admin interface: http://localhost:8081 (admin/admin123)

## 🤝 Getting Help

- **Issues**: Create GitHub issue
- **Questions**: Check existing docs
- **Urgent**: Email dev-team@madplan.com

Happy coding! 🎨🚀