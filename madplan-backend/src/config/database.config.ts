import { registerAs } from '@nestjs/config';

export interface DatabaseConnectionConfig {
  uri: string;
  options: {
    maxPoolSize: number;
    minPoolSize: number;
    maxIdleTimeMS: number;
    waitQueueTimeoutMS: number;
    serverSelectionTimeoutMS: number;
    socketTimeoutMS: number;
    bufferMaxEntries: number;
    retryWrites: boolean;
    readPreference: string;

    writeConcern: { w: string | number; j: boolean };
  };
}

export interface DatabaseConfig {
  primary: DatabaseConnectionConfig;
  readonly?: DatabaseConnectionConfig;
  analytics: DatabaseConnectionConfig;
  connectionPooling: {
    enabled: boolean;
    monitorCommands: boolean;
    maxConnecting: number;
    heartbeatFrequencyMS: number;
  };
  clustering: {
    enabled: boolean;
    readReplicasEnabled: boolean;
    loadBalancing: {
      strategy: 'round-robin' | 'nearest' | 'primary-preferred';
      maxStalenessSeconds: number;
    };
  };
  monitoring: {
    slowQueryThreshold: number;
    enableProfiling: boolean;
    enableMetrics: boolean;
    logLevel: 'error' | 'warn' | 'info' | 'debug';
  };
  backup: {
    pointInTimeRecovery: boolean;
    retentionDays: number;
  };
}

export default registerAs('database', (): DatabaseConfig => {
  const environment = process.env.NODE_ENV || 'development';
  const isProduction = environment === 'production';
  
  // Connection pool settings optimized for production clustering
  const connectionOptions = {
    maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE || '100'),
    minPoolSize: parseInt(process.env.DB_MIN_POOL_SIZE || '10'),
    maxIdleTimeMS: parseInt(process.env.DB_MAX_IDLE_TIME_MS || '300000'),
    waitQueueTimeoutMS: parseInt(process.env.DB_WAIT_QUEUE_TIMEOUT_MS || '30000'),
    serverSelectionTimeoutMS: parseInt(process.env.DB_SERVER_SELECTION_TIMEOUT_MS || '5000'),
    socketTimeoutMS: parseInt(process.env.DB_SOCKET_TIMEOUT_MS || '0'),
    bufferMaxEntries: parseInt(process.env.DB_BUFFER_MAX_ENTRIES || '0'),
    retryWrites: true,
  };

  // Primary database connection (read-write)
  const primaryConfig: DatabaseConnectionConfig = {
    uri: process.env.DATABASE_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/madplan',
    options: {
      ...connectionOptions,
      readPreference: 'primary',

      writeConcern: { w: 'majority', j: true },
    },
  };

  // Read replica configuration (read-only)
  const readonlyConfig: DatabaseConnectionConfig | undefined = process.env.DATABASE_READONLY_URL
    ? {
        uri: process.env.DATABASE_READONLY_URL,
        options: {
          ...connectionOptions,
          maxPoolSize: Math.max(10, Math.floor(connectionOptions.maxPoolSize / 2)),
          minPoolSize: Math.max(2, Math.floor(connectionOptions.minPoolSize / 2)),
          readPreference: 'secondary',

          writeConcern: { w: 'majority', j: true },
        },
      }
    : undefined;

  // Analytics database connection
  const analyticsConfig: DatabaseConnectionConfig = {
    uri: process.env.DATABASE_ANALYTICS_URL || primaryConfig.uri.replace(/\/[^/]+$/, '/analytics'),
    options: {
      ...connectionOptions,
      maxPoolSize: Math.max(20, Math.floor(connectionOptions.maxPoolSize / 3)),
      minPoolSize: Math.max(5, Math.floor(connectionOptions.minPoolSize / 2)),
      readPreference: readonlyConfig ? 'secondary' : 'secondaryPreferred',

      writeConcern: { w: 'majority', j: false }, // Relaxed for analytics
    },
  };

  return {
    primary: primaryConfig,
    readonly: readonlyConfig,
    analytics: analyticsConfig,
    
    connectionPooling: {
      enabled: true,
      monitorCommands: isProduction,
      maxConnecting: parseInt(process.env.DB_MAX_CONNECTING || '10'),
      heartbeatFrequencyMS: parseInt(process.env.DB_HEARTBEAT_FREQUENCY_MS || '10000'),
    },
    
    clustering: {
      enabled: isProduction,
      readReplicasEnabled: Boolean(process.env.DATABASE_READONLY_URL),
      loadBalancing: {
        strategy: (process.env.DB_LOAD_BALANCING_STRATEGY as any) || 'round-robin',
        maxStalenessSeconds: parseInt(process.env.DB_MAX_STALENESS_SECONDS || '90'),
      },
    },
    
    monitoring: {
      slowQueryThreshold: parseInt(process.env.DB_SLOW_QUERY_THRESHOLD || '100'),
      enableProfiling: process.env.DB_ENABLE_PROFILING === 'true' || !isProduction,
      enableMetrics: process.env.DB_ENABLE_METRICS !== 'false',
      logLevel: (process.env.DB_LOG_LEVEL as any) || (isProduction ? 'warn' : 'info'),
    },
    
    backup: {
      pointInTimeRecovery: isProduction,
      retentionDays: parseInt(process.env.DB_BACKUP_RETENTION_DAYS || '30'),
    },
  };
});

// Database connection factory for different use cases
export class DatabaseConnectionFactory {
  private static connections: Map<string, any> = new Map();

  static async createConnection(
    name: string,
    config: DatabaseConnectionConfig,
    additionalOptions: Record<string, any> = {},
  ): Promise<any> {
    const mongoose = await import('mongoose');
    
    if (this.connections.has(name)) {
      return this.connections.get(name);
    }

    const connection = mongoose.createConnection(config.uri, {
      ...config.options,
      ...additionalOptions,
      // Connection naming for monitoring
      appName: `madplan-${process.env.NODE_ENV || 'development'}-${name}`,
      // Enable monitoring
      monitorCommands: true,
      // Compression for better network performance
      compressors: ['zlib'],
      zlibCompressionLevel: 6,
    } as any);

    // Connection event handlers
    connection.on('connected', () => {
      console.log(`Database connection '${name}' established successfully`);
    });

    connection.on('error', (error) => {
      console.error(`Database connection '${name}' error:`, error);
    });

    connection.on('disconnected', () => {
      console.warn(`Database connection '${name}' disconnected`);
    });

    // Monitor connection pool events
    connection.on('connectionPoolCreated', (event) => {
      console.log(`Connection pool '${name}' created:`, event);
    });

    connection.on('connectionPoolClosed', (event) => {
      console.log(`Connection pool '${name}' closed:`, event);
    });

    connection.on('connectionCreated', (event) => {
      console.debug(`Connection '${name}' created:`, event.connectionId);
    });

    connection.on('connectionClosed', (event) => {
      console.debug(`Connection '${name}' closed:`, event.connectionId);
    });

    this.connections.set(name, connection);
    return connection;
  }

  static async getConnection(name: string): Promise<any> {
    return this.connections.get(name);
  }

  static async closeConnection(name: string): Promise<void> {
    const connection = this.connections.get(name);
    if (connection) {
      await connection.close();
      this.connections.delete(name);
      console.log(`Database connection '${name}' closed`);
    }
  }

  static async closeAllConnections(): Promise<void> {
    const promises = Array.from(this.connections.keys()).map(name =>
      this.closeConnection(name)
    );
    await Promise.all(promises);
  }

  static getConnectionStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [name, connection] of this.connections) {
      stats[name] = {
        readyState: connection.readyState,
        host: connection.host,
        port: connection.port,
        name: connection.name,
        models: Object.keys(connection.models),
        collections: Object.keys(connection.collections),
      };
    }
    
    return stats;
  }
}

// Read preference utilities for load balancing
export class ReadPreferenceManager {
  private static readonly READ_PREFERENCES = {
    PRIMARY: 'primary',
    PRIMARY_PREFERRED: 'primaryPreferred',
    SECONDARY: 'secondary',
    SECONDARY_PREFERRED: 'secondaryPreferred',
    NEAREST: 'nearest',
  };

  static getReadPreference(operation: 'read' | 'write' | 'analytics'): string {
    switch (operation) {
      case 'write':
        return this.READ_PREFERENCES.PRIMARY;
      case 'analytics':
        return this.READ_PREFERENCES.SECONDARY_PREFERRED;
      case 'read':
      default:
        // Use environment variable or default to secondary preferred for reads
        return process.env.DB_READ_PREFERENCE || this.READ_PREFERENCES.SECONDARY_PREFERRED;
    }
  }

  static createReadPreferenceOptions(
    operation: 'read' | 'write' | 'analytics',
    maxStalenessSeconds?: number,
  ): Record<string, any> {
    const readPreference = this.getReadPreference(operation);
    
    const options: Record<string, any> = {
      readPreference,
    };

    // Add max staleness for secondary reads
    if (readPreference.includes('secondary') && maxStalenessSeconds) {
      options.maxStalenessSeconds = maxStalenessSeconds;
    }

    return options;
  }
}

// Connection health monitoring
export class DatabaseHealthMonitor {
  private static healthCheckInterval: NodeJS.Timeout | null = null;
  private static healthMetrics: Record<string, any> = {};

  static startMonitoring(intervalMs: number = 30000): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, intervalMs);
  }

  static stopMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  static async performHealthCheck(): Promise<Record<string, any>> {
    const connections = DatabaseConnectionFactory.getConnectionStats();
    const healthStatus: Record<string, any> = {};

    for (const [name, connection] of Object.entries(connections)) {
      try {
        // Perform ping test
        const startTime = Date.now();
        await (connection as any).db.admin().ping();
        const latency = Date.now() - startTime;

        healthStatus[name] = {
          status: 'healthy',
          latency,
          readyState: (connection as any).readyState,
          lastChecked: new Date().toISOString(),
        };
      } catch (error) {
        healthStatus[name] = {
          status: 'unhealthy',
          error: (error as Error).message,
          readyState: (connection as any).readyState,
          lastChecked: new Date().toISOString(),
        };
      }
    }

    this.healthMetrics = healthStatus;
    return healthStatus;
  }

  static getHealthMetrics(): Record<string, any> {
    return this.healthMetrics;
  }

  static async getDetailedStats(): Promise<Record<string, any>> {
    const stats: Record<string, any> = {};
    const connections = DatabaseConnectionFactory.getConnectionStats();

    for (const [name, connection] of Object.entries(connections)) {
      try {
        const db = (connection as any).db;
        const admin = db.admin();

        // Get server status
        const serverStatus = await admin.serverStatus();
        
        // Get database stats
        const dbStats = await db.stats();

        stats[name] = {
          server: {
            version: serverStatus.version,
            uptime: serverStatus.uptime,
            connections: serverStatus.connections,
            opcounters: serverStatus.opcounters,
            network: serverStatus.network,
            memory: serverStatus.mem,
          },
          database: {
            collections: dbStats.collections,
            dataSize: dbStats.dataSize,
            storageSize: dbStats.storageSize,
            indexes: dbStats.indexes,
            indexSize: dbStats.indexSize,
          },
        };
      } catch (error) {
        stats[name] = {
          error: (error as Error).message,
        };
      }
    }

    return stats;
  }
}