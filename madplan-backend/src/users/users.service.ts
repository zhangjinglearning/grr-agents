import {
  Injectable,
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import * as bcrypt from "bcrypt";
import { User, UserDocument } from "./user.entity";
import { RegisterUserInput } from "./dto/register-user.input";

@Injectable()
export class UsersService {
  private readonly saltRounds = parseInt(
    process.env.BCRYPT_SALT_ROUNDS || "12",
  );

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  /**
   * Create a new user with hashed password
   * @param registerUserInput - User registration data
   * @returns Created user (without password)
   * @throws ConflictException if email already exists
   * @throws BadRequestException for validation errors
   * @throws InternalServerErrorException for database errors
   */
  async createUser(registerUserInput: RegisterUserInput): Promise<User> {
    try {
      const { email, password } = registerUserInput;

      // Check if user already exists
      const existingUser = await this.findByEmail(email);
      if (existingUser) {
        throw new ConflictException(
          "An account with this email address already exists",
        );
      }

      // Hash the password
      const hashedPassword = await this.hashPassword(password);

      // Create new user
      const newUser = new this.userModel({
        email: email.toLowerCase().trim(),
        password: hashedPassword,
      });

      // Save to database
      const savedUser = await newUser.save();

      // Return user without password (handled by schema transform)
      return savedUser.toObject();
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }

      // Handle MongoDB duplicate key error (E11000)
      if (error.code === 11000 && error.keyPattern?.email) {
        throw new ConflictException(
          "An account with this email address already exists",
        );
      }

      // Handle validation errors
      if (error.name === "ValidationError") {
        const messages = Object.values(error.errors).map(
          (err: any) => err.message,
        );
        throw new BadRequestException(
          `Validation failed: ${messages.join(", ")}`,
        );
      }

      // Handle other database errors
      throw new InternalServerErrorException(
        "Failed to create user account. Please try again later.",
      );
    }
  }

  /**
   * Find user by email
   * @param email - User's email address
   * @returns User document or null if not found
   */
  async findByEmail(email: string): Promise<UserDocument | null> {
    try {
      return await this.userModel
        .findOne({
          email: email.toLowerCase().trim(),
        })
        .exec();
    } catch (error) {
      throw new InternalServerErrorException(
        "Failed to search for user. Please try again later.",
      );
    }
  }

  /**
   * Find user by ID
   * @param id - User's unique identifier
   * @returns User document or null if not found
   */
  async findById(id: string): Promise<UserDocument | null> {
    try {
      return await this.userModel.findById(id).exec();
    } catch (error) {
      throw new InternalServerErrorException(
        "Failed to find user. Please try again later.",
      );
    }
  }

  /**
   * Hash password using bcrypt
   * @param password - Plain text password
   * @returns Hashed password
   * @private
   */
  private async hashPassword(password: string): Promise<string> {
    try {
      return await bcrypt.hash(password, this.saltRounds);
    } catch (error) {
      throw new InternalServerErrorException(
        "Failed to process password. Please try again later.",
      );
    }
  }

  /**
   * Verify password against hash
   * @param password - Plain text password
   * @param hashedPassword - Hashed password from database
   * @returns True if password matches, false otherwise
   */
  async verifyPassword(
    password: string,
    hashedPassword: string,
  ): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hashedPassword);
    } catch (error) {
      throw new InternalServerErrorException(
        "Failed to verify password. Please try again later.",
      );
    }
  }

  /**
   * Get user count (for testing and admin purposes)
   * @returns Total number of users
   */
  async getUserCount(): Promise<number> {
    try {
      return await this.userModel.countDocuments().exec();
    } catch (error) {
      throw new InternalServerErrorException(
        "Failed to get user count. Please try again later.",
      );
    }
  }
}
