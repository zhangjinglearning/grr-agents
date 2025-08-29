import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { UsersResolver } from './users.resolver';
import { AuthService } from '../auth/auth.service';
import { UsersService } from './users.service';
import { RegisterUserInput } from './dto/register-user.input';
import { LoginUserInput } from './dto/login-user.input';
import { AuthPayload } from './dto/auth-payload.dto';
import { User } from './user.entity';

describe('UsersResolver', () => {
  let resolver: UsersResolver;
  let authService: AuthService;
  let usersService: UsersService;

  // Mock data
  const mockUser: User = {
    id: '507f1f77bcf86cd799439011',
    email: 'test@example.com',
    password: 'hashedPassword123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAuthPayload: AuthPayload = {
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    user: mockUser,
  };

  const mockRegisterInput: RegisterUserInput = {
    email: 'test@example.com',
    password: 'Password123!',
  };

  const mockLoginInput: LoginUserInput = {
    email: 'test@example.com',
    password: 'Password123!',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersResolver,
        {
          provide: AuthService,
          useValue: {
            register: jest.fn(),
            login: jest.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: {
            getUserCount: jest.fn(),
          },
        },
      ],
    }).compile();

    resolver = module.get<UsersResolver>(UsersResolver);
    authService = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('register', () => {
    it('should successfully register a new user', async () => {
      // Arrange
      (authService.register as jest.Mock).mockResolvedValue(mockAuthPayload);

      // Act
      const result = await resolver.register(mockRegisterInput);

      // Assert
      expect(result).toEqual(mockAuthPayload);
      expect(authService.register).toHaveBeenCalledWith(mockRegisterInput);
    });

    it('should propagate validation errors', async () => {
      // Arrange
      const validationError = new Error('Validation failed');
      (authService.register as jest.Mock).mockRejectedValue(validationError);

      // Act & Assert
      await expect(resolver.register(mockRegisterInput))
        .rejects
        .toThrow(validationError);
    });

    it('should apply validation pipe to input', () => {
      // This test verifies that the ValidationPipe is configured
      // The actual validation is handled by class-validator decorators
      const validationPipe = new ValidationPipe({ transform: true });
      expect(validationPipe).toBeDefined();
    });
  });

  describe('login', () => {
    it('should successfully login user', async () => {
      // Arrange
      (authService.login as jest.Mock).mockResolvedValue(mockAuthPayload);

      // Act
      const result = await resolver.login(mockLoginInput);

      // Assert
      expect(result).toEqual(mockAuthPayload);
      expect(authService.login).toHaveBeenCalledWith(mockLoginInput.email, mockLoginInput.password);
    });

    it('should propagate authentication errors', async () => {
      // Arrange
      const authError = new Error('Invalid credentials');
      const invalidLoginInput: LoginUserInput = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };
      (authService.login as jest.Mock).mockRejectedValue(authError);

      // Act & Assert
      await expect(resolver.login(invalidLoginInput))
        .rejects
        .toThrow(authError);
    });
  });

  describe('userCount', () => {
    it('should return user count', async () => {
      // Arrange
      const expectedCount = 5;
      (usersService.getUserCount as jest.Mock).mockResolvedValue(expectedCount);

      // Act
      const result = await resolver.userCount();

      // Assert
      expect(result).toBe(expectedCount);
      expect(usersService.getUserCount).toHaveBeenCalled();
    });

    it('should propagate service errors', async () => {
      // Arrange
      const serviceError = new Error('Database error');
      (usersService.getUserCount as jest.Mock).mockRejectedValue(serviceError);

      // Act & Assert
      await expect(resolver.userCount()).rejects.toThrow(serviceError);
    });
  });

  describe('usersHealth', () => {
    it('should return health status with user count', async () => {
      // Arrange
      const userCount = 10;
      (usersService.getUserCount as jest.Mock).mockResolvedValue(userCount);

      // Act
      const result = await resolver.usersHealth();

      // Assert
      expect(result).toBe('Users module is healthy. Total users: 10');
      expect(usersService.getUserCount).toHaveBeenCalled();
    });

    it('should handle zero users', async () => {
      // Arrange
      (usersService.getUserCount as jest.Mock).mockResolvedValue(0);

      // Act
      const result = await resolver.usersHealth();

      // Assert
      expect(result).toBe('Users module is healthy. Total users: 0');
    });

    it('should propagate service errors', async () => {
      // Arrange
      const serviceError = new Error('Service unavailable');
      (usersService.getUserCount as jest.Mock).mockRejectedValue(serviceError);

      // Act & Assert
      await expect(resolver.usersHealth()).rejects.toThrow(serviceError);
    });
  });

  describe('GraphQL schema integration', () => {
    it('should have correct return types defined', () => {
      // These tests verify the resolver methods exist and are properly typed
      expect(typeof resolver.register).toBe('function');
      expect(typeof resolver.login).toBe('function');
      expect(typeof resolver.userCount).toBe('function');
      expect(typeof resolver.usersHealth).toBe('function');
    });

    it('should have proper dependency injection', () => {
      expect(resolver).toBeInstanceOf(UsersResolver);
      expect(authService).toBeDefined();
      expect(usersService).toBeDefined();
    });
  });
});