# MongoDB Connection Verification Guide

This document outlines the steps to verify MongoDB Atlas connectivity for the MadPlan backend application.

## Quick Verification

Run the automated connection test script:
```bash
npm run test:connection
```

## What the Test Validates

The connection test script performs the following operations:

1. **Connection Establishment** ✅
   - Connects to MongoDB Atlas using the configured URI
   - Validates authentication credentials
   - Confirms network access

2. **Database Access** ✅
   - Accesses the specified database (`madplan`)
   - Confirms database permissions

3. **CRUD Operations** ✅
   - **CREATE**: Inserts a test document
   - **READ**: Retrieves the inserted document
   - **UPDATE**: Modifies the document
   - **DELETE**: Removes the test document

4. **Collections Listing** ✅
   - Lists available collections in the database
   - Confirms database structure access

## Expected Output

A successful test will show:
```
🔄 Testing MongoDB connection...
📍 Database: madplan
🌐 URI: mongodb+srv://***:***@madplan-dev.iiosjam.mongodb.net/madplan?...

⏳ Connecting to MongoDB Atlas...
✅ Connected successfully to MongoDB Atlas
✅ Database "madplan" accessed successfully

🔄 Testing INSERT operation...
✅ INSERT successful: [document-id]

🔄 Testing READ operation...
✅ READ successful: Hello from connection test!

🔄 Testing UPDATE operation...
✅ UPDATE successful, modified count: 1

🔄 Testing DELETE operation...
✅ DELETE successful, deleted count: 1

🔄 Listing available collections...
✅ Available collections: [collection names]

🎉 All database operations completed successfully!
✅ MongoDB Atlas connection is working properly
✅ Database is ready for application development

🔐 Connection closed
```

## Troubleshooting

### Common Issues

**Authentication Failed**
- Check username and password in `MONGODB_URI`
- Verify database user exists in MongoDB Atlas
- Confirm user has proper permissions

**Network Timeout**
- Check IP whitelist in MongoDB Atlas Network Access
- Verify internet connectivity
- Confirm cluster is running

**Database Access Denied**
- Verify database name in connection string
- Check user permissions for the target database

### Manual Verification Steps

For additional verification, you can also:

1. **Atlas Dashboard Check**
   - Log into MongoDB Atlas
   - Verify cluster is running (green status)
   - Check recent connections in monitoring

2. **Connection String Validation**
   - Ensure all placeholders are replaced
   - Verify cluster name matches Atlas
   - Confirm database name is correct

3. **Environment Variables Check**
   ```bash
   # Check if environment variables are loaded
   node -e "require('dotenv').config(); console.log('URI:', process.env.MONGODB_URI ? 'Set' : 'Missing');"
   ```

## Integration with Development Workflow

This verification should be run:
- After initial MongoDB Atlas setup
- Before starting backend development
- After any connection configuration changes
- As part of CI/CD pipeline (future)

The connection test is automatically available via the `npm run test:connection` script and can be integrated into development workflows.