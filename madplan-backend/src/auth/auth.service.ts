import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { UsersService } from "../users/users.service";
import { User, UserDocument } from "../users/user.entity";
import { RegisterUserInput } from "../users/dto/register-user.input";
import { AuthPayload } from "../users/dto/auth-payload.dto";

export interface JwtPayload {
  sub: string; // User ID
  email: string;
  iat?: number; // Issued at
  exp?: number; // Expiration time
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Register a new user and return authentication payload
   * @param registerUserInput - User registration data
   * @returns AuthPayload containing JWT token and user data
   */
  async register(registerUserInput: RegisterUserInput): Promise<AuthPayload> {
    // Create the user (this handles all validation and duplicate checking)
    const user = await this.usersService.createUser(registerUserInput);

    // Generate JWT token for the new user
    const token = await this.generateToken(user);

    return {
      token,
      user,
    };
  }

  /**
   * Authenticate user with email and password
   * @param email - User's email address
   * @param password - User's password
   * @returns AuthPayload containing JWT token and user data
   * @throws UnauthorizedException for invalid credentials
   */
  async login(email: string, password: string): Promise<AuthPayload> {
    // Find user by email
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException("Invalid email or password");
    }

    // Verify password
    const isPasswordValid = await this.usersService.verifyPassword(
      password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid email or password");
    }

    // Generate JWT token
    const token = await this.generateToken(user);

    return {
      token,
      user: user.toObject(), // Remove password from response
    };
  }

  /**
   * Validate user by ID (used by JWT strategy)
   * @param userId - User's unique identifier
   * @returns User document without password
   * @throws UnauthorizedException if user not found
   */
  async validateUser(userId: string): Promise<User> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    return user.toObject(); // Remove password from response
  }

  /**
   * Generate JWT token for user
   * @param user - User document or User object
   * @returns JWT token string
   * @private
   */
  private async generateToken(user: UserDocument | User): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id || (user as UserDocument)._id?.toString(),
      email: user.email,
    };

    return this.jwtService.signAsync(payload, {
      expiresIn: this.configService.get<string>("JWT_EXPIRES_IN", "7d"),
      secret: this.configService.get<string>("JWT_SECRET"),
    });
  }

  /**
   * Verify JWT token and return payload
   * @param token - JWT token string
   * @returns Decoded JWT payload
   * @throws UnauthorizedException for invalid tokens
   */
  async verifyToken(token: string): Promise<JwtPayload> {
    try {
      return await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>("JWT_SECRET"),
      });
    } catch (error) {
      throw new UnauthorizedException("Invalid or expired token");
    }
  }

  /**
   * Decode JWT token without verification (for debugging)
   * @param token - JWT token string
   * @returns Decoded token payload or null if invalid
   */
  decodeToken(token: string): JwtPayload | null {
    try {
      return this.jwtService.decode(token) as JwtPayload;
    } catch (error) {
      return null;
    }
  }
}
