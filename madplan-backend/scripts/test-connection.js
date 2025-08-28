#!/usr/bin/env node

/**
 * MongoDB Connection Test Script
 * 
 * This script tests the MongoDB connection using the configured environment variables.
 * It performs basic CRUD operations to verify database connectivity.
 * 
 * Usage: npm run test:connection
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

async function testConnection() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE_NAME || 'madplan';

  if (!uri) {
    console.error('❌ Error: MONGODB_URI environment variable is not set');
    console.error('   Please check your .env file');
    process.exit(1);
  }

  console.log('🔄 Testing MongoDB connection...');
  console.log(`📍 Database: ${dbName}`);
  console.log(`🌐 URI: ${uri.replace(/\/\/.*:.*@/, '//***:***@')}`); // Hide credentials in logs

  const client = new MongoClient(uri);

  try {
    // Connect to MongoDB
    console.log('\n⏳ Connecting to MongoDB Atlas...');
    await client.connect();
    console.log('✅ Connected successfully to MongoDB Atlas');

    // Access the database
    const db = client.db(dbName);
    console.log(`✅ Database "${dbName}" accessed successfully`);

    // Test collection operations
    const testCollection = db.collection('connection_test');
    
    // 1. INSERT TEST
    console.log('\n🔄 Testing INSERT operation...');
    const testDoc = {
      _id: 'connection-test-' + Date.now(),
      message: 'Hello from connection test!',
      timestamp: new Date(),
      test: true
    };
    
    const insertResult = await testCollection.insertOne(testDoc);
    console.log('✅ INSERT successful:', insertResult.insertedId);

    // 2. READ TEST
    console.log('\n🔄 Testing READ operation...');
    const foundDoc = await testCollection.findOne({ _id: testDoc._id });
    if (foundDoc) {
      console.log('✅ READ successful:', foundDoc.message);
    } else {
      throw new Error('Document not found after insert');
    }

    // 3. UPDATE TEST
    console.log('\n🔄 Testing UPDATE operation...');
    const updateResult = await testCollection.updateOne(
      { _id: testDoc._id },
      { $set: { message: 'Updated message!', updated: new Date() } }
    );
    console.log('✅ UPDATE successful, modified count:', updateResult.modifiedCount);

    // 4. DELETE TEST
    console.log('\n🔄 Testing DELETE operation...');
    const deleteResult = await testCollection.deleteOne({ _id: testDoc._id });
    console.log('✅ DELETE successful, deleted count:', deleteResult.deletedCount);

    // 5. LIST COLLECTIONS
    console.log('\n🔄 Listing available collections...');
    const collections = await db.listCollections().toArray();
    console.log('✅ Available collections:', collections.map(c => c.name).join(', ') || '(none yet)');

    console.log('\n🎉 All database operations completed successfully!');
    console.log('✅ MongoDB Atlas connection is working properly');
    console.log('✅ Database is ready for application development');

  } catch (error) {
    console.error('\n❌ Connection test failed:', error.message);
    
    // Provide helpful error messages
    if (error.message.includes('authentication failed')) {
      console.error('💡 Check your database username and password in MONGODB_URI');
    } else if (error.message.includes('network')) {
      console.error('💡 Check your network connection and MongoDB Atlas network access settings');
    } else if (error.message.includes('timeout')) {
      console.error('💡 Connection timeout - check if your IP is whitelisted in MongoDB Atlas');
    }
    
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n🔐 Connection closed');
  }
}

// Run the test
testConnection().catch(console.error);