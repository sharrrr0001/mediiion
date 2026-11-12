'use client';
import * as React from 'react';
import { cn } from '../cn';

/**
 * Dialog and Sheet on the native <dialog> element: built-in focus trap, Escape to close and inert
 * background — accessible without a heavy dependency (keeps patient bundles small).
 */
function useDialog(open: boolean, onClose: () => void) {
  const ref = React.useRef<HTMLDialogElement>(null);
  React.useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  React.useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const handle = () => onClose();
    d.addEventListener('close', handle);
    return () => d.removeEventListener('close', handle);
  }, [onClose]);
  const onClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === ref.current) onClose(); // click on the backdrop
  };
  return { ref, onClick };
}

export function Dialog({ open, onClose, title, children, className }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; className?: string }) {
  const { ref, onClick } = useDialog(open, onClose);
  return (
    <dialog
      ref={ref}
      onClick={onClick}
      aria-label={title}
      className={cn('m-auto w-[min(92vw,480px)] rounded-card border border-line bg-surface p-6 text-ink shadow-lg backdrop:bg-[rgba(15,31,24,0.35)]', className)}
    >
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <div className="mt-3">{children}</div>
    </dialog>
  );
}

/** Slide-in panel (mobile menu, doctor drawer). */
export function Sheet({ open, onClose, side = 'right', label, children }: { open: boolean; onClose: () => void; side?: 'left' | 'right'; label: string; children: React.ReactNode }) {
  const { ref, onClick } = useDialog(open, onClose);
  return (
    <dialog
      ref={ref}
      onClick={onClick}
      aria-label={label}
      className={cn(
        'fixed inset-y-0 m-0 h-dvh max-h-dvh w-[min(86vw,340px)] max-w-none border-line bg-surface p-0 text-ink shadow-lg backdrop:bg-[rgba(15,31,24,0.35)]',
        side === 'left' ? 'left-0 mr-auto border-r' : 'right-0 ml-auto border-l',
      )}
    >
      <div className="flex h-full flex-col overflow-y-auto">{children}</div>
    </dialog>
  );
}

/** Small dropdown menu: button + list of links/actions. Escape and outside click close it. */
export function Menu({ trigger, label, children, align = 'end' }: { trigger: React.ReactNode; label: string; children: React.ReactNode; align?: 'start' | 'end' }) {
  const [open, setOpen] = React.useState(false);
  const root = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div ref={root} className="relative">
      <button type="button" aria-haspopup="menu" aria-expanded={open} aria-label={label} onClick={() => setOpen((o) => !o)} className="rounded-full">
        {trigger}
      </button>
      {open ? (
        <div
          role="menu"
          onClick={() => setOpen(false)}
          className={cn('absolute top-full z-40 mt-2 min-w-52 rounded-card border border-line bg-surface p-1.5 shadow-lg animate-in', align === 'end' ? 'right-0' : 'left-0')}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export const menuItemClass =
  'flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[15px] font-medium text-ink hover:bg-surface-2 focus-visible:bg-surface-2 [&_svg]:size-5 [&_svg]:stroke-[1.75] [&_svg]:text-muted';

/** Underline tabs. */
export function Tabs<T extends string>({ value, onChange, items, label }: { value: T; onChange: (v: T) => void; items: Array<{ value: T; label: string }>; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-6 border-b border-line">
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          role="tab"
          aria-selected={value === it.value}
          onClick={() => onChange(it.value)}
          className={cn(
            '-mb-px min-h-11 border-b-2 border-transparent text-[15px] font-semibold text-muted transition-colors hover:text-ink',
            value === it.value && 'border-brand text-brand-deep',
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

/** Polite live region for short confirmations. */
export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  React.useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 2500);
    return () => clearTimeout(t);
  }, [message, onDone]);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 md:bottom-8">
      {message ? <p className="animate-in rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-white shadow-lg">{message}</p> : null}
    </div>
  );
}
