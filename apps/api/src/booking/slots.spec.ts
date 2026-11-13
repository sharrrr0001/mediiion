import { describe, expect, it } from 'vitest';
import { addDays, isScheduledSlot, istDate, istInstant, slotsFor, type ScheduleRow } from './slots';

const C = 'clinic-1';
// 2026-11-16 is a Monday.
const mon: ScheduleRow = { clinicId: C, weekday: 1, start: '10:00', end: '11:00', slotMinutes: 15 };

describe('slots (IST)', () => {
  it('converts IST wall time to UTC', () => {
    expect(istInstant('2026-11-16', '10:00').toISOString()).toBe('2026-11-16T04:30:00.000Z');
    expect(istDate(new Date('2026-11-16T20:00:00Z'))).toBe('2026-11-17'); // 01:30 IST next day
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
  });

  it('lists slots for the weekday only, marks taken and past slots as not free', () => {
    const now = new Date('2026-11-16T04:40:00Z'); // 10:10 IST
    const taken = [istInstant('2026-11-16', '10:45')];
    const s = slotsFor([mon], C, '2026-11-16', taken, now);
    expect(s.map((x) => x.startsAt)).toHaveLength(4);
    expect(s.map((x) => x.free)).toEqual([false, false, true, false]); // 10:00 past, 10:15 inside lead time, 10:30 free, 10:45 taken
    expect(slotsFor([mon], C, '2026-11-17', [], now)).toEqual([]); // Tuesday: no schedule
    expect(slotsFor([mon], 'other', '2026-11-16', [], now)).toEqual([]);
  });

  it('accepts only exact slot starts', () => {
    expect(isScheduledSlot([mon], C, istInstant('2026-11-16', '10:30'))).toBe(true);
    expect(isScheduledSlot([mon], C, istInstant('2026-11-16', '10:31'))).toBe(false);
    expect(isScheduledSlot([mon], C, istInstant('2026-11-16', '11:00'))).toBe(false); // end is exclusive
  });
});
