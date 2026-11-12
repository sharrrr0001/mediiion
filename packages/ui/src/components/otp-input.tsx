'use client';
import * as React from 'react';
import { cn } from '../cn';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  label: string;
  invalid?: boolean;
  autoFocus?: boolean;
}

/** 6 boxes; paste-friendly; first box carries autocomplete="one-time-code" for SMS autofill. */
export function OtpInput({ value, onChange, length = 6, label, invalid, autoFocus }: OtpInputProps) {
  const refs = React.useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  const setAt = (index: number, raw: string) => {
    const clean = raw.replace(/\D/g, '');
    if (clean.length > 1) {
      // Pasted or autofilled the whole code.
      const next = clean.slice(0, length);
      onChange(next);
      refs.current[Math.min(next.length, length - 1)]?.focus();
      return;
    }
    const chars = digits.slice();
    chars[index] = clean;
    onChange(chars.join('').slice(0, length));
    if (clean && index < length - 1) refs.current[index + 1]?.focus();
  };

  return (
    <div role="group" aria-label={label} className="flex justify-between gap-2">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d}
          onChange={(e) => setAt(i, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus();
            if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
            if (e.key === 'ArrowRight' && i < length - 1) refs.current[i + 1]?.focus();
          }}
          onFocus={(e) => e.target.select()}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          pattern="[0-9]*"
          maxLength={i === 0 ? length : 1}
          autoFocus={autoFocus && i === 0}
          aria-label={`${label} ${i + 1}`}
          aria-invalid={invalid || undefined}
          className={cn(
            'h-14 w-full min-w-0 max-w-14 rounded-[var(--radius-control)] border border-line bg-surface text-center font-mono text-2xl font-semibold text-ink shadow-sm focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15',
            invalid && 'border-danger',
          )}
        />
      ))}
    </div>
  );
}
