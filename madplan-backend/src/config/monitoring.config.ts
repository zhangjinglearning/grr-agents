import { registerAs } from '@nestjs/config';

export interface MonitoringConfig {
  datadog: {
    enabled: boolean;
    apiKey: string;
    appKey: string;
    service: string;
    env: string;
    version: string;
    enableProfiling: boolean;
    enableRuntimeMetrics: boolean;
    logInjection: boolean;
    tags: Record<string, string>;
  };
  sentry: {
    enabled: boolean;
    dsn: string;
    environment: string;
    release: string;
    tracesSampleRate: number;
    profilesSampleRate: number;
    beforeSend?: (event: any) => any;
  };
  metrics: {
    enabled: boolean;
    prefix: string;
    defaultTags: string[];
    flushInterval: number;
  };
  logging: {
    level: string;
    format: 'json' | 'simple';
    enableConsole: boolean;
    enableFile: boolean;
    fileOptions: {
      filename: string;
      maxSize: string;
      maxFiles: string;
    };
  };
  healthChecks: {
    enabled: boolean;
    timeout: number;
    interval: number;
    checks: {
      database: boolean;
      redis: boolean;
      external: boolean;
    };
  };
  performance: {
    enableDetailed: boolean;
    slowQueryThreshold: number;
    slowRequestThreshold: number;
    memoryThreshold: number;
    cpuThreshold: number;
  };
  alerts: {
    enabled: boolean;
    channels: {
      slack: {
        enabled: boolean;
        webhook: string;
        channel: string;
      };
      email: {
        enabled: boolean;
        recipients: string[];
      };
    };
    thresholds: {
      errorRate: number;
      responseTime: number;
      memoryUsage: number;
      cpuUsage: number;
    };
  };
}

export default registerAs('monitoring', (): MonitoringConfig => ({
  datadog: {
    enabled: process.env.DATADOG_ENABLED === 'true',
    apiKey: process.env.DATADOG_API_KEY || '',
    appKey: process.env.DATADOG_APP_KEY || '',
    service: process.env.DATADOG_SERVICE || 'madplan-backend',
    env: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    enableProfiling: process.env.NODE_ENV === 'production',
    enableRuntimeMetrics: true,
    logInjection: true,
    tags: {
      'service.name': 'madplan-backend',
      'service.version': process.env.npm_package_version || '1.0.0',
      'deployment.environment': process.env.NODE_ENV || 'development',
      'team': 'platform',
      'cost.center': 'engineering'
    }
  },
  
  sentry: {
    enabled: process.env.SENTRY_ENABLED === 'true',
    dsn: process.env.SENTRY_DSN || '',
    environment: process.env.NODE_ENV || 'development',
    release: process.env.npm_package_version || '1.0.0',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    beforeSend: (event: any) => {
      // Filter out sensitive information
      if (event.request?.data) {
        const sensitiveFields = ['password', 'token', 'secret', 'key'];
        sensitiveFields.forEach(field => {
          if (event.request.data[field]) {
            event.request.data[field] = '[Filtered]';
          }
        });
      }
      return event;
    }
  },
  
  metrics: {
    enabled: true,
    prefix: 'madplan',
    defaultTags: [
      `env:${process.env.NODE_ENV || 'development'}`,
      `service:madplan-backend`,
      `version:${process.env.npm_package_version || '1.0.0'}`
    ],
    flushInterval: 10000 // 10 seconds
  },
  
  logging: {
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    format: process.env.LOG_FORMAT as 'json' | 'simple' || 'json',
    enableConsole: true,
    enableFile: process.env.NODE_ENV === 'production',
    fileOptions: {
      filename: process.env.LOG_FILE || 'logs/application-%DATE%.log',
      maxSize: process.env.LOG_MAX_SIZE || '20m',
      maxFiles: process.env.LOG_MAX_FILES || '14d'
    }
  },
  
  healthChecks: {
    enabled: true,
    timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || '5000', 10),
    interval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000', 10),
    checks: {
      database: true,
      redis: process.env.REDIS_ENABLED === 'true',
      external: process.env.NODE_ENV === 'production'
    }
  },
  
  performance: {
    enableDetailed: process.env.ENABLE_DETAILED_MONITORING === 'true',
    slowQueryThreshold: parseInt(process.env.SLOW_QUERY_THRESHOLD || '1000', 10),
    slowRequestThreshold: parseInt(process.env.SLOW_REQUEST_THRESHOLD || '2000', 10),
    memoryThreshold: parseInt(process.env.MEMORY_THRESHOLD || '500', 10), // MB
    cpuThreshold: parseInt(process.env.CPU_THRESHOLD || '80', 10) // Percentage
  },
  
  alerts: {
    enabled: process.env.ALERTS_ENABLED === 'true',
    channels: {
      slack: {
        enabled: process.env.SLACK_ALERTS_ENABLED === 'true',
        webhook: process.env.SLACK_WEBHOOK_URL || '',
        channel: process.env.SLACK_CHANNEL || '#alerts'
      },
      email: {
        enabled: process.env.EMAIL_ALERTS_ENABLED === 'true',
        recipients: process.env.ALERT_EMAIL_RECIPIENTS?.split(',') || []
      }
    },
    thresholds: {
      errorRate: parseFloat(process.env.ERROR_RATE_THRESHOLD || '0.01'), // 1%
      responseTime: parseInt(process.env.RESPONSE_TIME_THRESHOLD || '2000', 10), // 2s
      memoryUsage: parseInt(process.env.MEMORY_USAGE_THRESHOLD || '80', 10), // 80%
      cpuUsage: parseInt(process.env.CPU_USAGE_THRESHOLD || '80', 10) // 80%
    }
  }
}));

// Environment-specific monitoring configurations
export const monitoringProfiles = {
  development: {
    datadog: {
      enabled: false,
      apiKey: '',
      appKey: '',
      service: 'madplan-backend-dev',
      env: 'development',
      version: '1.0.0',
      enableProfiling: false,
      enableRuntimeMetrics: false,
      logInjection: false,
      tags: {}
    },
    sentry: {
      enabled: false,
      tracesSampleRate: 1.0
    },
    logging: {
      level: 'debug',
      format: 'simple' as const,
      enableFile: false
    },
    performance: {
      enableDetailed: true
    },
    alerts: {
      enabled: false
    }
  },
  
  test: {
    datadog: {
      enabled: false,
      apiKey: '',
      appKey: '',
      service: 'madplan-backend-test',
      env: 'test',
      version: '1.0.0',
      enableProfiling: false,
      enableRuntimeMetrics: false,
      logInjection: false,
      tags: {}
    },
    sentry: {
      enabled: false
    },
    logging: {
      level: 'error',
      enableConsole: false,
      enableFile: false
    },
    metrics: {
      enabled: false
    },
    alerts: {
      enabled: false
    }
  },
  
  staging: {
    datadog: {
      enabled: true,
      apiKey: process.env.DATADOG_API_KEY || '',
      appKey: process.env.DATADOG_APP_KEY || '',
      service: 'madplan-backend-staging',
      env: 'staging',
      version: '1.0.0',
      enableProfiling: false,
      enableRuntimeMetrics: true,
      logInjection: true,
      tags: { environment: 'staging' }
    },
    sentry: {
      enabled: true,
      tracesSampleRate: 0.5,
      profilesSampleRate: 0.1
    },
    logging: {
      level: 'info',
      format: 'json' as const,
      enableFile: true
    },
    performance: {
      enableDetailed: true,
      slowQueryThreshold: 500,
      slowRequestThreshold: 1000
    },
    alerts: {
      enabled: true,
      thresholds: {
        errorRate: 0.05, // 5% for staging
        responseTime: 3000,
        memoryUsage: 85,
        cpuUsage: 85
      }
    }
  },
  
  production: {
    datadog: {
      enabled: true,
      apiKey: process.env.DATADOG_API_KEY || '',
      appKey: process.env.DATADOG_APP_KEY || '',
      service: 'madplan-backend',
      env: 'production',
      version: process.env.APP_VERSION || '1.0.0',
      enableProfiling: true,
      enableRuntimeMetrics: true,
      logInjection: true,
      tags: { environment: 'production' }
    },
    sentry: {
      enabled: true,
      tracesSampleRate: 0.1,
      profilesSampleRate: 0.05
    },
    logging: {
      level: 'info',
      format: 'json' as const,
      enableFile: true
    },
    performance: {
      enableDetailed: true,
      slowQueryThreshold: 1000,
      slowRequestThreshold: 2000
    },
    alerts: {
      enabled: true,
      thresholds: {
        errorRate: 0.01, // 1%
        responseTime: 2000,
        memoryUsage: 80,
        cpuUsage: 80
      }
    }
  }
};

// Helper function to get environment-specific config
export function getMonitoringConfig(environment: string = process.env.NODE_ENV || 'development'): Partial<MonitoringConfig> {
  return (monitoringProfiles[environment as keyof typeof monitoringProfiles] || monitoringProfiles.development) as Partial<MonitoringConfig>;
}

// Custom metric definitions for business logic
export const customMetrics = {
  business: {
    userRegistrations: 'business.users.registrations',
    userLogins: 'business.users.logins',
    boardsCreated: 'business.boards.created',
    cardsCreated: 'business.cards.created',
    activeUsers: 'business.users.active',
    sessionDuration: 'business.sessions.duration',
    featureUsage: 'business.features.usage',
    conversionRate: 'business.conversion.rate'
  },
  
  performance: {
    databaseConnections: 'performance.database.connections',
    cacheHitRate: 'performance.cache.hit_rate',
    memoryUsage: 'performance.memory.usage',
    cpuUsage: 'performance.cpu.usage',
    responseTime: 'performance.response.time',
    throughput: 'performance.throughput'
  },
  
  errors: {
    authenticationFailures: 'errors.auth.failures',
    validationErrors: 'errors.validation.total',
    databaseErrors: 'errors.database.total',
    externalServiceErrors: 'errors.external.total',
    unexpectedErrors: 'errors.unexpected.total'
  }
};

// Alert configurations
export const alertConfigurations = {
  critical: {
    applicationDown: {
      name: 'Application Down',
      condition: 'error_rate > 0.5 for 2 minutes',
      channels: ['slack', 'email'],
      escalation: true
    },
    databaseConnectionLost: {
      name: 'Database Connection Lost',
      condition: 'database.connection.errors > 0 for 1 minute',
      channels: ['slack', 'email'],
      escalation: true
    },
    highErrorRate: {
      name: 'High Error Rate',
      condition: 'error_rate > 0.1 for 5 minutes',
      channels: ['slack', 'email'],
      escalation: false
    }
  },
  
  warning: {
    slowResponse: {
      name: 'Slow Response Time',
      condition: 'avg_response_time > 2000ms for 10 minutes',
      channels: ['slack'],
      escalation: false
    },
    highMemoryUsage: {
      name: 'High Memory Usage',
      condition: 'memory_usage > 80% for 15 minutes',
      channels: ['slack'],
      escalation: false
    },
    lowCacheHitRate: {
      name: 'Low Cache Hit Rate',
      condition: 'cache_hit_rate < 0.8 for 10 minutes',
      channels: ['slack'],
      escalation: false
    }
  }
};