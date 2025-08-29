/**
 * Global test setup for Jest
 * Configures MongoDB Memory Server and testing utilities
 */

import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { Test, TestingModule } from '@nestjs/testing'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { MongooseModule } from '@nestjs/mongoose'

// Global test database instance
let mongod: MongoMemoryServer

// Setup before all tests
beforeAll(async () => {
  // Create in-memory MongoDB instance
  mongod = await MongoMemoryServer.create()
  const uri = mongod.getUri()
  
  // Set environment variables for testing
  process.env.MONGODB_URI = uri
  process.env.JWT_SECRET = 'test-secret-key'
  process.env.JWT_EXPIRES_IN = '24h'
  process.env.NODE_ENV = 'test'
  
  // Connect to the in-memory database
  await mongoose.connect(uri)
}, 60000) // Extended timeout for MongoDB Memory Server startup

// Cleanup after each test
afterEach(async () => {
  // Clear all collections between tests
  const collections = mongoose.connection.collections
  for (const key in collections) {
    const collection = collections[key]
    await collection.deleteMany({})
  }
  
  // Clear all mocks
  jest.clearAllMocks()
})

// Cleanup after all tests
afterAll(async () => {
  // Close database connection
  await mongoose.connection.dropDatabase()
  await mongoose.connection.close()
  
  // Stop the in-memory MongoDB instance
  await mongod.stop()
})

/**
 * Database Testing Utilities
 */
export class DatabaseTestUtils {
  /**
   * Clear all collections in the test database
   */
  static async clearDatabase() {
    const collections = mongoose.connection.collections
    for (const key in collections) {
      const collection = collections[key]
      await collection.deleteMany({})
    }
  }

  /**
   * Close database connection
   */
  static async closeDatabase() {
    await mongoose.connection.dropDatabase()
    await mongoose.connection.close()
    await mongod.stop()
  }

  /**
   * Get the current database URI
   */
  static getDatabaseUri(): string {
    return mongod.getUri()
  }

  /**
   * Check if database is connected
   */
  static isConnected(): boolean {
    return mongoose.connection.readyState === 1
  }
}

/**
 * Mock User Data Factory
 */
export class UserTestFactory {
  static createMockUser(overrides: Partial<any> = {}) {
    return {
      id: '507f1f77bcf86cd799439011',
      email: 'test@example.com',
      password: 'hashedPassword123',
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
      ...overrides,
    }
  }

  static createMockRegisterInput(overrides: Partial<any> = {}) {
    return {
      email: 'newuser@example.com',
      password: 'Password123!',
      ...overrides,
    }
  }

  static createMockLoginInput(overrides: Partial<any> = {}) {
    return {
      email: 'test@example.com',
      password: 'Password123!',
      ...overrides,
    }
  }

  static createMockJwtPayload(overrides: Partial<any> = {}) {
    return {
      sub: '507f1f77bcf86cd799439011',
      email: 'test@example.com',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400, // 24 hours
      ...overrides,
    }
  }
}

/**
 * NestJS Testing Module Factory
 */
export class TestModuleFactory {
  /**
   * Create a test module with common testing dependencies
   */
  static async createTestModule(
    providers: any[] = [],
    imports: any[] = []
  ): Promise<TestingModule> {
    const moduleBuilder = Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
        }),
        MongooseModule.forRootAsync({
          inject: [ConfigService],
          useFactory: async () => ({
            uri: mongod.getUri(),
          }),
        }),
        JwtModule.registerAsync({
          inject: [ConfigService],
          useFactory: async (configService: ConfigService) => ({
            secret: configService.get('JWT_SECRET', 'test-secret-key'),
            signOptions: {
              expiresIn: configService.get('JWT_EXPIRES_IN', '24h'),
            },
          }),
        }),
        ...imports,
      ],
      providers,
    })

    const module = await moduleBuilder.compile()
    return module
  }

  /**
   * Create a test module specifically for authentication testing
   */
  static async createAuthTestModule(providers: any[] = []): Promise<TestingModule> {
    const { AuthModule } = await import('../auth/auth.module')
    const { UsersModule } = await import('../users/users.module')
    
    return this.createTestModule(providers, [AuthModule, UsersModule])
  }
}

/**
 * Mock Service Factory
 */
export class MockServiceFactory {
  static createMockUsersService() {
    return {
      createUser: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
      verifyPassword: jest.fn(),
    }
  }

  static createMockAuthService() {
    return {
      register: jest.fn(),
      login: jest.fn(),
      validateUser: jest.fn(),
      verifyToken: jest.fn(),
      decodeToken: jest.fn(),
    }
  }

  static createMockJwtService() {
    return {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
      decode: jest.fn(),
    }
  }

  static createMockConfigService() {
    return {
      get: jest.fn((key: string, defaultValue?: string) => {
        switch (key) {
          case 'JWT_SECRET':
            return 'test-secret-key'
          case 'JWT_EXPIRES_IN':
            return '24h'
          case 'MONGODB_URI':
            return mongod?.getUri() || 'mongodb://localhost:27017/test'
          default:
            return defaultValue
        }
      }),
    }
  }
}

/**
 * API Testing Utilities
 */
export class ApiTestUtils {
  /**
   * Create a mock GraphQL context
   */
  static createMockContext(user: any = null, request: any = {}) {
    return {
      req: {
        user,
        ...request,
      },
    }
  }

  /**
   * Create a mock JWT token for testing
   */
  static createMockToken(payload: any = UserTestFactory.createMockJwtPayload()) {
    return `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${Buffer.from(JSON.stringify(payload)).toString('base64')}.signature`
  }

  /**
   * Validate error response structure
   */
  static validateErrorResponse(error: any, expectedMessage?: string, expectedCode?: string) {
    expect(error).toBeDefined()
    expect(error.message).toBeDefined()
    
    if (expectedMessage) {
      expect(error.message).toContain(expectedMessage)
    }
    
    if (expectedCode) {
      expect(error.extensions?.code).toBe(expectedCode)
    }
  }
}

/**
 * Integration Test Helpers
 */
export class IntegrationTestHelpers {
  /**
   * Wait for database operations to complete
   */
  static async waitForDatabase(timeout = 5000): Promise<void> {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      if (DatabaseTestUtils.isConnected()) {
        return
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    throw new Error('Database connection timeout')
  }

  /**
   * Seed test data
   */
  static async seedTestData() {
    // This can be extended to seed common test data
    const testUser = UserTestFactory.createMockUser()
    // Add seeding logic here if needed
    return { testUser }
  }

  /**
   * Clean up test data
   */
  static async cleanupTestData() {
    await DatabaseTestUtils.clearDatabase()
  }
}

// Custom Jest matchers for better testing
expect.extend({
  toHaveValidObjectId(received: string) {
    const objectIdPattern = /^[0-9a-fA-F]{24}$/
    const pass = objectIdPattern.test(received)
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid ObjectId`,
        pass: true,
      }
    } else {
      return {
        message: () => `expected ${received} to be a valid ObjectId`,
        pass: false,
      }
    }
  },

  toHaveJwtStructure(received: string) {
    const jwtPattern = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/
    const pass = jwtPattern.test(received)
    
    if (pass) {
      return {
        message: () => `expected ${received} not to have JWT structure`,
        pass: true,
      }
    } else {
      return {
        message: () => `expected ${received} to have JWT structure`,
        pass: false,
      }
    }
  },
})

// Add type declarations for custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveValidObjectId(): R
      toHaveJwtStructure(): R
    }
  }
}

// All classes are already exported individually above