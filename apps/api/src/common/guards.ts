import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { UserRole } from '@app/types';
import { IS_PUBLIC_KEY, ROLES_KEY } from './decorators';
import { ForbiddenError, UnauthorizedError } from './app-exception';
import type { AuthUser } from '../auth/types';

/** Global guard: requires a valid access token unless the route is @Public(). */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  handleRequest<TUser = AuthUser>(err: unknown, user: TUser): TUser {
    if (err || !user) {
      throw new UnauthorizedError();
    }
    return user;
  }
}

/** Enforces @Roles(...) after authentication. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!user) throw new UnauthorizedError();
    if (!required.includes(user.role)) {
      throw new ForbiddenError();
    }
    return true;
  }
}
