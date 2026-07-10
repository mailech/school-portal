import { PipeTransform, Injectable } from '@nestjs/common';
import { ZodSchema } from 'zod';
import { ValidationError } from './app-exception';

/**
 * Validates and coerces request payloads against a Zod schema. Unknown fields
 * are stripped by object schemas (or rejected when `.strict()` is used). On
 * failure it throws a typed VALIDATION_FAILED with field-level details.
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      throw new ValidationError('One or more fields are invalid.', details);
    }
    return result.data;
  }
}

/** Convenience factory for inline use: `@Body(zBody(loginSchema))`. */
export function zBody<T>(schema: ZodSchema<T>): ZodValidationPipe<T> {
  return new ZodValidationPipe(schema);
}
