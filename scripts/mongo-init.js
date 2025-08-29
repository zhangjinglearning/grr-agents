// MadPlan MongoDB Initialization Script
// This script runs when MongoDB container starts for the first time
// It creates the development database and collections with sample data

print('=== MadPlan MongoDB Initialization ===');

// Switch to the madplan-dev database
db = db.getSiblingDB('madplan-dev');

// Create application user with appropriate permissions
db.createUser({
  user: 'madplan_app_user',
  pwd: 'madplan_app_password',
  roles: [
    {
      role: 'readWrite',
      db: 'madplan-dev'
    }
  ]
});

print('✅ Created application user: madplan_app_user');

// Create collections with validation schemas

// Users collection
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['email', 'username', 'createdAt'],
      properties: {
        email: {
          bsonType: 'string',
          description: 'User email address - required and must be a string'
        },
        username: {
          bsonType: 'string',
          description: 'User display name - required and must be a string'
        },
        passwordHash: {
          bsonType: 'string',
          description: 'Hashed password - must be a string'
        },
        createdAt: {
          bsonType: 'date',
          description: 'User creation timestamp - required and must be a date'
        },
        updatedAt: {
          bsonType: 'date',
          description: 'User last update timestamp - must be a date'
        }
      }
    }
  }
});

print('✅ Created users collection with validation schema');

// Boards collection
db.createCollection('boards', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['title', 'ownerId', 'createdAt'],
      properties: {
        title: {
          bsonType: 'string',
          description: 'Board title - required and must be a string'
        },
        description: {
          bsonType: 'string',
          description: 'Board description - must be a string'
        },
        ownerId: {
          bsonType: 'objectId',
          description: 'Board owner user ID - required and must be an ObjectId'
        },
        isPublic: {
          bsonType: 'bool',
          description: 'Board visibility - must be a boolean'
        },
        createdAt: {
          bsonType: 'date',
          description: 'Board creation timestamp - required and must be a date'
        },
        updatedAt: {
          bsonType: 'date',
          description: 'Board last update timestamp - must be a date'
        }
      }
    }
  }
});

print('✅ Created boards collection with validation schema');

// Lists collection
db.createCollection('lists', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['title', 'boardId', 'position', 'createdAt'],
      properties: {
        title: {
          bsonType: 'string',
          description: 'List title - required and must be a string'
        },
        boardId: {
          bsonType: 'objectId',
          description: 'Parent board ID - required and must be an ObjectId'
        },
        position: {
          bsonType: 'int',
          description: 'List position in board - required and must be an integer'
        },
        createdAt: {
          bsonType: 'date',
          description: 'List creation timestamp - required and must be a date'
        },
        updatedAt: {
          bsonType: 'date',
          description: 'List last update timestamp - must be a date'
        }
      }
    }
  }
});

print('✅ Created lists collection with validation schema');

// Cards collection
db.createCollection('cards', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['title', 'listId', 'position', 'createdAt'],
      properties: {
        title: {
          bsonType: 'string',
          description: 'Card title - required and must be a string'
        },
        description: {
          bsonType: 'string',
          description: 'Card description - must be a string'
        },
        listId: {
          bsonType: 'objectId',
          description: 'Parent list ID - required and must be an ObjectId'
        },
        position: {
          bsonType: 'int',
          description: 'Card position in list - required and must be an integer'
        },
        assigneeId: {
          bsonType: 'objectId',
          description: 'Assigned user ID - must be an ObjectId'
        },
        dueDate: {
          bsonType: 'date',
          description: 'Card due date - must be a date'
        },
        priority: {
          bsonType: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Card priority level'
        },
        tags: {
          bsonType: 'array',
          items: {
            bsonType: 'string'
          },
          description: 'Array of tags'
        },
        createdAt: {
          bsonType: 'date',
          description: 'Card creation timestamp - required and must be a date'
        },
        updatedAt: {
          bsonType: 'date',
          description: 'Card last update timestamp - must be a date'
        }
      }
    }
  }
});

print('✅ Created cards collection with validation schema');

// Create indexes for better query performance

// Users indexes
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ createdAt: 1 });

// Boards indexes
db.boards.createIndex({ ownerId: 1 });
db.boards.createIndex({ title: 'text', description: 'text' });
db.boards.createIndex({ createdAt: 1 });

// Lists indexes
db.lists.createIndex({ boardId: 1 });
db.lists.createIndex({ boardId: 1, position: 1 });

// Cards indexes
db.cards.createIndex({ listId: 1 });
db.cards.createIndex({ listId: 1, position: 1 });
db.cards.createIndex({ assigneeId: 1 });
db.cards.createIndex({ dueDate: 1 });
db.cards.createIndex({ priority: 1 });
db.cards.createIndex({ tags: 1 });
db.cards.createIndex({ title: 'text', description: 'text' });

print('✅ Created performance indexes');

// Insert sample development data

const now = new Date();

// Sample users
const sampleUsers = [
  {
    _id: ObjectId(),
    email: 'developer@madplan.com',
    username: 'Developer',
    passwordHash: '$2b$10$example.hash.for.development.use',
    createdAt: now,
    updatedAt: now
  },
  {
    _id: ObjectId(),
    email: 'designer@madplan.com',
    username: 'Designer',
    passwordHash: '$2b$10$example.hash.for.development.use',
    createdAt: now,
    updatedAt: now
  }
];

db.users.insertMany(sampleUsers);
print('✅ Inserted sample users');

// Sample board
const sampleBoard = {
  _id: ObjectId(),
  title: 'MadPlan Development Board',
  description: 'Sample Kanban board for development and testing',
  ownerId: sampleUsers[0]._id,
  isPublic: false,
  createdAt: now,
  updatedAt: now
};

db.boards.insertOne(sampleBoard);
print('✅ Inserted sample board');

// Sample lists
const sampleLists = [
  {
    _id: ObjectId(),
    title: 'To Do',
    boardId: sampleBoard._id,
    position: 0,
    createdAt: now,
    updatedAt: now
  },
  {
    _id: ObjectId(),
    title: 'In Progress',
    boardId: sampleBoard._id,
    position: 1,
    createdAt: now,
    updatedAt: now
  },
  {
    _id: ObjectId(),
    title: 'Done',
    boardId: sampleBoard._id,
    position: 2,
    createdAt: now,
    updatedAt: now
  }
];

db.lists.insertMany(sampleLists);
print('✅ Inserted sample lists');

// Sample cards
const sampleCards = [
  {
    title: 'Set up development environment',
    description: 'Configure local development setup with Docker and environment variables',
    listId: sampleLists[2]._id, // Done
    position: 0,
    assigneeId: sampleUsers[0]._id,
    priority: 'high',
    tags: ['development', 'setup'],
    createdAt: new Date(now.getTime() - 86400000), // 1 day ago
    updatedAt: now
  },
  {
    title: 'Design user interface mockups',
    description: 'Create Ghibli-inspired UI designs for the Kanban board',
    listId: sampleLists[1]._id, // In Progress
    position: 0,
    assigneeId: sampleUsers[1]._id,
    priority: 'medium',
    tags: ['design', 'ui'],
    createdAt: new Date(now.getTime() - 43200000), // 12 hours ago
    updatedAt: now
  },
  {
    title: 'Implement drag and drop functionality',
    description: 'Add drag and drop support for cards between lists',
    listId: sampleLists[0]._id, // To Do
    position: 0,
    priority: 'high',
    tags: ['frontend', 'interaction'],
    createdAt: now,
    updatedAt: now
  },
  {
    title: 'Add user authentication',
    description: 'Implement JWT-based authentication system',
    listId: sampleLists[0]._id, // To Do
    position: 1,
    priority: 'medium',
    tags: ['backend', 'security'],
    dueDate: new Date(now.getTime() + 604800000), // 1 week from now
    createdAt: now,
    updatedAt: now
  }
];

db.cards.insertMany(sampleCards);
print('✅ Inserted sample cards');

// Display summary
print('=== Initialization Complete ===');
print('Database: madplan-dev');
print('Collections created: users, boards, lists, cards');
print('Sample data inserted for development testing');
print('Application user: madplan_app_user');
print('Admin interface available at: http://localhost:8081');
print('Admin credentials: admin / admin123');
print('===================================');