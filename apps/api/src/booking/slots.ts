/** Slot maths in India Standard Time (UTC+5:30, no DST). Pure functions — unit tested. */
export const IST_OFFSET_MS = 5.5 * 3600_000;

export interface ScheduleRow {
  clinicId: string;
  weekday: number; // 0 = Sunday
  start: string; // "HH:MM"
  end: string;
  slotMinutes: number;
}

/** UTC instant for an IST calendar date + "HH:MM". */
export function istInstant(date: string, hhmm: string): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const [h, min] = hhmm.split(':').map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1, d, h, min) - IST_OFFSET_MS);
}

/** IST calendar date (YYYY-MM-DD) of an instant. */
export function istDate(at: Date): string {
  return new Date(at.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function istWeekday(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export function addDays(date: string, n: number): string {
  const t = new Date(`${date}T00:00:00Z`).getTime() + n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * All slot start times for one doctor at one clinic on one IST date. A slot is free when it is in the
 * future (with a small lead time) and nobody else has a live appointment at that exact time.
 */
export function slotsFor(
  schedules: ScheduleRow[],
  clinicId: string,
  date: string,
  taken: Date[],
  now = new Date(),
  leadMinutes = 15,
): Array<{ startsAt: string; free: boolean }> {
  const weekday = istWeekday(date);
  const takenSet = new Set(taken.map((t) => t.getTime()));
  const earliest = now.getTime() + leadMinutes * 60_000;
  const out: Array<{ startsAt: string; free: boolean }> = [];
  for (const s of schedules.filter((x) => x.clinicId === clinicId && x.weekday === weekday)) {
    const step = Math.max(5, s.slotMinutes) * 60_000;
    const end = istInstant(date, s.end).getTime();
    for (let t = istInstant(date, s.start).getTime(); t + step <= end; t += step) {
      out.push({ startsAt: new Date(t).toISOString(), free: t >= earliest && !takenSet.has(t) });
    }
  }
  return out.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** True when `startsAt` is exactly one of the schedule's slot starts on its IST date. */
export function isScheduledSlot(schedules: ScheduleRow[], clinicId: string, startsAt: Date): boolean {
  return slotsFor(schedules, clinicId, istDate(startsAt), [], new Date(0), 0).some((s) => s.startsAt === startsAt.toISOString());
}
