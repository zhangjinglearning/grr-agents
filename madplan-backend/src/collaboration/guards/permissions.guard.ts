import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { CollaborationService } from '../collaboration.service';
import { SharePermission } from '../collaboration.entity';

export const RequirePermission = (permission: SharePermission) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata('required_permission', permission, descriptor.value);
    return descriptor;
  };
};

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private collaborationService: CollaborationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.get<SharePermission>(
      'required_permission',
      context.getHandler(),
    );

    if (!requiredPermission) {
      return true;
    }

    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    const args = ctx.getArgs();

    const userId = request.user?.userId;
    if (!userId) {
      throw new ForbiddenException('User not authenticated');
    }

    const boardId = this.extractBoardId(args);
    if (!boardId) {
      throw new ForbiddenException('Board ID not found');
    }

    const hasPermission = await this.collaborationService.hasPermission(
      boardId,
      userId,
      requiredPermission,
    );

    if (!hasPermission) {
      throw new ForbiddenException(`Insufficient permissions. Required: ${requiredPermission}`);
    }

    return true;
  }

  private extractBoardId(args: any): string | null {
    if (args.boardId) return args.boardId;
    if (args.input?.boardId) return args.input.boardId;
    if (args.data?.boardId) return args.data.boardId;
    return null;
  }
}