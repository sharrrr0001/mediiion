import { HttpStatus, PipeTransform } from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import { z } from 'zod';
import { AppError } from './errors';

/** Validates request input with a zod schema. Issues list paths + messages, never echoed values. */
export class ZodPipe<T extends z.ZodType> implements PipeTransform<unknown, z.infer<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.infer<T> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new AppError(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', 'Please check the highlighted fields.', {
        issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    return result.data;
  }
}

/** Swagger body documentation generated from the same zod schema. */
export function ZodBody(schema: z.ZodType) {
  const jsonSchema = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' });
  // Swagger's SchemaObject type is narrower than JSON Schema; the shapes are compatible at runtime.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ApiBody({ schema: jsonSchema as any });
}
