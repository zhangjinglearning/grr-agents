import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { RegisterUserInput } from '../users/dto/register-user.input';
import { User } from '../users/user.entity';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;
  let configService: ConfigService;

  // Mock data
  const mockUser: User = {
    id: '507f1f77bcf86cd799439011',
    email: 'test@example.com',
    password: 'hashedPassword123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUserDocument = {
    ...mockUser,
    _id: '507f1f77bcf86cd799439011',
    toObject: jest.fn(),
  };

  const mockRegisterInput: RegisterUserInput = {
    email: 'test@example.com',
    password: 'Password123!',
  };

  const mockJwtToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            createUser: jest.fn(),
            findByEmail: jest.fn(),
            findById: jest.fn(),
            verifyPassword: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn(),
            verifyAsync: jest.fn(),
            decode: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);

    // Setup default config service responses
    (configService.get as jest.Mock).mockImplementation((key: string, defaultValue?: string) => {
      switch (key) {
        case 'JWT_EXPIRES_IN':
          return defaultValue || '7d';
        case 'JWT_SECRET':
          return defaultValue || 'test-secret';
        default:
          return defaultValue;
      }
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('register', () => {
    it('should successfully register a new user and return auth payload', async () => {
      // Arrange
      (usersService.createUser as jest.Mock).mockResolvedValue(mockUser);
      (jwtService.signAsync as jest.Mock).mockResolvedValue(mockJwtToken);

      // Act
      const result = await service.register(mockRegisterInput);

      // Assert
      expect(result).toEqual({
        token: mockJwtToken,
        user: mockUser,
      });
      expect(usersService.createUser).toHaveBeenCalledWith(mockRegisterInput);
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        {
          sub: mockUser.id,
          email: mockUser.email,
        },
        {
          expiresIn: '7d',
          secret: 'test-secret',
        }
      );
    });

    it('should propagate errors from user creation', async () => {
      // Arrange
      const error = new Error('User creation failed');
      (usersService.createUser as jest.Mock).mockRejectedValue(error);

      // Act & Assert
      await expect(service.register(mockRegisterInput)).rejects.toThrow(error);
    });
  });

  describe('login', () => {
    it('should successfully authenticate user and return auth payload', async () => {
      // Arrange
      (mockUserDocument.toObject as jest.Mock).mockReturnValue(mockUser);
      (usersService.findByEmail as jest.Mock).mockResolvedValue(mockUserDocument);
      (usersService.verifyPassword as jest.Mock).mockResolvedValue(true);
      (jwtService.signAsync as jest.Mock).mockResolvedValue(mockJwtToken);

      // Act
      const result = await service.login('test@example.com', 'Password123!');

      // Assert
      expect(result).toEqual({
        token: mockJwtToken,
        user: mockUser,
      });
      expect(usersService.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(usersService.verifyPassword).toHaveBeenCalledWith('Password123!', mockUser.password);
      expect(mockUserDocument.toObject).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when user not found', async () => {
      // Arrange
      (usersService.findByEmail as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(service.login('nonexistent@example.com', 'password'))
        .rejects
        .toThrow(UnauthorizedException);
      
      expect(usersService.verifyPassword).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when password is invalid', async () => {
      // Arrange
      (usersService.findByEmail as jest.Mock).mockResolvedValue(mockUserDocument);
      (usersService.verifyPassword as jest.Mock).mockResolvedValue(false);

      // Act & Assert
      await expect(service.login('test@example.com', 'wrongpassword'))
        .rejects
        .toThrow(UnauthorizedException);
    });
  });

  describe('validateUser', () => {
    it('should return user when found', async () => {
      // Arrange
      (mockUserDocument.toObject as jest.Mock).mockReturnValue(mockUser);
      (usersService.findById as jest.Mock).mockResolvedValue(mockUserDocument);

      // Act
      const result = await service.validateUser('507f1f77bcf86cd799439011');

      // Assert
      expect(result).toEqual(mockUser);
      expect(usersService.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(mockUserDocument.toObject).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when user not found', async () => {
      // Arrange
      (usersService.findById as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(service.validateUser('nonexistent-id'))
        .rejects
        .toThrow(UnauthorizedException);
    });
  });

  describe('verifyToken', () => {
    it('should successfully verify valid token', async () => {
      // Arrange
      const mockPayload = {
        sub: '507f1f77bcf86cd799439011',
        email: 'test@example.com',
        iat: 1609459200,
        exp: 1610064000,
      };
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue(mockPayload);

      // Act
      const result = await service.verifyToken(mockJwtToken);

      // Assert
      expect(result).toEqual(mockPayload);
      expect(jwtService.verifyAsync).toHaveBeenCalledWith(mockJwtToken, {
        secret: 'test-secret',
      });
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      // Arrange
      (jwtService.verifyAsync as jest.Mock).mockRejectedValue(new Error('Invalid token'));

      // Act & Assert
      await expect(service.verifyToken('invalid-token'))
        .rejects
        .toThrow(UnauthorizedException);
    });
  });

  describe('decodeToken', () => {
    it('should decode token without verification', () => {
      // Arrange
      const mockPayload = {
        sub: '507f1f77bcf86cd799439011',
        email: 'test@example.com',
        iat: 1609459200,
        exp: 1610064000,
      };
      (jwtService.decode as jest.Mock).mockReturnValue(mockPayload);

      // Act
      const result = service.decodeToken(mockJwtToken);

      // Assert
      expect(result).toEqual(mockPayload);
      expect(jwtService.decode).toHaveBeenCalledWith(mockJwtToken);
    });

    it('should return null for invalid token', () => {
      // Arrange
      (jwtService.decode as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act
      const result = service.decodeToken('invalid-token');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('generateToken (private method behavior)', () => {
    it('should generate token with correct payload structure', async () => {
      // Arrange
      (usersService.createUser as jest.Mock).mockResolvedValue(mockUser);
      (jwtService.signAsync as jest.Mock).mockResolvedValue(mockJwtToken);

      // Act
      await service.register(mockRegisterInput);

      // Assert - verify the token generation call structure
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        {
          sub: mockUser.id,
          email: mockUser.email,
        },
        expect.objectContaining({
          expiresIn: expect.any(String),
          secret: expect.any(String),
        })
      );
    });

    it('should use configuration values for token generation', async () => {
      // Arrange
      (configService.get as jest.Mock)
        .mockReturnValueOnce('30d') // JWT_EXPIRES_IN
        .mockReturnValueOnce('custom-secret'); // JWT_SECRET
      
      (usersService.createUser as jest.Mock).mockResolvedValue(mockUser);
      (jwtService.signAsync as jest.Mock).mockResolvedValue(mockJwtToken);

      // Act
      await service.register(mockRegisterInput);

      // Assert
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.any(Object),
        {
          expiresIn: '30d',
          secret: 'custom-secret',
        }
      );
    });
  });
});