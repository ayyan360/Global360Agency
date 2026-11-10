import { DateTime, IANAZone } from 'luxon';
import { programPolicy } from './policy.js';

export const WEEKDAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function isValidTimezone(tz) {
  return IANAZone.isValidZone(tz);
}

const toDate = (iso, zone) => DateTime.fromISO(String(iso).slice(0, 10), { zone });

function parseTime(hhmm) {
  const [h, m] = String(hhmm || '00:00').split(':').map((n) => Number.parseInt(n, 10));
  return { hour: Number.isFinite(h) ? h : 0, minute: Number.isFinite(m) ? m : 0 };
}

/** Start of the program (00:00 on startDate, program timezone) and end (23:59:59.999 on endDate). */
export function programBounds(program) {
  const { timezone } = programPolicy(program);
  return {
    start: toDate(program.startDate, timezone).startOf('day'),
    end: toDate(program.endDate, timezone).endOf('day'),
  };
}

export function hasProgramEnded(program, now = new Date()) {
  return DateTime.fromJSDate(now) > programBounds(program).end;
}

export function hasProgramStarted(program, now = new Date()) {
  return DateTime.fromJSDate(now) >= programBounds(program).start;
}

/** 1-based week number relative to the program start date (week 1 = first 7 days). */
export function weekNumberFor(program, isoDate) {
  const { timezone } = programPolicy(program);
  const days = Math.floor(toDate(isoDate, timezone).diff(toDate(program.startDate, timezone), 'days').days);
  return Math.floor(days / 7) + 1;
}

export function totalWeeks(program) {
  return weekNumberFor(program, program.endDate);
}

/**
 * Lists every calendar day of the program with its working status, derived from the program's
 * actual dates (never "4 weeks per month"), configured working weekdays, holidays and timezone.
 */
export function programDays(program, holidays = []) {
  const { timezone, workingDays } = programPolicy(program);
  const holidayMap = new Map(holidays.map((h) => [String(h.date).slice(0, 10), h.name || 'Holiday']));
  const start = toDate(program.startDate, timezone);
  const end = toDate(program.endDate, timezone);
  const out = [];
  for (let d = start; d <= end; d = d.plus({ days: 1 })) {
    const date = d.toISODate();
    const weekday = d.weekday; // 1 = Monday .. 7 = Sunday
    const holiday = holidayMap.get(date);
    const isWorkingWeekday = workingDays.includes(weekday);
    out.push({
      date,
      weekday,
      weekdayName: WEEKDAY_NAMES[weekday],
      weekNumber: Math.floor(d.diff(start, 'days').days / 7) + 1,
      isWorkingDay: isWorkingWeekday && !holiday,
      dayType: holiday ? 'holiday' : isWorkingWeekday ? 'working' : 'day_off',
      holidayName: holiday || null,
    });
  }
  return out;
}

export function listWorkingDates(program, holidays = []) {
  return programDays(program, holidays).filter((d) => d.isWorkingDay);
}

export function isWorkingDate(program, isoDate, holidays = []) {
  const day = programDays(program, holidays).find((d) => d.date === String(isoDate).slice(0, 10));
  return Boolean(day?.isWorkingDay);
}

/** Resolve (weekNumber, ISO weekday) → calendar date within the program, or null if outside it. */
export function dateForWeekDay(program, weekNumber, weekday, holidays = []) {
  const days = programDays(program, holidays);
  return days.find((d) => d.weekNumber === weekNumber && d.weekday === weekday) || null;
}

/** Calendar for one program week (always 7 consecutive days, including days outside the program). */
export function weekCalendar(program, weekNumber, holidays = []) {
  const { timezone } = programPolicy(program);
  const days = programDays(program, holidays);
  const first = toDate(program.startDate, timezone).plus({ days: (weekNumber - 1) * 7 });
  const out = [];
  for (let i = 0; i < 7; i += 1) {
    const date = first.plus({ days: i }).toISODate();
    const day = days.find((d) => d.date === date);
    out.push(
      day || {
        date,
        weekday: first.plus({ days: i }).weekday,
        weekdayName: WEEKDAY_NAMES[first.plus({ days: i }).weekday],
        weekNumber,
        isWorkingDay: false,
        dayType: 'outside_program',
        holidayName: null,
      }
    );
  }
  return out;
}

/**
 * Release and due instants for a task scheduled on a working date, in the program timezone.
 * Explicit overrides (ISO datetimes) win when supplied by an admin.
 */
export function computeTaskTimes(program, isoDate, { availableAt, dueAt } = {}) {
  const { timezone, schedule } = programPolicy(program);
  const day = toDate(isoDate, timezone);
  const release = parseTime(schedule.releaseTime);
  const due = parseTime(schedule.dueTime);
  const available = availableAt ? DateTime.fromISO(availableAt, { zone: timezone }) : day.set({ ...release, second: 0, millisecond: 0 });
  const dueTime = dueAt
    ? DateTime.fromISO(dueAt, { zone: timezone })
    : day.plus({ days: Number(schedule.dueOffsetDays) || 0 }).set({ ...due, second: 59, millisecond: 0 });
  return { availableAt: available.toUTC().toJSDate(), dueAt: dueTime.toUTC().toJSDate() };
}

/** Current program week for "today" (clamped to the program range). */
export function currentWeekNumber(program, now = new Date()) {
  const { timezone } = programPolicy(program);
  const today = DateTime.fromJSDate(now, { zone: timezone }).toISODate();
  const { start, end } = programBounds(program);
  if (DateTime.fromJSDate(now) < start) return 1;
  if (DateTime.fromJSDate(now) > end) return totalWeeks(program);
  return weekNumberFor(program, today);
}

export function todayInProgram(program, now = new Date()) {
  return DateTime.fromJSDate(now, { zone: programPolicy(program).timezone }).toISODate();
}
