'use client';
import { useCallback, useSyncExternalStore } from 'react';
import type { ProfileSummary } from '@medicos/shared/client';
import { useMe } from './use-me';

/** Which family member the patient is acting for ("For: Me ▾", spec §7.1 #4). Per device, not synced. */
const KEY = 'mc_profile';
const listeners = new Set<() => void>();

function read(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useActiveProfile(): { profile: ProfileSummary | undefined; profiles: ProfileSummary[]; setActive: (id: string) => void } {
  const { data: me } = useMe();
  const stored = useSyncExternalStore(subscribe, read, () => null);
  const profiles = me?.profiles ?? [];
  const profile = profiles.find((p) => p.id === stored) ?? profiles[0];
  const setActive = useCallback((id: string) => {
    try {
      window.localStorage.setItem(KEY, id);
    } catch {
      /* private mode: selection lasts for this page only */
    }
    listeners.forEach((l) => l());
  }, []);
  return { profile, profiles, setActive };
}
