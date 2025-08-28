/**
 * Deployment Testing Script
 * Tests backend deployment health and GraphQL endpoint connectivity
 */

require('dotenv').config();

const https = require('https');
const http = require('http');

// Configuration
const BACKEND_URL = process.env.BACKEND_URL || 'https://your-backend.onrender.com';
const TIMEOUT = 30000; // 30 seconds

console.log('🚀 Testing Deployment...');
console.log('📍 Backend URL:', BACKEND_URL);
console.log('⏱️  Timeout:', TIMEOUT + 'ms');
console.log('');

/**
 * Make HTTP/HTTPS request
 */
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    const req = client.request(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: TIMEOUT,
    }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data,
        });
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

/**
 * Test backend health endpoint
 */
async function testHealthEndpoint() {
  console.log('🔄 Testing health endpoint...');
  
  try {
    const response = await makeRequest(`${BACKEND_URL}/api/health`);
    
    if (response.statusCode === 200) {
      const healthData = JSON.parse(response.data);
      console.log('✅ Health endpoint accessible');
      console.log('📊 Health data:', JSON.stringify(healthData, null, 2));
      
      // Validate health response structure
      if (healthData.status === 'ok' && healthData.service === 'madplan-backend') {
        console.log('✅ Health response structure valid');
        return true;
      } else {
        console.log('⚠️ Health response structure unexpected');
        return false;
      }
    } else {
      console.log(`❌ Health endpoint returned status: ${response.statusCode}`);
      console.log('📝 Response:', response.data);
      return false;
    }
  } catch (error) {
    console.log('❌ Health endpoint test failed:', error.message);
    return false;
  }
}

/**
 * Test GraphQL endpoint
 */
async function testGraphQLEndpoint() {
  console.log('🔄 Testing GraphQL endpoint...');
  
  try {
    const graphqlQuery = {
      query: '{ __schema { types { name } } }'
    };
    
    const response = await makeRequest(`${BACKEND_URL}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(graphqlQuery),
    });
    
    if (response.statusCode === 200) {
      const graphqlData = JSON.parse(response.data);
      console.log('✅ GraphQL endpoint accessible');
      
      // Check if it's a valid GraphQL response
      if (graphqlData.data && graphqlData.data.__schema) {
        console.log('✅ GraphQL schema introspection working');
        console.log('📊 Available types count:', graphqlData.data.__schema.types.length);
        return true;
      } else if (graphqlData.errors) {
        console.log('⚠️ GraphQL returned errors:', graphqlData.errors);
        return false;
      } else {
        console.log('⚠️ Unexpected GraphQL response structure');
        return false;
      }
    } else {
      console.log(`❌ GraphQL endpoint returned status: ${response.statusCode}`);
      console.log('📝 Response:', response.data);
      return false;
    }
  } catch (error) {
    console.log('❌ GraphQL endpoint test failed:', error.message);
    return false;
  }
}

/**
 * Test SSL certificate
 */
async function testSSLCertificate() {
  console.log('🔄 Testing SSL certificate...');
  
  if (!BACKEND_URL.startsWith('https')) {
    console.log('⚠️ Backend URL is not HTTPS, skipping SSL test');
    return true;
  }
  
  try {
    const response = await makeRequest(BACKEND_URL, {
      method: 'HEAD',
    });
    
    if (response.statusCode < 400) {
      console.log('✅ SSL certificate is valid');
      return true;
    } else {
      console.log(`⚠️ SSL test returned status: ${response.statusCode}`);
      return false;
    }
  } catch (error) {
    if (error.code === 'CERT_HAS_EXPIRED' || error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
      console.log('❌ SSL certificate validation failed:', error.message);
      return false;
    }
    console.log('❌ SSL test failed:', error.message);
    return false;
  }
}

/**
 * Test CORS configuration
 */
async function testCORS() {
  console.log('🔄 Testing CORS configuration...');
  
  try {
    const response = await makeRequest(`${BACKEND_URL}/api/health`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://example.com',
        'Access-Control-Request-Method': 'GET',
      },
    });
    
    const corsHeaders = response.headers['access-control-allow-origin'];
    if (corsHeaders) {
      console.log('✅ CORS headers present:', corsHeaders);
      return true;
    } else {
      console.log('⚠️ CORS headers not found in response');
      return false;
    }
  } catch (error) {
    console.log('❌ CORS test failed:', error.message);
    return false;
  }
}

/**
 * Run all deployment tests
 */
async function runDeploymentTests() {
  console.log('🧪 Running deployment tests...\n');
  
  const tests = [
    { name: 'Health Endpoint', test: testHealthEndpoint },
    { name: 'GraphQL Endpoint', test: testGraphQLEndpoint },
    { name: 'SSL Certificate', test: testSSLCertificate },
    { name: 'CORS Configuration', test: testCORS },
  ];
  
  const results = [];
  
  for (const { name, test } of tests) {
    try {
      const result = await test();
      results.push({ name, passed: result });
      console.log('');
    } catch (error) {
      console.log(`❌ ${name} test failed with error:`, error.message);
      results.push({ name, passed: false });
      console.log('');
    }
  }
  
  // Summary
  console.log('📋 Deployment Test Summary:');
  console.log('═══════════════════════════');
  
  let passedCount = 0;
  results.forEach(({ name, passed }) => {
    console.log(`${passed ? '✅' : '❌'} ${name}: ${passed ? 'PASS' : 'FAIL'}`);
    if (passed) passedCount++;
  });
  
  console.log('');
  console.log(`📊 Results: ${passedCount}/${results.length} tests passed`);
  
  if (passedCount === results.length) {
    console.log('🎉 All deployment tests passed! Backend is ready for production.');
    process.exit(0);
  } else {
    console.log('⚠️ Some deployment tests failed. Please check the backend configuration.');
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.log('💥 Uncaught exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.log('💥 Unhandled rejection:', error.message);
  process.exit(1);
});

// Run tests
runDeploymentTests();