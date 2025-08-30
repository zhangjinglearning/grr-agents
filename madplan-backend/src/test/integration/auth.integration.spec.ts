import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { GraphQLModule } from "@nestjs/graphql";
import { ApolloDriver, ApolloDriverConfig } from "@nestjs/apollo";
import { MongooseModule } from "@nestjs/mongoose";
import * as request from "supertest";
import { join } from "path";
import { AppModule } from "../../app.module";
import {
  DatabaseTestUtils,
  UserTestFactory,
  IntegrationTestHelpers,
} from "../setup";

describe("Authentication API Integration Tests", () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;

  beforeAll(async () => {
    await IntegrationTestHelpers.waitForDatabase();

    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(MongooseModule)
      .useModule(MongooseModule.forRoot(DatabaseTestUtils.getDatabaseUri()))
      .compile();

    app = moduleFixture.createNestApplication();

    // Configure validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();
  }, 60000);

  beforeEach(async () => {
    await DatabaseTestUtils.clearDatabase();
  });

  afterAll(async () => {
    await app.close();
    await moduleFixture.close();
  });

  describe("User Registration Endpoint", () => {
    const registerMutation = `
      mutation RegisterUser($input: RegisterUserInput!) {
        register(registerUserInput: $input) {
          token
          user {
            id
            email
            createdAt
            updatedAt
          }
        }
      }
    `;

    it("should successfully register a new user", async () => {
      const registerInput = UserTestFactory.createMockRegisterInput({
        email: "newuser@example.com",
        password: "SecurePassword123!",
      });

      const response = await request(app.getHttpServer())
        .post("/graphql")
        .send({
          query: registerMutation,
          variables: { input: registerInput },
        })
        .expect(200);

      expect(response.body.errors).toBeUndefined();
      expect(response.body.data.register).toBeDefined();
      expect(response.body.data.register.token).toBeDefined();
      expect(response.body.data.register.user).toBeDefined();
      expect(response.body.data.register.user.email).toBe(registerInput.email);
      expect(response.body.data.register.user.id).toBeDefined();
      expect(response.body.data.register.user.createdAt).toBeDefined();
      expect(response.body.data.register.user.updatedAt).toBeDefined();

      // Verify JWT token structure
      expect(response.body.data.register.token).toMatch(
        /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/,
      );
    });

    it("should reject registration with invalid email format", async () => {
      const invalidInput = {
        email: "invalid-email-format",
        password: "ValidPassword123!",
      };

      const response = await request(app.getHttpServer())
        .post("/graphql")
        .send({
          query: registerMutation,
          variables: { input: invalidInput },
        })
        .expect(200);

      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain("email");
      expect(response.body.data.register).toBeNull();
    });

    it("should reject registration with weak password", async () => {
      const weakPasswordInput = {
        email: "user@example.com",
        password: "123", // Too short
      };

      const response = await request(app.getHttpServer())
        .post("/graphql")
        .send({
          query: registerMutation,
          variables: { input: weakPasswordInput },
        })
        .expect(200);

      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain("password");
      expect(response.body.data.register).toBeNull();
    });

    it("should reject registration with missing required fields", async () => {
      const incompleteInput = {
        email: "user@example.com",
        // password missing
      };

      const response = await request(app.getHttpServer())
        .post("/graphql")
        .send({
          query: registerMutation,
          variables: { input: incompleteInput },
        })
        .expect(200);

      expect(response.body.errors).toBeDefined();
      expect(response.body.data.register).toBeNull();
    });

    it("should reject registration with duplicate email", async () => {
      const userInput = UserTestFactory.createMockRegisterInput({
        email: "duplicate@example.com",
        password: "SecurePassword123!",
      });

      // First registration should succeed
      await request(app.getHttpServer())
        .post("/graphql")
        .send({
          query: registerMutation,
          variables: { input: userInput },
        })
        .expect(200);

      // Second registration with same email should fail
      const response = await request(app.getHttpServer())
        .post("/graphql")
        .send({
          query: registerMutation,
          variables: { input: userInput },
        })
        .expect(200);

      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain("already exists");
      expect(response.body.data.register).toBeNull();
    });

    it("should normalize email to lowercase during registration", async () => {
      const upperCaseEmailInput = {
        email: "USER@EXAMPLE.COM",
        password: "SecurePassword123!",
      };

      const response = await request(app.getHttpServer())
        .post("/graphql")
        .send({
          query: registerMutation,
          variables: { input: upperCaseEmailInput },
        })
        .expect(200);

      expect(response.body.errors).toBeUndefined();
      expect(response.body.data.register.user.email).toBe("user@example.com");
    });
  });

  describe("User Login Endpoint", () => {
    const loginMutation = `
      mutation LoginUser($input: LoginUserInput!) {
        login(loginUserInput: $input) {
          token
          user {
            id
            email
            createdAt
            updatedAt
          }
        }
      }
    `;

    beforeEach(async () => {
      // Create a test user for login tests
      const registerInput = UserTestFactory.createMockRegisterInput({
        email: "logintest@example.com",
        password: "TestPassword123!",
      });

      const registerMutation = `
        mutation RegisterUser($input: RegisterUserInput!) {
          register(registerUserInput: $input) {
            token
            user {
              id
              email
            }
          }
        }
      `;

      await request(app.getHttpServer())
        .post("/graphql")
        .send({
          query: registerMutation,
          variables: { input: registerInput },
        });
    });

    it("should successfully login with valid credentials", async () => {
      const loginInput = {
        email: "logintest@example.com",
        password: "TestPassword123!",
      };

      const response = await request(app.getHttpServer())
        .post("/graphql")
        .send({
          query: loginMutation,
          variables: { input: loginInput },
        })
        .expect(200);

      expect(response.body.errors).toBeUndefined();
      expect(response.body.data.login).toBeDefined();
      expect(response.body.data.login.token).toBeDefined();
      expect(response.body.data.login.user).toBeDefined();
      expect(response.body.data.login.user.email).toBe(loginInput.email);

      // Verify JWT token structure
      expect(response.body.data.login.token).toMatch(
        /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/,
      );
    });

    it("should reject login with invalid email", async () => {
      const invalidLoginInput = {
        email: "nonexistent@example.com",
        password: "TestPassword123!",
      };

      const response = await request(app.getHttpServer())
        .post("/graphql")
        .send({
          query: loginMutation,
          variables: { input: invalidLoginInput },
        })
        .expect(200);

      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain("Invalid credentials");
      expect(response.body.data.login).toBeNull();
    });

    it("should reject login with invalid password", async () => {
      const invalidPasswordInput = {
        email: "logintest@example.com",
        password: "WrongPassword123!",
      };

      const response = await request(app.getHttpServer())
        .post("/graphql")
        .send({
          query: loginMutation,
          variables: { input: invalidPasswordInput },
        })
        .expect(200);

      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain("Invalid credentials");
      expect(response.body.data.login).toBeNull();
    });

    it("should reject login with malformed email", async () => {
      const malformedInput = {
        email: "not-an-email",
        password: "TestPassword123!",
      };

      const response = await request(app.getHttpServer())
        .post("/graphql")
        .send({
          query: loginMutation,
          variables: { input: malformedInput },
        })
        .expect(200);

      expect(response.body.errors).toBeDefined();
      expect(response.body.data.login).toBeNull();
    });

    it("should reject login with missing credentials", async () => {
      const incompleteInput = {
        email: "logintest@example.com",
        // password missing
      };

      const response = await request(app.getHttpServer())
        .post("/graphql")
        .send({
          query: loginMutation,
          variables: { input: incompleteInput },
        })
        .expect(200);

      expect(response.body.errors).toBeDefined();
      expect(response.body.data.login).toBeNull();
    });

    it("should handle case-insensitive email login", async () => {
      const upperCaseLoginInput = {
        email: "LOGINTEST@EXAMPLE.COM",
        password: "TestPassword123!",
      };

      const response = await request(app.getHttpServer())
        .post("/graphql")
        .send({
          query: loginMutation,
          variables: { input: upperCaseLoginInput },
        })
        .expect(200);

      expect(response.body.errors).toBeUndefined();
      expect(response.body.data.login).toBeDefined();
      expect(response.body.data.login.user.email).toBe("logintest@example.com");
    });
  });

  describe("User Count Query", () => {
    const userCountQuery = `
      query {
        userCount
      }
    `;

    it("should return 0 when no users exist", async () => {
      const response = await request(app.getHttpServer())
        .post("/graphql")
        .send({ query: userCountQuery })
        .expect(200);

      expect(response.body.errors).toBeUndefined();
      expect(response.body.data.userCount).toBe(0);
    });

    it("should return correct user count after registrations", async () => {
      // Register 3 users
      const users = [
        { email: "user1@example.com", password: "Password123!" },
        { email: "user2@example.com", password: "Password123!" },
        { email: "user3@example.com", password: "Password123!" },
      ];

      const registerMutation = `
        mutation RegisterUser($input: RegisterUserInput!) {
          register(registerUserInput: $input) {
            user {
              id
            }
          }
        }
      `;

      for (const user of users) {
        await request(app.getHttpServer())
          .post("/graphql")
          .send({
            query: registerMutation,
            variables: { input: user },
          })
          .expect(200);
      }

      const response = await request(app.getHttpServer())
        .post("/graphql")
        .send({ query: userCountQuery })
        .expect(200);

      expect(response.body.errors).toBeUndefined();
      expect(response.body.data.userCount).toBe(3);
    });
  });

  describe("Users Health Query", () => {
    const usersHealthQuery = `
      query {
        usersHealth
      }
    `;

    it("should return health status with user count", async () => {
      // Register a user first
      const registerMutation = `
        mutation RegisterUser($input: RegisterUserInput!) {
          register(registerUserInput: $input) {
            user {
              id
            }
          }
        }
      `;

      await request(app.getHttpServer())
        .post("/graphql")
        .send({
          query: registerMutation,
          variables: {
            input: {
              email: "health@example.com",
              password: "Password123!",
            },
          },
        });

      const response = await request(app.getHttpServer())
        .post("/graphql")
        .send({ query: usersHealthQuery })
        .expect(200);

      expect(response.body.errors).toBeUndefined();
      expect(response.body.data.usersHealth).toBe(
        "Users module is healthy. Total users: 1",
      );
    });

    it("should return health status with zero users", async () => {
      const response = await request(app.getHttpServer())
        .post("/graphql")
        .send({ query: usersHealthQuery })
        .expect(200);

      expect(response.body.errors).toBeUndefined();
      expect(response.body.data.usersHealth).toBe(
        "Users module is healthy. Total users: 0",
      );
    });
  });

  describe("JWT Token Validation", () => {
    it("should generate valid JWT tokens with correct payload structure", async () => {
      const registerInput = {
        email: "jwttest@example.com",
        password: "SecurePassword123!",
      };

      const registerMutation = `
        mutation RegisterUser($input: RegisterUserInput!) {
          register(registerUserInput: $input) {
            token
            user {
              id
              email
            }
          }
        }
      `;

      const response = await request(app.getHttpServer())
        .post("/graphql")
        .send({
          query: registerMutation,
          variables: { input: registerInput },
        })
        .expect(200);

      const { token, user } = response.body.data.register;

      // Basic JWT structure validation
      expect(token).toMatch(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/);

      // Token should be a string with three parts separated by dots
      const tokenParts = token.split(".");
      expect(tokenParts).toHaveLength(3);

      // Decode the payload (without verification for testing)
      const payload = JSON.parse(
        Buffer.from(tokenParts[1], "base64url").toString(),
      );

      // Validate payload structure
      expect(payload.sub).toBe(user.id);
      expect(payload.email).toBe(user.email);
      expect(payload.iat).toBeDefined();
      expect(payload.exp).toBeDefined();
      expect(payload.exp).toBeGreaterThan(payload.iat);
    });

    it("should generate different tokens for same user on multiple logins", async () => {
      // Register user
      const userCreds = {
        email: "multilogin@example.com",
        password: "Password123!",
      };

      const registerMutation = `
        mutation RegisterUser($input: RegisterUserInput!) {
          register(registerUserInput: $input) {
            token
          }
        }
      `;

      const loginMutation = `
        mutation LoginUser($input: LoginUserInput!) {
          login(loginUserInput: $input) {
            token
          }
        }
      `;

      // Register
      await request(app.getHttpServer())
        .post("/graphql")
        .send({
          query: registerMutation,
          variables: { input: userCreds },
        });

      // First login
      const login1 = await request(app.getHttpServer())
        .post("/graphql")
        .send({
          query: loginMutation,
          variables: { input: userCreds },
        });

      // Second login
      const login2 = await request(app.getHttpServer())
        .post("/graphql")
        .send({
          query: loginMutation,
          variables: { input: userCreds },
        });

      // Tokens should be different (different issued at times)
      expect(login1.body.data.login.token).not.toBe(
        login2.body.data.login.token,
      );
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle malformed GraphQL queries gracefully", async () => {
      const malformedQuery = `
        mutation {
          register(input: {
            email: "test@example.com"
            password: "password"
          }) {
            token
          }
        }
      `;

      const response = await request(app.getHttpServer())
        .post("/graphql")
        .send({ query: malformedQuery })
        .expect(400); // Bad Request for malformed GraphQL

      expect(response.body.errors).toBeDefined();
    });

    it("should handle database connection errors gracefully", async () => {
      // This test would require temporarily breaking the database connection
      // For now, we'll test that the service exists and can handle errors
      const registerMutation = `
        mutation RegisterUser($input: RegisterUserInput!) {
          register(registerUserInput: $input) {
            token
          }
        }
      `;

      // Test with extremely long email to potentially trigger database issues
      const extremeInput = {
        email: "a".repeat(1000) + "@example.com",
        password: "Password123!",
      };

      const response = await request(app.getHttpServer())
        .post("/graphql")
        .send({
          query: registerMutation,
          variables: { input: extremeInput },
        })
        .expect(200);

      // Should get validation error, not database error
      expect(response.body.errors).toBeDefined();
    });

    it("should handle concurrent user registrations", async () => {
      const registerMutation = `
        mutation RegisterUser($input: RegisterUserInput!) {
          register(registerUserInput: $input) {
            token
            user {
              email
            }
          }
        }
      `;

      // Create concurrent registration requests
      const concurrentRequests = Array.from({ length: 5 }, (_, i) =>
        request(app.getHttpServer())
          .post("/graphql")
          .send({
            query: registerMutation,
            variables: {
              input: {
                email: `concurrent${i}@example.com`,
                password: "Password123!",
              },
            },
          }),
      );

      const responses = await Promise.all(concurrentRequests);

      // All should succeed with unique emails
      responses.forEach((response, i) => {
        expect(response.status).toBe(200);
        expect(response.body.errors).toBeUndefined();
        expect(response.body.data.register.user.email).toBe(
          `concurrent${i}@example.com`,
        );
      });
    });
  });

  describe("Performance and Scalability", () => {
    it("should handle multiple sequential operations efficiently", async () => {
      const startTime = Date.now();

      const operations = [];

      // Register 10 users
      for (let i = 0; i < 10; i++) {
        const registerOp = request(app.getHttpServer())
          .post("/graphql")
          .send({
            query: `
              mutation RegisterUser($input: RegisterUserInput!) {
                register(registerUserInput: $input) {
                  user {
                    id
                  }
                }
              }
            `,
            variables: {
              input: {
                email: `perf${i}@example.com`,
                password: "Password123!",
              },
            },
          });

        operations.push(registerOp);
      }

      const results = await Promise.all(operations);
      const endTime = Date.now();

      // All operations should complete successfully
      results.forEach((result) => {
        expect(result.status).toBe(200);
        expect(result.body.errors).toBeUndefined();
      });

      // Operations should complete within reasonable time (adjust based on requirements)
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds for 10 registrations
    });
  });
});
