#!/usr/bin/env node

/**
 * Health Check Script for Docker Container
 * Performs comprehensive health checks for the MadPlan backend service
 */

const http = require('http');
const process = require('process');

const HEALTH_CHECK_CONFIG = {
  host: process.env.HOST || 'localhost',
  port: process.env.PORT || 3000,
  path: '/api/health',
  timeout: 3000,
  maxRetries: 3
};

/**
 * Performs HTTP health check
 * @returns {Promise<boolean>}
 */
function performHealthCheck() {
  return new Promise((resolve) => {
    const options = {
      hostname: HEALTH_CHECK_CONFIG.host,
      port: HEALTH_CHECK_CONFIG.port,
      path: HEALTH_CHECK_CONFIG.path,
      method: 'GET',
      timeout: HEALTH_CHECK_CONFIG.timeout
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const healthData = JSON.parse(data);
            if (healthData.status === 'healthy') {
              console.log('✅ Health check passed:', healthData);
              resolve(true);
            } else {
              console.error('❌ Health check failed - unhealthy status:', healthData);
              resolve(false);
            }
          } catch (error) {
            console.error('❌ Health check failed - invalid JSON response:', error.message);
            resolve(false);
          }
        } else {
          console.error(`❌ Health check failed - HTTP ${res.statusCode}: ${data}`);
          resolve(false);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Health check failed - connection error:', error.message);
      resolve(false);
    });

    req.on('timeout', () => {
      console.error(`❌ Health check failed - timeout after ${HEALTH_CHECK_CONFIG.timeout}ms`);
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

/**
 * Main health check execution with retries
 */
async function main() {
  console.log('🔍 Starting health check...');
  
  for (let attempt = 1; attempt <= HEALTH_CHECK_CONFIG.maxRetries; attempt++) {
    console.log(`Attempt ${attempt}/${HEALTH_CHECK_CONFIG.maxRetries}`);
    
    const isHealthy = await performHealthCheck();
    
    if (isHealthy) {
      console.log('🎉 Service is healthy!');
      process.exit(0);
    }

    if (attempt < HEALTH_CHECK_CONFIG.maxRetries) {
      console.log(`Retrying in 1 second...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.error(`💥 Health check failed after ${HEALTH_CHECK_CONFIG.maxRetries} attempts`);
  process.exit(1);
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught exception during health check:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled rejection during health check:', reason);
  process.exit(1);
});

// Run the health check
main().catch((error) => {
  console.error('💥 Health check error:', error);
  process.exit(1);
});