// Typed, stable error codes returned by the API. The global exception filter
// maps every failure to one of these — no stack traces or internal details leak.

export const ErrorCode = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
  RATE_LIMITED: 'RATE_LIMITED',
  UNPROCESSABLE: 'UNPROCESSABLE',
  INTERNAL: 'INTERNAL',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ApiErrorBody {
  code: ErrorCode;
  message: string;
  /** Optional field-level validation issues. */
  details?: ApiErrorDetail[];
  /** Correlation id for tracing (matches server logs). */
  correlationId?: string;
}

export interface ApiErrorDetail {
  path: string;
  message: string;
}
