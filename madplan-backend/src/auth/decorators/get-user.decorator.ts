import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export const GetUser = createParamDecorator(
  (data: string, context: ExecutionContext) => {
    let user: any;

    if (context.getType() as string === 'graphql') {
      const gqlContext = GqlExecutionContext.create(context);
      user = gqlContext.getContext().req.user;
    } else {
      const request = context.switchToHttp().getRequest();
      user = request.user;
    }

    return data ? user?.[data] : user;
  },
);

export const GetUserId = createParamDecorator(
  (data: unknown, context: ExecutionContext): string => {
    let user: any;

    if (context.getType() as string === 'graphql') {
      const gqlContext = GqlExecutionContext.create(context);
      user = gqlContext.getContext().req.user;
    } else {
      const request = context.switchToHttp().getRequest();
      user = request.user;
    }

    return user?.id || user?._id || user?.userId;
  },
);

export const GetUserEmail = createParamDecorator(
  (data: unknown, context: ExecutionContext): string => {
    let user: any;

    if (context.getType() as string === 'graphql') {
      const gqlContext = GqlExecutionContext.create(context);
      user = gqlContext.getContext().req.user;
    } else {
      const request = context.switchToHttp().getRequest();
      user = request.user;
    }

    return user?.email;
  },
);
