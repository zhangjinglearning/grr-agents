import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable } from 'rxjs';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    // Handle GraphQL context
    if (context.getType() as string === 'graphql') {
      const gqlContext = GqlExecutionContext.create(context);
      const { req } = gqlContext.getContext();
      return super.canActivate(new ExecutionContextHost([req]));
    }

    // Handle HTTP context
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (err || !user) {
      throw err || new UnauthorizedException('Invalid or expired token');
    }
    return user;
  }

  getRequest(context: ExecutionContext) {
    if (context.getType() as string === 'graphql') {
      const gqlContext = GqlExecutionContext.create(context);
      return gqlContext.getContext().req;
    }
    return context.switchToHttp().getRequest();
  }
}

// Helper class for GraphQL context handling
class ExecutionContextHost implements ExecutionContext {
  constructor(private readonly args: any[]) {}

  getClass<T = any>(): any {
    return null;
  }

  getHandler(): any {
    return null;
  }

  getArgs<T extends Array<any> = any[]>(): T {
    return this.args as T;
  }

  getArgByIndex<T = any>(index: number): T {
    return this.args[index];
  }

  switchToRpc(): any {
    return null;
  }

  switchToHttp(): any {
    return {
      getRequest: () => this.args[0],
      getResponse: () => this.args[1],
      getNext: () => this.args[2],
    };
  }

  switchToWs(): any {
    return null;
  }

  getType<TContext extends string = any>(): TContext {
    return 'http' as TContext;
  }
}
