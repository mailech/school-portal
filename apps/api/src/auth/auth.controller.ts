import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  changePasswordSchema,
  loginSchema,
  type ChangePasswordDto,
  type CurrentUser,
  type LoginDto,
} from '@app/types';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import { CurrentUser as CurrentUserParam, Public } from '../common/decorators';
import { zBody } from '../common/zod-validation.pipe';
import { AuthService } from './auth.service';
import { clearAuthCookies, setAuthCookies } from './cookies';
import type { SessionMeta } from './token.service';
import { REFRESH_COOKIE, type AuthUser } from './types';

function sessionMeta(req: Request): SessionMeta {
  return { userAgent: req.headers['user-agent'], ip: req.ip };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Public()
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  async login(
    @Body(zBody(loginSchema)) dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: CurrentUser }> {
    const { user, session } = await this.auth.login(dto, sessionMeta(req));
    setAuthCookies(res, this.config, session);
    return { user };
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: CurrentUser }> {
    const raw = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    const { user, session } = await this.auth.refresh(raw, sessionMeta(req));
    setAuthCookies(res, this.config, session);
    return { user };
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true }> {
    const raw = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    await this.auth.logout(raw);
    clearAuthCookies(res, this.config);
    return { ok: true };
  }

  @Get('me')
  async me(@CurrentUserParam() user: AuthUser): Promise<{ user: CurrentUser }> {
    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }

  @Post('change-password')
  @HttpCode(200)
  async changePassword(
    @CurrentUserParam('id') userId: string,
    @Body(zBody(changePasswordSchema)) dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true }> {
    await this.auth.changePassword(userId, dto);
    // All sessions were revoked; force the client to re-authenticate.
    clearAuthCookies(res, this.config);
    return { ok: true };
  }
}
