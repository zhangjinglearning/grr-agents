# MongoDB Atlas Setup Guide for MadPlan

## Step 1: MongoDB Atlas Account Creation

1. Navigate to https://www.mongodb.com/atlas
2. Click "Try Free" or "Sign Up"
3. Create account with your email address
4. Verify your email address

## Step 2: Create M0 Free Tier Cluster

1. After login, click "Create a New Cluster" or "Build a Database"
2. Select "M0 Sandbox" (Free tier)
3. **Important**: Select "us-east-1" region
4. **Cluster Name**: Set to "madplan-dev"
5. Click "Create Cluster"
6. Wait for cluster deployment (typically 3-5 minutes)

## Step 3: Database User Creation

1. In Atlas dashboard, go to "Database Access" (left sidebar)
2. Click "Add New Database User"
3. Authentication Method: "Password"
4. Username: madplan_dev_db_user
5. Password: vmJHv64NaMrt3ND3
6. Database User Privileges: "Built-in Role" -> "Read and write to any database"
7. Click "Add User"

## Step 4: Network Access Configuration

1. Go to "Network Access" (left sidebar)
2. Click "Add IP Address"
3. For development: Click "Allow Access from Anywhere" (0.0.0.0/0)
4. Add comment: "Development access - restrict in production"
5. Click "Confirm"

## Step 5: Get Connection String

1. Go to "Database" (left sidebar)
2. Click "Connect" button for your cluster
3. Select "Connect your application"
4. Driver: Node.js, Version: 4.1 or later
5. Copy the connection string
6. Replace `<password>` with your database user password
7. Replace `<database>` with "madplan" (our database name)

**Your connection string should look like:**
```
mongodb+srv://madplan_dev_db_user:vmJHv64NaMrt3ND3@madplan-dev.iiosjam.mongodb.net/?retryWrites=true&w=majority&appName=madplan-dev
```

## Next Steps

After completing these steps:
1. Save your connection string securely
2. Return to the development process for environment configuration
3. The cluster is ready for backend integration

## Security Notes

- The 0.0.0.0/0 IP whitelist is for development only
- In production, restrict to specific IP addresses
- Keep database credentials secure and never commit to version control
- Use environment variables for connection strings