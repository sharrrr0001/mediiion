'use client';
import {
  BarChart3,
  Bell,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileText,
  LayoutDashboard,
  Search,
  Settings,
  TrendingUp,
  Users,
  UsersRound,
  BadgeCheck,
  Building2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ScanAccess } from '@/components/doctor/scan-access';
import type { ReactNode } from 'react';
import { Avatar, Button, cn } from '@medicos/ui';
import { DashboardShell, type NavItem } from './dashboard-shell';
import { useDoctor } from '@/lib/use-doctor';


export function DoctorShell({ children }: { children: ReactNode }) {
  const t = useTranslations('doctor');
  const tn = useTranslations('nav');
  const { data: me } = useDoctor();
  const DOCTOR = { name: me?.name ?? '', clinic: me?.clinic?.name ?? '' };
  const nav: NavItem[] = [
    { label: t('nav.dashboard'), icon: <LayoutDashboard aria-hidden /> },
    { href: '/d/today', label: t('nav.today'), icon: <CalendarDays aria-hidden /> },
    { label: t('nav.patients'), icon: <Users aria-hidden /> },
    { label: t('nav.summaries'), icon: <ClipboardList aria-hidden /> },
    { label: t('nav.reports'), icon: <FileText aria-hidden /> },
    { label: t('nav.schedule'), icon: <CalendarClock aria-hidden /> },
    { label: t('nav.insights'), icon: <TrendingUp aria-hidden /> },
    { label: t('nav.billing'), icon: <CreditCard aria-hidden /> },
    { label: t('nav.staff'), icon: <UsersRound aria-hidden /> },
    { label: t('nav.settings'), icon: <Settings aria-hidden /> },
  ];
  const date = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date());

  return (
    <DashboardShell
      nav={nav}
      navLabel={tn('main')}
      labels={{ open: tn('menu'), close: tn('closeMenu'), collapse: t('collapse'), expand: t('expand') }}
      identity={(collapsed) => (
        <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
          <Avatar name={DOCTOR.name.replace(/^Dr.?s*/, '')} className="size-10" />
          <div className={cn('min-w-0', collapsed ? 'sr-only' : 'max-lg:md:sr-only')}>
            <p className="truncate font-semibold text-ink">{DOCTOR.name}</p>
            <p className="inline-flex items-center gap-1 text-sm font-medium text-brand-deep">
              <BadgeCheck aria-hidden className="size-4 stroke-[1.75]" />
              {me?.verificationStatus === 'verified' ? t('verified') : me?.verificationStatus ?? ''}
            </p>
          </div>
        </div>
      )}
      topBar={
        <>
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-semibold md:text-xl">{me ? t('greeting', { name: me.name }) : ' '}</p>
            <p className="tabular text-sm text-muted">{date}</p>
          </div>
          <label className="ml-auto hidden items-center gap-2 rounded-[var(--radius-control)] border border-line bg-surface px-3 shadow-sm xl:flex">
            <Building2 aria-hidden className="size-5 stroke-[1.75] text-brand" />
            <span className="sr-only">{t('clinic')}</span>
            <select className="min-h-10 bg-transparent pr-2 text-[15px] font-medium focus:outline-none" value={me?.clinic?.id ?? ''} onChange={() => undefined}>
              <option value={me?.clinic?.id ?? ''}>{DOCTOR.clinic}</option>
            </select>
          </label>
          <label className="relative ml-auto hidden w-full max-w-sm lg:block xl:ml-0">
            <span className="sr-only">{t('search')}</span>
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 stroke-[1.75] text-muted" />
            <input type="search" placeholder={t('search')} className="min-h-10 w-full rounded-[var(--radius-control)] border border-line bg-surface pl-10 pr-3 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15" />
          </label>
          <ScanAccess className="ml-auto lg:ml-0" />
          <Button variant="ghost" size="icon" aria-label={tn('notifications')}>
            <Bell aria-hidden />
          </Button>
        </>
      }
    >
      {children}
    </DashboardShell>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const t = useTranslations('admin');
  const td = useTranslations('doctor');
  const tn = useTranslations('nav');
  const nav: NavItem[] = [
    { href: '/admin', label: t('nav.overview'), icon: <LayoutDashboard aria-hidden /> },
    { href: '/admin/verifications', label: t('nav.verification'), icon: <BadgeCheck aria-hidden /> },
    { label: t('nav.templates'), icon: <ClipboardList aria-hidden /> },
    { label: t('nav.quality'), icon: <BarChart3 aria-hidden /> },
    { label: t('nav.safety'), icon: <Bell aria-hidden /> },
    { label: t('nav.audit'), icon: <FileText aria-hidden /> },
    { label: t('nav.support'), icon: <Users aria-hidden /> },
    { label: t('nav.billing'), icon: <CreditCard aria-hidden /> },
  ];
  return (
    <DashboardShell
      nav={nav}
      navLabel={tn('main')}
      labels={{ open: tn('menu'), close: tn('closeMenu'), collapse: td('collapse'), expand: td('expand') }}
      identity={(collapsed) => (
        <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
          <Avatar name="Medicos Admin" className="size-10" />
          <div className={cn('min-w-0', collapsed ? 'sr-only' : 'max-lg:md:sr-only')}>
            <p className="truncate font-semibold">Medicos team</p>
            <p className="text-sm text-muted">Admin</p>
          </div>
        </div>
      )}
      topBar={
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-semibold md:text-xl">{t('title')}</p>
          <p className="text-sm text-muted">{t('subtitle')}</p>
        </div>
      }
    >
      {children}
    </DashboardShell>
  );
}
