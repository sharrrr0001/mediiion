/**
 * PHI redaction for pino (spec §11: no PHI in logs).
 * Request/response serializers keep only method, path and status — no headers, bodies or query strings.
 */
export const REDACT_PATHS = [
  'req.headers',
  'req.body',
  'req.query',
  'res.headers',
  '*.phone',
  '*.email',
  '*.name',
  '*.dob',
  '*.code',
  '*.text',
  '*.token',
  '*.password',
  '*.cookie',
  '*.authorization',
  'phone',
  'email',
  'name',
  'dob',
  'code',
  'text',
  'token',
];

interface MinimalReq {
  method?: string;
  url?: string;
  id?: unknown;
}

export const serializers = {
  req: (req: MinimalReq) => ({ id: req.id, method: req.method, path: (req.url ?? '').split('?')[0] }),
  res: (res: { statusCode?: number }) => ({ statusCode: res.statusCode }),
};

export const pinoRedact = { paths: REDACT_PATHS, censor: '[redacted]' };
