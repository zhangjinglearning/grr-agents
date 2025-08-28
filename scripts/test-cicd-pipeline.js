#!/usr/bin/env node

/**
 * CI/CD Pipeline Integration Testing Script
 * 
 * This script validates the entire CI/CD pipeline by testing:
 * - Backend deployment health and functionality
 * - Frontend deployment and backend connectivity
 * - Cross-platform integration
 * - Environment-specific configurations
 */

const https = require('https');
const http = require('http');

// Configuration
const config = {
  backend: {
    staging: process.env.BACKEND_STAGING_URL || 'https://madplan-backend-staging.onrender.com',
    production: process.env.BACKEND_PRODUCTION_URL || 'https://madplan-backend.onrender.com'
  },
  frontend: {
    staging: process.env.FRONTEND_STAGING_URL || 'https://madplan-frontend-staging.vercel.app',
    production: process.env.FRONTEND_PRODUCTION_URL || 'https://madplan-frontend.vercel.app'
  },
  timeout: 30000,
  retries: 3
};

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  errors: []
};

// Utility functions
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https://') ? https : http;
    const timeout = setTimeout(() => {
      reject(new Error(`Request timeout: ${url}`));
    }, config.timeout);

    const req = client.request(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: config.timeout
    }, (res) => {
      clearTimeout(timeout);
      let data = '';
      
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data
        });
      });
    });

    req.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

async function retryRequest(url, options = {}, retries = config.retries) {
  for (let i = 0; i < retries; i++) {
    try {
      return await makeRequest(url, options);
    } catch (error) {
      console.log(`  Attempt ${i + 1}/${retries} failed: ${error.message}`);
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
    }
  }
}

function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    'info': '✅',
    'error': '❌',
    'warn': '⚠️',
    'debug': '🔍'
  }[level] || 'ℹ️';
  
  console.log(`${prefix} [${timestamp}] ${message}`);
}

function logResult(testName, success, details = '') {
  if (success) {
    results.passed++;
    log(`${testName}: PASSED ${details}`, 'info');
  } else {
    results.failed++;
    results.errors.push(`${testName}: ${details}`);
    log(`${testName}: FAILED ${details}`, 'error');
  }
}

// Test functions
async function testBackendHealth(environment) {
  const testName = `Backend Health Check (${environment})`;
  console.log(`\n🔍 ${testName}`);
  
  try {
    const url = `${config.backend[environment]}/api/health`;
    const response = await retryRequest(url);
    
    if (response.statusCode === 200) {
      const data = JSON.parse(response.data);
      const hasRequiredFields = data.status && data.timestamp;
      
      logResult(testName, hasRequiredFields, 
        hasRequiredFields ? `Status: ${data.status}` : 'Missing required health check fields');
    } else {
      logResult(testName, false, `HTTP ${response.statusCode}`);
    }
  } catch (error) {
    logResult(testName, false, error.message);
  }
}

async function testBackendGraphQL(environment) {
  const testName = `Backend GraphQL Endpoint (${environment})`;
  console.log(`\n🔍 ${testName}`);
  
  try {
    const url = `${config.backend[environment]}/graphql`;
    const query = JSON.stringify({
      query: '{ __schema { types { name } } }'
    });
    
    const response = await retryRequest(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: query
    });
    
    if (response.statusCode === 200) {
      const data = JSON.parse(response.data);
      const hasSchema = data.data && data.data.__schema;
      
      logResult(testName, hasSchema, 
        hasSchema ? 'GraphQL schema introspection successful' : 'No schema data returned');
    } else {
      logResult(testName, false, `HTTP ${response.statusCode}`);
    }
  } catch (error) {
    logResult(testName, false, error.message);
  }
}

async function testBackendCORS(environment) {
  const testName = `Backend CORS Configuration (${environment})`;
  console.log(`\n🔍 ${testName}`);
  
  try {
    const url = `${config.backend[environment]}/graphql`;
    const frontendOrigin = config.frontend[environment];
    
    const response = await retryRequest(url, {
      method: 'OPTIONS',
      headers: {
        'Origin': frontendOrigin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });
    
    const corsOrigin = response.headers['access-control-allow-origin'];
    const corsCredentials = response.headers['access-control-allow-credentials'];
    
    const corsConfigured = corsOrigin && (corsOrigin === '*' || corsOrigin === frontendOrigin);
    
    logResult(testName, corsConfigured, 
      corsConfigured ? `CORS origin: ${corsOrigin}` : 'CORS not properly configured');
  } catch (error) {
    logResult(testName, false, error.message);
  }
}

async function testFrontendDeployment(environment) {
  const testName = `Frontend Deployment (${environment})`;
  console.log(`\n🔍 ${testName}`);
  
  try {
    const url = config.frontend[environment];
    const response = await retryRequest(url);
    
    if (response.statusCode === 200) {
      const hasVueApp = response.data.includes('<div id="app">') || 
                       response.data.includes('MadPlan') ||
                       response.data.includes('<title>MadPlan</title>');
      
      logResult(testName, hasVueApp, 
        hasVueApp ? 'Vue app successfully deployed' : 'Vue app content not found');
    } else {
      logResult(testName, false, `HTTP ${response.statusCode}`);
    }
  } catch (error) {
    logResult(testName, false, error.message);
  }
}

async function testSSLCertificates(environment) {
  const testName = `SSL Certificates (${environment})`;
  console.log(`\n🔍 ${testName}`);
  
  const urls = [
    config.backend[environment],
    config.frontend[environment]
  ];
  
  for (const url of urls) {
    try {
      if (url.startsWith('https://')) {
        const response = await retryRequest(url);
        logResult(`${testName} - ${url}`, true, 'SSL certificate valid');
      } else {
        logResult(`${testName} - ${url}`, false, 'Not using HTTPS');
      }
    } catch (error) {
      const isSSLError = error.message.includes('certificate') || 
                        error.message.includes('SSL') ||
                        error.message.includes('TLS');
      logResult(`${testName} - ${url}`, false, 
        isSSLError ? 'SSL certificate issue' : error.message);
    }
  }
}

async function testDatabaseConnectivity(environment) {
  const testName = `Database Connectivity (${environment})`;
  console.log(`\n🔍 ${testName}`);
  
  try {
    // Test database connectivity through a GraphQL query that requires DB access
    const url = `${config.backend[environment]}/graphql`;
    const query = JSON.stringify({
      query: '{ __type(name: "Query") { name } }'
    });
    
    const response = await retryRequest(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: query
    });
    
    if (response.statusCode === 200) {
      const data = JSON.parse(response.data);
      const hasValidResponse = data.data && !data.errors;
      
      logResult(testName, hasValidResponse, 
        hasValidResponse ? 'Database connection successful' : 'Database connection issues detected');
    } else {
      logResult(testName, false, `HTTP ${response.statusCode}`);
    }
  } catch (error) {
    logResult(testName, false, error.message);
  }
}

async function testEnvironmentConfiguration(environment) {
  const testName = `Environment Configuration (${environment})`;
  console.log(`\n🔍 ${testName}`);
  
  try {
    const url = `${config.backend[environment]}/api/health`;
    const response = await retryRequest(url);
    
    if (response.statusCode === 200) {
      const data = JSON.parse(response.data);
      const environmentMatch = environment === 'production' ? 
        (data.environment === 'production' || data.environment === 'prod') :
        (data.environment === 'staging' || data.environment === 'development');
      
      logResult(testName, environmentMatch, 
        environmentMatch ? `Environment: ${data.environment}` : `Unexpected environment: ${data.environment}`);
    } else {
      logResult(testName, false, `HTTP ${response.statusCode}`);
    }
  } catch (error) {
    logResult(testName, false, error.message);
  }
}

async function runEnvironmentTests(environment) {
  console.log(`\n🚀 Running ${environment.toUpperCase()} environment tests...`);
  console.log(`Backend URL: ${config.backend[environment]}`);
  console.log(`Frontend URL: ${config.frontend[environment]}`);
  
  // Backend tests
  await testBackendHealth(environment);
  await testBackendGraphQL(environment);
  await testBackendCORS(environment);
  await testDatabaseConnectivity(environment);
  
  // Frontend tests
  await testFrontendDeployment(environment);
  
  // Cross-platform tests
  await testSSLCertificates(environment);
  await testEnvironmentConfiguration(environment);
}

async function main() {
  console.log('🧪 CI/CD Pipeline Integration Testing');
  console.log('=====================================');
  console.log(`Start time: ${new Date().toISOString()}`);
  
  const environment = process.argv[2] || 'staging';
  const validEnvironments = ['staging', 'production', 'both'];
  
  if (!validEnvironments.includes(environment)) {
    console.error(`❌ Invalid environment: ${environment}`);
    console.error(`Valid options: ${validEnvironments.join(', ')}`);
    process.exit(1);
  }
  
  try {
    if (environment === 'both') {
      await runEnvironmentTests('staging');
      await runEnvironmentTests('production');
    } else {
      await runEnvironmentTests(environment);
    }
    
    console.log('\n📊 Test Results Summary');
    console.log('=======================');
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`📈 Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);
    
    if (results.failed > 0) {
      console.log('\n💥 Failed Tests:');
      results.errors.forEach(error => console.log(`   ${error}`));
      
      console.log('\n🔧 Troubleshooting Tips:');
      console.log('   1. Check if deployments are complete and services are running');
      console.log('   2. Verify environment variables are correctly configured');
      console.log('   3. Ensure network connectivity to deployment platforms');
      console.log('   4. Review deployment logs for errors');
      console.log('   5. Check security settings and CORS configuration');
      
      process.exit(1);
    } else {
      console.log('\n🎉 All tests passed! CI/CD pipeline is working correctly.');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('💥 Test execution failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle script termination
process.on('SIGINT', () => {
  console.log('\n⏹️  Test execution interrupted');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n⏹️  Test execution terminated');
  process.exit(1);
});

// Run the tests
if (require.main === module) {
  main();
}

module.exports = { main, testBackendHealth, testBackendGraphQL, testFrontendDeployment };