import { Resolver, Mutation, Args, Query } from '@nestjs/graphql';
import { ValidationPipe } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { UsersService } from './users.service';
import { RegisterUserInput } from './dto/register-user.input';
import { AuthPayload } from './dto/auth-payload.dto';
import { User } from './user.entity';

@Resolver(() => User)
export class UsersResolver {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Register a new user
   * @param registerUserInput - User registration data
   * @returns AuthPayload containing JWT token and user data
   */
  @Mutation(() => AuthPayload, {
    description: 'Register a new user account with email and password',
  })
  async register(
    @Args('input', new ValidationPipe({ transform: true })) 
    registerUserInput: RegisterUserInput,
  ): Promise<AuthPayload> {
    return this.authService.register(registerUserInput);
  }

  /**
   * Login user with email and password
   * @param email - User's email address
   * @param password - User's password
   * @returns AuthPayload containing JWT token and user data
   */
  @Mutation(() => AuthPayload, {
    description: 'Login user with email and password',
  })
  async login(
    @Args('email') email: string,
    @Args('password') password: string,
  ): Promise<AuthPayload> {
    return this.authService.login(email, password);
  }

  /**
   * Get user count (for testing and admin purposes)
   * @returns Total number of registered users
   */
  @Query(() => Number, {
    description: 'Get total number of registered users',
  })
  async userCount(): Promise<number> {
    return this.usersService.getUserCount();
  }

  /**
   * Health check query for users module
   * @returns Simple confirmation message
   */
  @Query(() => String, {
    description: 'Health check for users module',
  })
  async usersHealth(): Promise<string> {
    const count = await this.usersService.getUserCount();
    return `Users module is healthy. Total users: ${count}`;
  }
}