import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode, type ApiErrorDetail } from '@app/types';

/** Base for every deliberate error the API returns. Carries a stable code so
 *  clients can branch on failure type without parsing messages. */
export class AppException extends HttpException {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    status: HttpStatus,
    public readonly details?: ApiErrorDetail[],
  ) {
    super({ code, message, details }, status);
  }
}

export class ValidationError extends AppException {
  constructor(message = 'Validation failed', details?: ApiErrorDetail[]) {
    super(ErrorCode.VALIDATION_FAILED, message, HttpStatus.BAD_REQUEST, details);
  }
}

export class UnauthorizedError extends AppException {
  constructor(message = 'Not authenticated') {
    super(ErrorCode.UNAUTHORIZED, message, HttpStatus.UNAUTHORIZED);
  }
}

export class ForbiddenError extends AppException {
  constructor(message = 'You do not have permission to perform this action') {
    super(ErrorCode.FORBIDDEN, message, HttpStatus.FORBIDDEN);
  }
}

export class NotFoundError extends AppException {
  constructor(message = 'Resource not found') {
    super(ErrorCode.NOT_FOUND, message, HttpStatus.NOT_FOUND);
  }
}

export class ConflictError extends AppException {
  constructor(message = 'Conflict', details?: ApiErrorDetail[]) {
    super(ErrorCode.CONFLICT, message, HttpStatus.CONFLICT, details);
  }
}

export class InvalidStateError extends AppException {
  constructor(message = 'This action is not allowed in the current state') {
    super(ErrorCode.INVALID_STATE_TRANSITION, message, HttpStatus.CONFLICT);
  }
}

export class UnprocessableError extends AppException {
  constructor(message = 'Cannot process request', details?: ApiErrorDetail[]) {
    super(ErrorCode.UNPROCESSABLE, message, HttpStatus.UNPROCESSABLE_ENTITY, details);
  }
}
