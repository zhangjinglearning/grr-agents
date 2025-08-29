#!/usr/bin/env node

/**
 * MadPlan Development Data Seeding Script
 * 
 * This script populates the development database with sample data for testing.
 * Run with: node scripts/seed-development-data.js
 * 
 * Prerequisites:
 * - MongoDB running (local Docker or Atlas)
 * - Environment variables configured
 */

require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');

async function seedDevelopmentData() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE_NAME || 'madplan-dev';

  if (!uri) {
    console.error('❌ Error: MONGODB_URI environment variable is not set');
    process.exit(1);
  }

  console.log('🌱 Seeding development data...');
  console.log(`📍 Database: ${dbName}`);

  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(dbName);
    
    // Clear existing data (development only)
    if (process.env.NODE_ENV === 'development') {
      console.log('🧹 Clearing existing development data...');
      await db.collection('cards').deleteMany({});
      await db.collection('lists').deleteMany({});
      await db.collection('boards').deleteMany({});
      await db.collection('users').deleteMany({});
      console.log('✅ Cleared existing data');
    }

    const now = new Date();

    // Create sample users
    console.log('👥 Creating sample users...');
    const users = [
      {
        _id: new ObjectId(),
        email: 'alice@madplan.dev',
        username: 'Alice Developer',
        passwordHash: '$2b$10$example.hash.for.development.use.only',
        createdAt: now,
        updatedAt: now
      },
      {
        _id: new ObjectId(),
        email: 'bob@madplan.dev',
        username: 'Bob Designer',
        passwordHash: '$2b$10$example.hash.for.development.use.only',
        createdAt: now,
        updatedAt: now
      },
      {
        _id: new ObjectId(),
        email: 'charlie@madplan.dev',
        username: 'Charlie Manager',
        passwordHash: '$2b$10$example.hash.for.development.use.only',
        createdAt: now,
        updatedAt: now
      }
    ];

    await db.collection('users').insertMany(users);
    console.log(`✅ Created ${users.length} sample users`);

    // Create sample boards
    console.log('📋 Creating sample boards...');
    const boards = [
      {
        _id: new ObjectId(),
        title: 'MadPlan Feature Development',
        description: 'Track development progress of MadPlan features',
        ownerId: users[0]._id,
        isPublic: false,
        createdAt: now,
        updatedAt: now
      },
      {
        _id: new ObjectId(),
        title: 'Design System',
        description: 'Ghibli-inspired design system components',
        ownerId: users[1]._id,
        isPublic: true,
        createdAt: now,
        updatedAt: now
      },
      {
        _id: new ObjectId(),
        title: 'Release Planning',
        description: 'Plan and track product releases',
        ownerId: users[2]._id,
        isPublic: false,
        createdAt: now,
        updatedAt: now
      }
    ];

    await db.collection('boards').insertMany(boards);
    console.log(`✅ Created ${boards.length} sample boards`);

    // Create sample lists for each board
    console.log('📝 Creating sample lists...');
    const lists = [];
    
    boards.forEach((board, boardIndex) => {
      const listTitles = [
        ['Backlog', 'In Progress', 'Review', 'Done'],
        ['Ideas', 'Sketches', 'Designs', 'Approved'],
        ['Planned', 'Development', 'Testing', 'Released']
      ];

      listTitles[boardIndex].forEach((title, position) => {
        lists.push({
          _id: new ObjectId(),
          title,
          boardId: board._id,
          position,
          createdAt: now,
          updatedAt: now
        });
      });
    });

    await db.collection('lists').insertMany(lists);
    console.log(`✅ Created ${lists.length} sample lists`);

    // Create sample cards
    console.log('🃏 Creating sample cards...');
    const cards = [];

    // Cards for Feature Development board
    const featureLists = lists.filter(l => l.boardId.equals(boards[0]._id));
    const featureCards = [
      {
        title: 'User Registration System',
        description: 'Implement user signup and login with JWT authentication',
        listId: featureLists[0]._id, // Backlog
        position: 0,
        assigneeId: users[0]._id,
        priority: 'high',
        tags: ['backend', 'authentication', 'security'],
        dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 1 week
      },
      {
        title: 'Drag & Drop Cards',
        description: 'Add HTML5 drag and drop functionality for cards',
        listId: featureLists[1]._id, // In Progress
        position: 0,
        assigneeId: users[0]._id,
        priority: 'medium',
        tags: ['frontend', 'interaction', 'ux'],
      },
      {
        title: 'GraphQL Subscriptions',
        description: 'Real-time updates using GraphQL subscriptions',
        listId: featureLists[2]._id, // Review
        position: 0,
        assigneeId: users[0]._id,
        priority: 'medium',
        tags: ['backend', 'realtime', 'graphql'],
      },
      {
        title: 'Local Development Setup',
        description: 'Docker Compose configuration and environment templates',
        listId: featureLists[3]._id, // Done
        position: 0,
        assigneeId: users[0]._id,
        priority: 'high',
        tags: ['devops', 'setup'],
      }
    ];

    // Cards for Design System board
    const designLists = lists.filter(l => l.boardId.equals(boards[1]._id));
    const designCards = [
      {
        title: 'Color Palette',
        description: 'Define Ghibli-inspired color scheme with earth tones',
        listId: designLists[3]._id, // Approved
        position: 0,
        assigneeId: users[1]._id,
        priority: 'high',
        tags: ['design', 'colors', 'branding'],
      },
      {
        title: 'Card Component Design',
        description: 'Design card component with shadow and hover effects',
        listId: designLists[2]._id, // Designs
        position: 0,
        assigneeId: users[1]._id,
        priority: 'medium',
        tags: ['design', 'components', 'cards'],
      },
      {
        title: 'Typography Scale',
        description: 'Define font sizes and hierarchy for the application',
        listId: designLists[1]._id, // Sketches
        position: 0,
        assigneeId: users[1]._id,
        priority: 'medium',
        tags: ['design', 'typography', 'hierarchy'],
      },
      {
        title: 'Mobile Responsive Layout',
        description: 'Adapt Kanban board for mobile and tablet screens',
        listId: designLists[0]._id, // Ideas
        position: 0,
        assigneeId: users[1]._id,
        priority: 'low',
        tags: ['design', 'mobile', 'responsive'],
      }
    ];

    // Cards for Release Planning board
    const releaseLists = lists.filter(l => l.boardId.equals(boards[2]._id));
    const releaseCards = [
      {
        title: 'v1.0 MVP Release',
        description: 'Basic Kanban functionality with user management',
        listId: releaseLists[1]._id, // Development
        position: 0,
        assigneeId: users[2]._id,
        priority: 'high',
        tags: ['release', 'mvp', 'milestone'],
        dueDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 1 month
      },
      {
        title: 'v1.1 Collaboration Features',
        description: 'Add team collaboration and sharing features',
        listId: releaseLists[0]._id, // Planned
        position: 0,
        assigneeId: users[2]._id,
        priority: 'medium',
        tags: ['release', 'collaboration', 'sharing'],
        dueDate: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000), // 2 months
      },
      {
        title: 'v1.2 Mobile App',
        description: 'Native mobile application for iOS and Android',
        listId: releaseLists[0]._id, // Planned
        position: 1,
        assigneeId: users[2]._id,
        priority: 'low',
        tags: ['release', 'mobile', 'native'],
        dueDate: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000), // 3 months
      }
    ];

    // Combine all cards and add timestamps
    const allCards = [...featureCards, ...designCards, ...releaseCards];
    allCards.forEach((card, index) => {
      card._id = new ObjectId();
      card.createdAt = new Date(now.getTime() - (allCards.length - index) * 60000); // Stagger creation times
      card.updatedAt = now;
    });

    await db.collection('cards').insertMany(allCards);
    console.log(`✅ Created ${allCards.length} sample cards`);

    // Create indexes for performance
    console.log('📊 Creating database indexes...');
    
    await Promise.all([
      // Users indexes
      db.collection('users').createIndex({ email: 1 }, { unique: true }),
      db.collection('users').createIndex({ username: 1 }, { unique: true }),
      
      // Boards indexes
      db.collection('boards').createIndex({ ownerId: 1 }),
      db.collection('boards').createIndex({ title: 'text', description: 'text' }),
      
      // Lists indexes
      db.collection('lists').createIndex({ boardId: 1 }),
      db.collection('lists').createIndex({ boardId: 1, position: 1 }),
      
      // Cards indexes
      db.collection('cards').createIndex({ listId: 1 }),
      db.collection('cards').createIndex({ listId: 1, position: 1 }),
      db.collection('cards').createIndex({ assigneeId: 1 }),
      db.collection('cards').createIndex({ dueDate: 1 }),
      db.collection('cards').createIndex({ priority: 1 }),
      db.collection('cards').createIndex({ tags: 1 }),
      db.collection('cards').createIndex({ title: 'text', description: 'text' })
    ]);

    console.log('✅ Created database indexes');

    console.log('\n🎉 Development data seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   • Users: ${users.length}`);
    console.log(`   • Boards: ${boards.length}`);
    console.log(`   • Lists: ${lists.length}`);
    console.log(`   • Cards: ${allCards.length}`);
    console.log('\n💡 Sample login credentials:');
    console.log('   • alice@madplan.dev / password');
    console.log('   • bob@madplan.dev / password');
    console.log('   • charlie@madplan.dev / password');
    console.log('\n🚀 Start your development servers and enjoy coding!');

  } catch (error) {
    console.error('\n❌ Seeding failed:', error.message);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n🔐 Database connection closed');
  }
}

// Run the seeding script
if (require.main === module) {
  seedDevelopmentData().catch(console.error);
}

module.exports = { seedDevelopmentData };