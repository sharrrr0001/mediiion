import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Response } from 'express';

/** Consistent API error: `{ error: { code, message, ...extra } }`. */
export class AppError extends HttpException {
  constructor(status: HttpStatus, code: string, message: string, extra: Record<string, unknown> = {}) {
    super({ error: { code, message, ...extra } }, status);
  }
}

const GENERIC_MESSAGE = 'Kuch gadbad ho gayi. Thodi der baad try karein. / Something went wrong, please try again.';

const STATUS_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMITED',
};

/** Never leaks stack traces, SQL or internal paths. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errors');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof ThrottlerException) {
      res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Bahut zyada koshish. Thodi der baad try karein.' } });
      return;
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'object' && body !== null && 'error' in body) {
        res.status(status).json(body);
        return;
      }
      res.status(status).json({ error: { code: STATUS_CODES[status] ?? 'ERROR', message: exception.message } });
      return;
    }
    // Log only the error name/message — request bodies may contain PHI.
    const err = exception instanceof Error ? exception : new Error(String(exception));
    this.logger.error({ err: { name: err.name, message: err.message, stack: err.stack } }, 'Unhandled error');
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: { code: 'INTERNAL', message: GENERIC_MESSAGE } });
  }
}
