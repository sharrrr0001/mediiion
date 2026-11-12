import { CreateBucketCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ENV, type Env } from '../config/env';

/** Private object storage. Downloads only via pre-signed URLs of ≤ 5 minutes (spec §4/§11). */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger('Storage');
  private readonly s3: S3Client;
  static readonly URL_TTL_SECONDS = 300;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.s3 = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: !!env.S3_ENDPOINT,
      credentials:
        env.S3_ACCESS_KEY && env.S3_SECRET_KEY ? { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY } : undefined,
    });
  }

  /** Dev convenience: create the bucket if missing. Production buckets come from Terraform. */
  async onModuleInit() {
    if (this.env.NODE_ENV === 'production') return;
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.env.S3_BUCKET }));
    } catch {
      try {
        await this.s3.send(new CreateBucketCommand({ Bucket: this.env.S3_BUCKET }));
      } catch (e) {
        this.logger.warn(`Could not create bucket (uploads will fail): ${(e as Error).name}`);
      }
    }
  }

  async put(key: string, body: Buffer, contentType: string) {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.env.S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
        // KMS in production; the local SeaweedFS store ignores it.
        ServerSideEncryption: this.env.NODE_ENV === 'production' ? 'aws:kms' : undefined,
      }),
    );
  }

  signedGetUrl(key: string): Promise<string> {
    return getSignedUrl(this.s3, new GetObjectCommand({ Bucket: this.env.S3_BUCKET, Key: key }), {
      expiresIn: StorageService.URL_TTL_SECONDS,
    });
  }
}

/** Accepted upload types, detected from magic bytes — never from the file name or client header. */
export function sniffMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (buf.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  const ftyp = buf.subarray(4, 12).toString('ascii');
  if (/^ftyp(heic|heix|mif1|heim|heis)/.test(ftyp)) return 'image/heic';
  return null;
}

/** Hook for an antivirus scan (spec §11). No-op locally; wire ClamAV/S3 scanning in Phase 6. */
export async function scanForMalware(_buf: Buffer): Promise<'clean' | 'infected'> {
  return 'clean';
}
