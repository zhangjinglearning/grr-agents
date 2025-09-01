#!/usr/bin/env node

/**
 * Database Migration Script for MadPlan Backend
 * Handles database schema migrations, data migrations, and rollbacks
 */

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
const process = require('process');

const MIGRATION_CONFIG = {
  migrationsPath: path.join(process.cwd(), 'migrations'),
  collectionName: 'migrations',
  batchSize: 1000,
  timeout: 300000, // 5 minutes
};

class MigrationRunner {
  constructor() {
    this.client = null;
    this.db = null;
    this.migrationsCollection = null;
  }

  async connect() {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is required');
    }

    console.log('🔌 Connecting to MongoDB...');
    this.client = new MongoClient(mongoUri, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: MIGRATION_CONFIG.timeout,
    });

    await this.client.connect();
    this.db = this.client.db();
    this.migrationsCollection = this.db.collection(MIGRATION_CONFIG.collectionName);

    console.log('✅ Connected to MongoDB successfully');
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      console.log('🔌 Disconnected from MongoDB');
    }
  }

  async initializeMigrationsCollection() {
    const exists = await this.migrationsCollection.findOne({});
    if (!exists) {
      console.log('📋 Initializing migrations collection...');
      await this.migrationsCollection.createIndex({ version: 1 }, { unique: true });
      await this.migrationsCollection.createIndex({ appliedAt: 1 });
      console.log('✅ Migrations collection initialized');
    }
  }

  async getAppliedMigrations() {
    const applied = await this.migrationsCollection
      .find({}, { projection: { version: 1, appliedAt: 1 } })
      .sort({ version: 1 })
      .toArray();
    
    return applied.map(m => ({
      version: m.version,
      appliedAt: m.appliedAt,
    }));
  }

  async getAvailableMigrations() {
    const migrationsDir = MIGRATION_CONFIG.migrationsPath;
    
    if (!fs.existsSync(migrationsDir)) {
      console.log(`📁 Creating migrations directory: ${migrationsDir}`);
      fs.mkdirSync(migrationsDir, { recursive: true });
      return [];
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.js'))
      .sort();

    const migrations = [];
    
    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const version = this.extractVersionFromFilename(file);
      
      if (version) {
        try {
          const migration = require(filePath);
          migrations.push({
            version,
            filename: file,
            filepath: filePath,
            migration,
          });
        } catch (error) {
          console.error(`❌ Error loading migration ${file}: ${error.message}`);
          throw error;
        }
      }
    }

    return migrations;
  }

  extractVersionFromFilename(filename) {
    // Expected format: YYYYMMDDHHMMSS_description.js
    const match = filename.match(/^(\d{14})_.*\.js$/);
    return match ? match[1] : null;
  }

  async getPendingMigrations() {
    const [applied, available] = await Promise.all([
      this.getAppliedMigrations(),
      this.getAvailableMigrations(),
    ]);

    const appliedVersions = new Set(applied.map(m => m.version));
    return available.filter(m => !appliedVersions.has(m.version));
  }

  async runMigration(migration) {
    const { version, filename, migration: migrationModule } = migration;

    console.log(`🚀 Running migration: ${filename}`);
    
    if (!migrationModule.up || typeof migrationModule.up !== 'function') {
      throw new Error(`Migration ${filename} must export an 'up' function`);
    }

    const startTime = Date.now();
    
    try {
      // Run the migration
      await migrationModule.up(this.db);
      
      // Record successful migration
      await this.migrationsCollection.insertOne({
        version,
        filename,
        appliedAt: new Date(),
        executionTimeMs: Date.now() - startTime,
        success: true,
      });

      console.log(`✅ Migration ${filename} completed successfully (${Date.now() - startTime}ms)`);
    } catch (error) {
      // Record failed migration
      await this.migrationsCollection.insertOne({
        version,
        filename,
        appliedAt: new Date(),
        executionTimeMs: Date.now() - startTime,
        success: false,
        error: error.message,
      });

      console.error(`❌ Migration ${filename} failed: ${error.message}`);
      throw error;
    }
  }

  async rollbackMigration(migration) {
    const { version, filename, migration: migrationModule } = migration;

    console.log(`🔄 Rolling back migration: ${filename}`);
    
    if (!migrationModule.down || typeof migrationModule.down !== 'function') {
      throw new Error(`Migration ${filename} must export a 'down' function for rollback`);
    }

    const startTime = Date.now();
    
    try {
      // Run the rollback
      await migrationModule.down(this.db);
      
      // Remove migration record
      await this.migrationsCollection.deleteOne({ version });

      console.log(`✅ Rollback ${filename} completed successfully (${Date.now() - startTime}ms)`);
    } catch (error) {
      console.error(`❌ Rollback ${filename} failed: ${error.message}`);
      throw error;
    }
  }

  async runPendingMigrations() {
    const pending = await this.getPendingMigrations();

    if (pending.length === 0) {
      console.log('✅ No pending migrations found');
      return;
    }

    console.log(`📋 Found ${pending.length} pending migrations`);

    for (const migration of pending) {
      await this.runMigration(migration);
    }

    console.log('🎉 All pending migrations completed successfully');
  }

  async rollbackLastMigration() {
    const applied = await this.getAppliedMigrations();
    
    if (applied.length === 0) {
      console.log('📋 No migrations to rollback');
      return;
    }

    const lastMigration = applied[applied.length - 1];
    const available = await this.getAvailableMigrations();
    const migrationToRollback = available.find(m => m.version === lastMigration.version);

    if (!migrationToRollback) {
      throw new Error(`Migration file for version ${lastMigration.version} not found`);
    }

    await this.rollbackMigration(migrationToRollback);
    console.log('✅ Last migration rolled back successfully');
  }

  async showMigrationStatus() {
    const [applied, available] = await Promise.all([
      this.getAppliedMigrations(),
      this.getAvailableMigrations(),
    ]);

    console.log('\n📊 Migration Status:');
    console.log('═══════════════════════════════════════════════════════════');

    if (available.length === 0) {
      console.log('📋 No migrations found');
      return;
    }

    const appliedVersions = new Set(applied.map(m => m.version));

    for (const migration of available) {
      const isApplied = appliedVersions.has(migration.version);
      const status = isApplied ? '✅ Applied' : '⏳ Pending';
      const appliedInfo = isApplied 
        ? applied.find(m => m.version === migration.version) 
        : null;
      
      console.log(`${status} | ${migration.version} | ${migration.filename}`);
      
      if (appliedInfo) {
        console.log(`     Applied: ${appliedInfo.appliedAt.toISOString()}`);
      }
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Total: ${available.length} | Applied: ${applied.length} | Pending: ${available.length - applied.length}`);
  }
}

// Migration template generator
function generateMigrationTemplate(description) {
  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const filename = `${timestamp}_${description.replace(/\s+/g, '_').toLowerCase()}.js`;
  const filepath = path.join(MIGRATION_CONFIG.migrationsPath, filename);

  const template = `/**
 * Migration: ${description}
 * Generated: ${new Date().toISOString()}
 */

module.exports = {
  async up(db) {
    // Migration logic goes here
    console.log('Running migration: ${description}');
    
    // Example: Create a collection with indexes
    // await db.createCollection('new_collection');
    // await db.collection('new_collection').createIndex({ field: 1 });
    
    // Example: Update documents
    // await db.collection('existing_collection').updateMany(
    //   { oldField: { $exists: true } },
    //   { $rename: { oldField: 'newField' } }
    // );
    
    console.log('Migration completed: ${description}');
  },

  async down(db) {
    // Rollback logic goes here
    console.log('Rolling back migration: ${description}');
    
    // Example: Drop a collection
    // await db.collection('new_collection').drop();
    
    // Example: Revert document updates
    // await db.collection('existing_collection').updateMany(
    //   { newField: { $exists: true } },
    //   { $rename: { newField: 'oldField' } }
    // );
    
    console.log('Rollback completed: ${description}');
  }
};
`;

  if (!fs.existsSync(MIGRATION_CONFIG.migrationsPath)) {
    fs.mkdirSync(MIGRATION_CONFIG.migrationsPath, { recursive: true });
  }

  fs.writeFileSync(filepath, template);
  console.log(`✅ Generated migration: ${filename}`);
  console.log(`📁 Location: ${filepath}`);
}

// Command line interface
async function main() {
  const command = process.argv[2];
  const args = process.argv.slice(3);

  if (!command) {
    console.log(`
Usage: npm run migration:run [command] [args]

Commands:
  run                     Run all pending migrations
  rollback               Rollback the last migration
  status                 Show migration status
  create <description>   Create a new migration file

Examples:
  npm run migration:run run
  npm run migration:run rollback
  npm run migration:run status
  npm run migration:run create "add user preferences"
`);
    return;
  }

  const runner = new MigrationRunner();

  try {
    switch (command) {
      case 'create':
        if (!args[0]) {
          console.error('❌ Migration description is required');
          process.exit(1);
        }
        generateMigrationTemplate(args[0]);
        break;

      case 'run':
        await runner.connect();
        await runner.initializeMigrationsCollection();
        await runner.runPendingMigrations();
        break;

      case 'rollback':
        await runner.connect();
        await runner.initializeMigrationsCollection();
        await runner.rollbackLastMigration();
        break;

      case 'status':
        await runner.connect();
        await runner.initializeMigrationsCollection();
        await runner.showMigrationStatus();
        break;

      default:
        console.error(`❌ Unknown command: ${command}`);
        process.exit(1);
    }
  } catch (error) {
    console.error('💥 Migration error:', error);
    process.exit(1);
  } finally {
    await runner.disconnect();
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the CLI
if (require.main === module) {
  main().catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { MigrationRunner };