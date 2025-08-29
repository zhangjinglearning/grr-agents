import { Test, TestingModule } from '@nestjs/testing'
import { getModelToken, MongooseModule } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { ConflictException, BadRequestException, InternalServerErrorException } from '@nestjs/common'
import { UsersService } from '../../users/users.service'
import { User, UserDocument, UserSchema } from '../../users/user.entity'
import { DatabaseTestUtils, UserTestFactory, IntegrationTestHelpers } from '../setup'

describe('UsersService Integration Tests', () => {
  let service: UsersService
  let userModel: Model<UserDocument>
  let module: TestingModule

  beforeAll(async () => {
    await IntegrationTestHelpers.waitForDatabase()

    module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(DatabaseTestUtils.getDatabaseUri()),
        MongooseModule.forFeature([{ name: User.name, schema: UserSchema }])
      ],
      providers: [UsersService],
    }).compile()

    service = module.get<UsersService>(UsersService)
    userModel = module.get<Model<UserDocument>>(getModelToken(User.name))
  }, 60000)

  beforeEach(async () => {
    await DatabaseTestUtils.clearDatabase()
  })

  afterAll(async () => {
    await module.close()
  })

  describe('createUser', () => {
    it('should successfully create a new user with valid data', async () => {
      const registerInput = UserTestFactory.createMockRegisterInput({
        email: 'test@example.com',
        password: 'SecurePassword123!'
      })

      const result = await service.createUser(registerInput)

      expect(result).toBeDefined()
      expect(result.id).toBeDefined()
      expect(result.email).toBe('test@example.com')
      expect(result.password).not.toBe(registerInput.password) // Should be hashed
      expect(result.createdAt).toBeInstanceOf(Date)
      expect(result.updatedAt).toBeInstanceOf(Date)
      
      // Verify password is properly hashed
      expect(result.password).toMatch(/^\$2[ayb]\$.{56}$/) // bcrypt hash pattern
    })

    it('should normalize email to lowercase', async () => {
      const registerInput = UserTestFactory.createMockRegisterInput({
        email: 'TEST@EXAMPLE.COM',
        password: 'SecurePassword123!'
      })

      const result = await service.createUser(registerInput)

      expect(result.email).toBe('test@example.com')
    })

    it('should trim whitespace from email', async () => {
      const registerInput = UserTestFactory.createMockRegisterInput({
        email: '  test@example.com  ',
        password: 'SecurePassword123!'
      })

      const result = await service.createUser(registerInput)

      expect(result.email).toBe('test@example.com')
    })

    it('should throw ConflictException for duplicate email', async () => {
      const registerInput = UserTestFactory.createMockRegisterInput({
        email: 'duplicate@example.com',
        password: 'SecurePassword123!'
      })

      // Create first user
      await service.createUser(registerInput)

      // Attempt to create second user with same email
      await expect(service.createUser(registerInput))
        .rejects
        .toThrow(ConflictException)
    })

    it('should handle case-insensitive email uniqueness', async () => {
      const firstUser = UserTestFactory.createMockRegisterInput({
        email: 'case@example.com',
        password: 'Password123!'
      })

      const secondUser = UserTestFactory.createMockRegisterInput({
        email: 'CASE@EXAMPLE.COM',
        password: 'Password123!'
      })

      // Create first user
      await service.createUser(firstUser)

      // Second user with different case should fail
      await expect(service.createUser(secondUser))
        .rejects
        .toThrow(ConflictException)
    })

    it('should hash different passwords differently', async () => {
      const user1 = UserTestFactory.createMockRegisterInput({
        email: 'user1@example.com',
        password: 'Password123!'
      })

      const user2 = UserTestFactory.createMockRegisterInput({
        email: 'user2@example.com',
        password: 'DifferentPassword456!'
      })

      const result1 = await service.createUser(user1)
      const result2 = await service.createUser(user2)

      expect(result1.password).not.toBe(result2.password)
    })

    it('should generate different hashes for same password (salt)', async () => {
      const password = 'SamePassword123!'
      
      const user1 = UserTestFactory.createMockRegisterInput({
        email: 'user1@example.com',
        password
      })

      const user2 = UserTestFactory.createMockRegisterInput({
        email: 'user2@example.com',
        password
      })

      const result1 = await service.createUser(user1)
      const result2 = await service.createUser(user2)

      // Same password should produce different hashes due to salt
      expect(result1.password).not.toBe(result2.password)
    })
  })

  describe('findByEmail', () => {
    beforeEach(async () => {
      // Seed test data
      await service.createUser(UserTestFactory.createMockRegisterInput({
        email: 'findtest@example.com',
        password: 'Password123!'
      }))
    })

    it('should find existing user by email', async () => {
      const result = await service.findByEmail('findtest@example.com')

      expect(result).toBeDefined()
      expect(result.email).toBe('findtest@example.com')
      expect(result.id).toBeDefined()
    })

    it('should return null for non-existent user', async () => {
      const result = await service.findByEmail('nonexistent@example.com')

      expect(result).toBeNull()
    })

    it('should handle case-insensitive email search', async () => {
      const result = await service.findByEmail('FINDTEST@EXAMPLE.COM')

      expect(result).toBeDefined()
      expect(result.email).toBe('findtest@example.com')
    })

    it('should handle email search with whitespace', async () => {
      const result = await service.findByEmail('  findtest@example.com  ')

      expect(result).toBeDefined()
      expect(result.email).toBe('findtest@example.com')
    })
  })

  describe('findById', () => {
    let testUserId: string

    beforeEach(async () => {
      // Create test user and get ID
      const user = await service.createUser(UserTestFactory.createMockRegisterInput({
        email: 'findbyid@example.com',
        password: 'Password123!'
      }))
      testUserId = user.id
    })

    it('should find existing user by ID', async () => {
      const result = await service.findById(testUserId)

      expect(result).toBeDefined()
      expect(result.id).toBe(testUserId)
      expect(result.email).toBe('findbyid@example.com')
    })

    it('should return null for non-existent ID', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011' // Valid ObjectId format
      const result = await service.findById(nonExistentId)

      expect(result).toBeNull()
    })

    it('should handle invalid ObjectId format', async () => {
      // This should either throw an error or return null depending on implementation
      await expect(async () => {
        await service.findById('invalid-id-format')
      }).rejects.toThrow()
    })
  })

  describe('verifyPassword', () => {
    let hashedPassword: string

    beforeEach(async () => {
      // Create user and get hashed password
      const user = await service.createUser(UserTestFactory.createMockRegisterInput({
        email: 'passwordtest@example.com',
        password: 'TestPassword123!'
      }))
      hashedPassword = user.password
    })

    it('should return true for correct password', async () => {
      const result = await service.verifyPassword('TestPassword123!', hashedPassword)

      expect(result).toBe(true)
    })

    it('should return false for incorrect password', async () => {
      const result = await service.verifyPassword('WrongPassword123!', hashedPassword)

      expect(result).toBe(false)
    })

    it('should handle empty password', async () => {
      const result = await service.verifyPassword('', hashedPassword)

      expect(result).toBe(false)
    })

    it('should handle special characters in password', async () => {
      // Create user with special character password
      const user = await service.createUser(UserTestFactory.createMockRegisterInput({
        email: 'special@example.com',
        password: 'P@$$w0rd!#$%^&*()'
      }))

      const result = await service.verifyPassword('P@$$w0rd!#$%^&*()', user.password)

      expect(result).toBe(true)
    })
  })

  describe('getUserCount', () => {
    it('should return 0 when no users exist', async () => {
      const count = await service.getUserCount()

      expect(count).toBe(0)
    })

    it('should return correct count after creating users', async () => {
      // Create multiple users
      const users = [
        { email: 'count1@example.com', password: 'Password123!' },
        { email: 'count2@example.com', password: 'Password123!' },
        { email: 'count3@example.com', password: 'Password123!' }
      ]

      for (const userData of users) {
        await service.createUser(UserTestFactory.createMockRegisterInput(userData))
      }

      const count = await service.getUserCount()

      expect(count).toBe(3)
    })

    it('should maintain accurate count after user creation and database operations', async () => {
      // Initial count should be 0
      expect(await service.getUserCount()).toBe(0)

      // Create first user
      await service.createUser(UserTestFactory.createMockRegisterInput({
        email: 'increment1@example.com',
        password: 'Password123!'
      }))

      expect(await service.getUserCount()).toBe(1)

      // Create second user
      await service.createUser(UserTestFactory.createMockRegisterInput({
        email: 'increment2@example.com',
        password: 'Password123!'
      }))

      expect(await service.getUserCount()).toBe(2)
    })
  })

  describe('Database Consistency and Transactions', () => {
    it('should maintain data consistency during concurrent operations', async () => {
      const concurrentUsers = Array.from({ length: 5 }, (_, i) => ({
        email: `concurrent${i}@example.com`,
        password: 'Password123!'
      }))

      // Create users concurrently
      const creationPromises = concurrentUsers.map(userData =>
        service.createUser(UserTestFactory.createMockRegisterInput(userData))
      )

      const results = await Promise.all(creationPromises)

      // All users should be created successfully
      expect(results).toHaveLength(5)
      results.forEach((user, index) => {
        expect(user.email).toBe(`concurrent${index}@example.com`)
        expect(user.id).toBeDefined()
      })

      // Verify count is correct
      const finalCount = await service.getUserCount()
      expect(finalCount).toBe(5)
    })

    it('should handle database constraint violations properly', async () => {
      const user1 = UserTestFactory.createMockRegisterInput({
        email: 'constraint@example.com',
        password: 'Password123!'
      })

      // Create first user successfully
      const result1 = await service.createUser(user1)
      expect(result1).toBeDefined()

      // Second user with same email should fail
      await expect(service.createUser(user1))
        .rejects
        .toThrow(ConflictException)

      // Database should remain consistent - only one user exists
      const count = await service.getUserCount()
      expect(count).toBe(1)
    })

    it('should handle partial failures in batch operations', async () => {
      // Create one user successfully
      await service.createUser(UserTestFactory.createMockRegisterInput({
        email: 'batch1@example.com',
        password: 'Password123!'
      }))

      // Mix of valid and duplicate users
      const batchUsers = [
        { email: 'batch2@example.com', password: 'Password123!' }, // Valid
        { email: 'batch1@example.com', password: 'Password123!' }, // Duplicate
        { email: 'batch3@example.com', password: 'Password123!' }  // Valid
      ]

      const results = await Promise.allSettled(
        batchUsers.map(userData =>
          service.createUser(UserTestFactory.createMockRegisterInput(userData))
        )
      )

      // Check results
      expect(results[0].status).toBe('fulfilled') // batch2 should succeed
      expect(results[1].status).toBe('rejected')  // batch1 should fail (duplicate)
      expect(results[2].status).toBe('fulfilled') // batch3 should succeed

      // Final count should be 3 (original + 2 successful)
      const finalCount = await service.getUserCount()
      expect(finalCount).toBe(3)
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle extremely long passwords', async () => {
      const longPassword = 'a'.repeat(200) // Very long password
      const user = UserTestFactory.createMockRegisterInput({
        email: 'longpassword@example.com',
        password: longPassword
      })

      const result = await service.createUser(user)
      expect(result).toBeDefined()

      // Verify password verification works
      const isValid = await service.verifyPassword(longPassword, result.password)
      expect(isValid).toBe(true)
    })

    it('should handle unicode characters in email and password', async () => {
      const user = UserTestFactory.createMockRegisterInput({
        email: 'tëst@éxample.com',
        password: 'Pässwörd123!€'
      })

      const result = await service.createUser(user)
      expect(result).toBeDefined()

      // Verify password verification works with unicode
      const isValid = await service.verifyPassword('Pässwörd123!€', result.password)
      expect(isValid).toBe(true)
    })

    it('should handle very long email addresses', async () => {
      const longEmail = 'a'.repeat(60) + '@' + 'b'.repeat(60) + '.com'
      const user = UserTestFactory.createMockRegisterInput({
        email: longEmail,
        password: 'Password123!'
      })

      // This might fail due to email validation rules
      try {
        const result = await service.createUser(user)
        expect(result.email).toBe(longEmail.toLowerCase())
      } catch (error) {
        // If validation rejects it, that's also acceptable behavior
        expect(error).toBeInstanceOf(BadRequestException)
      }
    })
  })

  describe('Performance Tests', () => {
    it('should create users efficiently', async () => {
      const startTime = Date.now()

      // Create 20 users sequentially
      const users = Array.from({ length: 20 }, (_, i) => ({
        email: `perf${i}@example.com`,
        password: 'Password123!'
      }))

      for (const userData of users) {
        await service.createUser(UserTestFactory.createMockRegisterInput(userData))
      }

      const endTime = Date.now()
      const duration = endTime - startTime

      // Should complete within reasonable time (adjust based on requirements)
      expect(duration).toBeLessThan(10000) // 10 seconds for 20 users

      // Verify all users were created
      const finalCount = await service.getUserCount()
      expect(finalCount).toBe(20)
    })

    it('should handle rapid sequential queries efficiently', async () => {
      // Create test users
      const testUsers = Array.from({ length: 10 }, (_, i) => ({
        email: `query${i}@example.com`,
        password: 'Password123!'
      }))

      const createdUsers = []
      for (const userData of testUsers) {
        const user = await service.createUser(UserTestFactory.createMockRegisterInput(userData))
        createdUsers.push(user)
      }

      const startTime = Date.now()

      // Perform rapid queries
      const queryPromises = createdUsers.map(user => service.findById(user.id))
      const results = await Promise.all(queryPromises)

      const endTime = Date.now()
      const duration = endTime - startTime

      // All queries should succeed
      results.forEach(result => {
        expect(result).toBeDefined()
      })

      // Should complete quickly
      expect(duration).toBeLessThan(2000) // 2 seconds for 10 queries
    })
  })
})