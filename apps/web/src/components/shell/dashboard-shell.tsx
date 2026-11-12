'use client';
import { Menu as MenuIcon, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Button, Logo, Sheet, cn } from '@medicos/ui';

export interface NavItem {
  href?: string;
  label: string;
  icon: ReactNode;
}

interface Props {
  nav: NavItem[];
  navLabel: string;
  /** Doctor photo/name block etc. */
  identity: (collapsed: boolean) => ReactNode;
  topBar: ReactNode;
  labels: { open: string; close: string; collapse: string; expand: string };
  children: ReactNode;
}

/**
 * Doctor and admin dashboards: white sidebar with a green active pill (248px) on laptop, an icon
 * rail at md–lg (or when collapsed), a slide-in drawer on phone.
 */
export function DashboardShell({ nav, navLabel, identity, topBar, labels, children }: Props) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);

  const list = (rail: boolean, onPick?: () => void) => (
    <ul className="flex flex-col gap-1">
      {nav.map((item) => {
        const active = !!item.href && pathname.startsWith(item.href);
        const cls = cn(
          'flex min-h-11 items-center gap-3 rounded-[var(--radius-control)] px-3 text-[15px] font-medium [&_svg]:size-5 [&_svg]:shrink-0 [&_svg]:stroke-[1.75]',
          rail && 'justify-center px-0',
          active ? 'bg-brand-soft text-brand-deep' : item.href ? 'text-muted hover:bg-surface-2 hover:text-ink' : 'cursor-default text-muted/70',
        );
        const content = (
          <>
            {item.icon}
            <span className={rail ? 'sr-only' : ''}>{item.label}</span>
          </>
        );
        return (
          <li key={item.label}>
            {item.href ? (
              <Link href={item.href} aria-current={active ? 'page' : undefined} title={rail ? item.label : undefined} className={cls} onClick={onPick}>
                {content}
              </Link>
            ) : (
              <span aria-disabled title={item.label} className={cls}>
                {content}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="flex min-h-dvh bg-surface-2/60 text-[15px]">
      <aside
        className={cn(
          'sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-surface md:flex',
          collapsed ? 'w-[76px]' : 'w-[76px] lg:w-[248px]',
        )}
      >
        <div className={cn('flex h-16 items-center border-b border-line px-4', collapsed ? 'justify-center' : 'justify-center lg:justify-between')}>
          <Link href="/" aria-label="Medicos home" className={cn(collapsed ? 'hidden' : 'hidden lg:block')}>
            <Logo />
          </Link>
          <Button variant="ghost" size="icon" className="hidden lg:inline-flex" aria-label={collapsed ? labels.expand : labels.collapse} onClick={() => setCollapsed((c) => !c)}>
            {collapsed ? <PanelLeftOpen aria-hidden /> : <PanelLeftClose aria-hidden />}
          </Button>
          <span className={cn('lg:hidden', collapsed && 'lg:block')}>
            <Logo mark className="[&>span:last-child]:sr-only" />
          </span>
        </div>
        <div className={cn('border-b border-line p-3', collapsed ? '' : 'lg:p-4')}>{identity(collapsed)}</div>
        <nav aria-label={navLabel} className="flex-1 overflow-y-auto p-3">
          <div className={collapsed ? '' : 'lg:hidden'}>{list(true)}</div>
          <div className={collapsed ? 'hidden' : 'hidden lg:block'}>{list(false)}</div>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
          <div className="flex min-h-16 items-center gap-3 px-4 md:px-6">
            <Button variant="ghost" size="icon" className="md:hidden" aria-label={labels.open} onClick={() => setDrawer(true)}>
              <MenuIcon aria-hidden />
            </Button>
            {topBar}
          </div>
        </header>
        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>

      <Sheet open={drawer} onClose={() => setDrawer(false)} side="left" label={navLabel}>
        <div className="flex h-16 items-center justify-between border-b border-line px-4">
          <Logo />
          <Button variant="ghost" size="icon" aria-label={labels.close} onClick={() => setDrawer(false)}>
            <X aria-hidden />
          </Button>
        </div>
        <div className="border-b border-line p-4">{identity(false)}</div>
        <nav aria-label={navLabel} className="p-3">
          {list(false, () => setDrawer(false))}
        </nav>
      </Sheet>
    </div>
  );
}
