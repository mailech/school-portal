import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Prisma } from '@app/db';
import { InvalidStateTransitionError } from '@app/core';
import { ErrorCode, type ApiErrorBody } from '@app/types';
import type { Request, Response } from 'express';

/**
 * Single funnel for every error. Deliberate errors (AppException) pass through
 * with their code; framework/Prisma/domain errors are mapped to typed codes;
 * anything unexpected becomes a clean 500 with a correlation id — never a stack
 * trace or internal detail.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { id?: string }>();
    const correlationId = req?.id ?? undefined;

    const { status, body } = this.map(exception);
    const payload: ApiErrorBody = { ...body, correlationId };

    if (status >= 500) {
      this.logger.error(
        `[${correlationId ?? '-'}] ${req?.method} ${req?.url} -> ${status} ${body.code}: ${
          body.message
        }`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(
        `[${correlationId ?? '-'}] ${req?.method} ${req?.url} -> ${status} ${body.code}: ${body.message}`,
      );
    }

    res.status(status).json(payload);
  }

  private map(exception: unknown): { status: number; body: ApiErrorBody } {
    // 1) Our deliberate exceptions (and any Nest HttpException).
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const resp = exception.getResponse();
      if (exception instanceof ThrottlerException) {
        return {
          status: HttpStatus.TOO_MANY_REQUESTS,
          body: { code: ErrorCode.RATE_LIMITED, message: 'Too many requests. Please slow down.' },
        };
      }
      if (typeof resp === 'object' && resp !== null && 'code' in resp) {
        const r = resp as { code: ErrorCode; message?: string; details?: ApiErrorBody['details'] };
        return {
          status,
          body: {
            code: r.code,
            message: r.message ?? exception.message,
            details: r.details,
          },
        };
      }
      // Plain Nest exception (e.g. NotFoundException from routing).
      const message =
        typeof resp === 'string'
          ? resp
          : ((resp as { message?: string | string[] }).message ?? exception.message);
      return {
        status,
        body: {
          code: this.statusToCode(status),
          message: Array.isArray(message) ? message.join('; ') : message,
        },
      };
    }

    // 2) Domain state-machine violations.
    if (exception instanceof InvalidStateTransitionError) {
      return {
        status: HttpStatus.CONFLICT,
        body: { code: ErrorCode.INVALID_STATE_TRANSITION, message: exception.message },
      };
    }

    // 3) Prisma known request errors.
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.mapPrisma(exception);
    }
    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        body: { code: ErrorCode.VALIDATION_FAILED, message: 'Invalid query parameters.' },
      };
    }

    // 4) Unknown — do not leak.
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { code: ErrorCode.INTERNAL, message: 'An unexpected error occurred.' },
    };
  }

  private mapPrisma(e: Prisma.PrismaClientKnownRequestError): {
    status: number;
    body: ApiErrorBody;
  } {
    switch (e.code) {
      case 'P2002': {
        const target = (e.meta?.target as string[] | undefined)?.join(', ');
        return {
          status: HttpStatus.CONFLICT,
          body: {
            code: ErrorCode.CONFLICT,
            message: target
              ? `A record with this ${target} already exists.`
              : 'This record already exists.',
          },
        };
      }
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          body: { code: ErrorCode.NOT_FOUND, message: 'The requested record was not found.' },
        };
      case 'P2003':
        return {
          status: HttpStatus.CONFLICT,
          body: {
            code: ErrorCode.CONFLICT,
            message: 'This action conflicts with related records.',
          },
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          body: { code: ErrorCode.INTERNAL, message: 'A database error occurred.' },
        };
    }
  }

  private statusToCode(status: number): ErrorCode {
    switch (status) {
      case 400:
        return ErrorCode.VALIDATION_FAILED;
      case 401:
        return ErrorCode.UNAUTHORIZED;
      case 403:
        return ErrorCode.FORBIDDEN;
      case 404:
        return ErrorCode.NOT_FOUND;
      case 409:
        return ErrorCode.CONFLICT;
      case 422:
        return ErrorCode.UNPROCESSABLE;
      case 429:
        return ErrorCode.RATE_LIMITED;
      default:
        return ErrorCode.INTERNAL;
    }
  }
}
