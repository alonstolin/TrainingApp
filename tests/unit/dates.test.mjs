import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toLocalDate, parseLocalDate, trainingDate, dayOfWeek, addDays,
  daysBetween, startOfWeek, formatDuration, formatRelativeDate, dayName,
} from '../../src/core/dates.js';

test('parseLocalDate is local, not UTC', () => {
  // The classic bug: new Date('2026-08-17') is UTC midnight, which is 17 Aug
  // only if you happen to be at or east of Greenwich.
  const d = parseLocalDate('2026-08-17');
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 7);
  assert.equal(d.getDate(), 17);
});

test('toLocalDate round-trips', () => {
  for (const s of ['2026-01-01', '2026-12-31', '2024-02-29', '2026-08-17']) {
    assert.equal(toLocalDate(parseLocalDate(s)), s);
  }
});

test('training day rolls over at 03:00, not midnight', () => {
  assert.equal(trainingDate(new Date(2026, 7, 17, 0, 30)), '2026-08-16', 'a 00:30 finish belongs to the previous day');
  assert.equal(trainingDate(new Date(2026, 7, 17, 2, 59)), '2026-08-16');
  assert.equal(trainingDate(new Date(2026, 7, 17, 3, 0)), '2026-08-17');
  assert.equal(trainingDate(new Date(2026, 7, 17, 18, 0)), '2026-08-17');
});

test('daysBetween survives month, year and leap boundaries', () => {
  assert.equal(daysBetween('2026-08-17', '2026-08-20'), 3);
  assert.equal(daysBetween('2026-08-31', '2026-09-01'), 1);
  assert.equal(daysBetween('2026-12-31', '2027-01-01'), 1);
  assert.equal(daysBetween('2024-02-28', '2024-03-01'), 2, '2024 is a leap year');
  assert.equal(daysBetween('2026-08-20', '2026-08-17'), -3);
  assert.equal(daysBetween('2026-08-17', '2026-08-17'), 0);
});

test('daysBetween is unaffected by DST transitions', () => {
  // US DST spring forward 2026-03-08, fall back 2026-11-01. A naive
  // (b - a) / 86400000 gives 0.958 or 1.042 here and rounds wrong at scale.
  assert.equal(daysBetween('2026-03-07', '2026-03-09'), 2);
  assert.equal(daysBetween('2026-10-31', '2026-11-02'), 2);
  assert.equal(daysBetween('2026-03-01', '2026-04-01'), 31);
});

test('addDays crosses boundaries', () => {
  assert.equal(addDays('2026-08-31', 1), '2026-09-01');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(addDays('2024-02-28', 1), '2024-02-29');
  assert.equal(addDays('2026-08-17', 0), '2026-08-17');
});

test('startOfWeek anchors to Monday', () => {
  assert.equal(startOfWeek('2026-08-17'), '2026-08-17', 'Monday maps to itself');
  assert.equal(startOfWeek('2026-08-19'), '2026-08-17', 'Wednesday');
  assert.equal(startOfWeek('2026-08-23'), '2026-08-17', 'Sunday belongs to the week that started Monday');
  assert.equal(startOfWeek('2026-08-24'), '2026-08-24', 'next Monday');
});

test('dayOfWeek matches Date#getDay', () => {
  assert.equal(dayOfWeek('2026-08-16'), 0, 'Sunday');
  assert.equal(dayOfWeek('2026-08-17'), 1, 'Monday');
  assert.equal(dayName('2026-08-17'), 'Mon');
});

test('formatDuration', () => {
  assert.equal(formatDuration(0), '0:00');
  assert.equal(formatDuration(63), '1:03');
  assert.equal(formatDuration(303), '5:03');
  assert.equal(formatDuration(3903), '1:05:03');
});

test('formatRelativeDate', () => {
  const today = '2026-08-17';
  assert.equal(formatRelativeDate('2026-08-17', today), 'Today');
  assert.equal(formatRelativeDate('2026-08-16', today), 'Yesterday');
  assert.match(formatRelativeDate('2026-08-10', today), /^Mon/);
});
