import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DateTime } from 'luxon';
import {
  programDays,
  listWorkingDates,
  isWorkingDate,
  computeTaskTimes,
  dateForWeekDay,
  weekCalendar,
  hasProgramEnded,
  hasProgramStarted,
  totalWeeks,
} from '../src/services/internship/scheduleService.js';
import { participantTaskState } from '../src/services/internship/scoringService.js';

// Mon 2 Nov 2026 → Fri 22 Jan 2027: a 12-week program
const program = { startDate: '2026-11-02', endDate: '2027-01-22', timezone: 'Asia/Karachi', workingDays: [1, 2, 3, 4, 5], scheduleConfig: {} };

describe('Internship scheduling', () => {
  it('generates working dates only Monday to Friday by default', () => {
    const dates = listWorkingDates(program);
    assert.equal(dates.length, 60, '12 weeks × 5 working days');
    for (const d of dates) assert.ok(d.weekday >= 1 && d.weekday <= 5, `${d.date} is a weekday`);
  });

  it('marks Saturdays and Sundays as days off', () => {
    const days = programDays(program);
    const weekend = days.filter((d) => d.weekday >= 6);
    assert.ok(weekend.length > 0);
    assert.ok(weekend.every((d) => !d.isWorkingDay && d.dayType === 'day_off'));
    assert.equal(isWorkingDate(program, '2026-11-07'), false, 'Saturday');
    assert.equal(isWorkingDate(program, '2026-11-08'), false, 'Sunday');
    assert.equal(isWorkingDate(program, '2026-11-09'), true, 'Monday');
  });

  it('excludes configured holidays', () => {
    const holidays = [{ date: '2026-12-25', name: 'Holiday' }, { date: '2027-01-01', name: 'New Year' }];
    const dates = listWorkingDates(program, holidays).map((d) => d.date);
    assert.equal(dates.length, 58);
    assert.ok(!dates.includes('2026-12-25'));
    assert.equal(programDays(program, holidays).find((d) => d.date === '2026-12-25').dayType, 'holiday');
  });

  it('respects custom working-day configurations', () => {
    const sixDay = { ...program, workingDays: [1, 2, 3, 4, 5, 6] };
    assert.equal(listWorkingDates(sixDay).length, 71, '60 weekdays + 11 Saturdays (program ends on a Friday)');
    assert.equal(isWorkingDate(sixDay, '2026-11-07'), true);
  });

  it('uses actual program dates rather than assuming four-week months', () => {
    assert.equal(totalWeeks(program), 12);
    const days = programDays(program);
    assert.equal(days[0].date, '2026-11-02');
    assert.equal(days.at(-1).date, '2027-01-22');
    assert.equal(days.length, 82);
    const leap = { ...program, startDate: '2028-02-01', endDate: '2028-03-01' };
    assert.equal(programDays(leap).length, 30, 'includes 29 February in a leap year');
  });

  it('resolves week number + weekday to a calendar date', () => {
    assert.equal(dateForWeekDay(program, 1, 1).date, '2026-11-02');
    assert.equal(dateForWeekDay(program, 2, 5).date, '2026-11-13');
    assert.equal(dateForWeekDay(program, 13, 1), null, 'outside program');
    const cal = weekCalendar(program, 1);
    assert.equal(cal.length, 7);
    assert.deepEqual(cal.map((d) => d.isWorkingDay), [true, true, true, true, true, false, false]);
  });

  it('computes release and due times in the program timezone', () => {
    const { availableAt, dueAt } = computeTaskTimes(program, '2026-11-02');
    // Asia/Karachi is UTC+5: 09:00 local → 04:00 UTC; 23:59:59 local → 18:59:59 UTC
    assert.equal(availableAt.toISOString(), '2026-11-02T04:00:00.000Z');
    assert.equal(dueAt.toISOString(), '2026-11-02T18:59:59.000Z');
    const utc = computeTaskTimes({ ...program, timezone: 'UTC', scheduleConfig: { releaseTime: '08:30', dueTime: '17:00', dueOffsetDays: 1 } }, '2026-11-02');
    assert.equal(utc.availableAt.toISOString(), '2026-11-02T08:30:00.000Z');
    assert.equal(utc.dueAt.toISOString(), '2026-11-03T17:00:59.000Z');
  });

  it('handles daylight saving time transitions', () => {
    const ny = { ...program, timezone: 'America/New_York', startDate: '2026-10-26', endDate: '2026-11-13' };
    const before = computeTaskTimes(ny, '2026-10-30'); // EDT (UTC-4)
    const after = computeTaskTimes(ny, '2026-11-02'); // EST (UTC-5)
    assert.equal(before.availableAt.toISOString(), '2026-10-30T13:00:00.000Z');
    assert.equal(after.availableAt.toISOString(), '2026-11-02T14:00:00.000Z');
  });

  it('treats program start and end boundaries in the program timezone', () => {
    const endLocal = DateTime.fromISO('2027-01-22T23:59:00', { zone: 'Asia/Karachi' }).toJSDate();
    const afterEnd = DateTime.fromISO('2027-01-23T00:00:01', { zone: 'Asia/Karachi' }).toJSDate();
    assert.equal(hasProgramEnded(program, endLocal), false);
    assert.equal(hasProgramEnded(program, afterEnd), true);
    assert.equal(hasProgramStarted(program, DateTime.fromISO('2026-11-01T23:00:00', { zone: 'Asia/Karachi' }).toJSDate()), false);
    assert.equal(hasProgramStarted(program, DateTime.fromISO('2026-11-02T00:00:00', { zone: 'Asia/Karachi' }).toJSDate()), true);
  });

  it('never makes a task available before its release time', () => {
    const task = { availableAt: new Date('2026-11-02T04:00:00Z'), dueAt: new Date('2026-11-02T18:59:59Z') };
    assert.equal(participantTaskState(task, null, null, new Date('2026-11-02T03:59:59Z')), 'scheduled');
    assert.equal(participantTaskState(task, null, null, new Date('2026-11-02T04:00:00Z')), 'available');
    assert.equal(participantTaskState(task, null, null, new Date('2026-11-02T19:00:00Z')), 'overdue');
  });
});
