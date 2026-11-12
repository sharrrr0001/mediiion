'use client';
import * as React from 'react';
import QRCode from 'qrcode';
import { cn } from '../cn';

/** Renders `value` as a QR image (generated in the browser, no network call). */
export function QrCode({ value, label, className }: { value: string; label: string; className?: string }) {
  const [src, setSrc] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    QRCode.toDataURL(value, { errorCorrectionLevel: 'M', margin: 1, width: 640, color: { dark: '#06402F', light: '#FFFFFF' } })
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setSrc(null));
    return () => {
      alive = false;
    };
  }, [value]);

  return (
    <div className={cn('aspect-square w-full rounded-xl bg-white p-3', className)}>
      {src ? (
        <img src={src} alt={label} className="size-full [image-rendering:pixelated]" />
      ) : (
        <div aria-hidden className="size-full animate-pulse rounded-lg bg-surface-2" />
      )}
    </div>
  );
}
