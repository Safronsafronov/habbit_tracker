import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDate, parseDate, addDays, mondayOf, enumerateDays,
  currentStreak, longestStreak, totalDays, completionRate, rangeBounds,
} from '../js/stats.js';

test('formatDate/parseDate: local, zero-padded, round-trips', () => {
  assert.equal(formatDate(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(formatDate(parseDate('2026-09-02')), '2026-09-02');
});

test('addDays crosses month and year boundaries', () => {
  assert.equal(addDays('2026-01-31', 1), '2026-02-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2027-01-01', -1), '2026-12-31');
});

test('mondayOf returns the Monday of that week', () => {
  // 2026-09-02 is a Wednesday
  assert.equal(mondayOf('2026-09-02'), '2026-08-31');
  assert.equal(mondayOf('2026-08-31'), '2026-08-31');
});

test('enumerateDays is inclusive and handles a leap day', () => {
  assert.deepEqual(
    enumerateDays('2028-02-28', '2028-03-01'),
    ['2028-02-28', '2028-02-29', '2028-03-01'],
  );
  assert.deepEqual(enumerateDays('2026-01-02', '2026-01-01'), []);
});

test('currentStreak: today marked', () => {
  const e = { '2026-09-02': true, '2026-09-01': true, '2026-08-31': true };
  assert.equal(currentStreak(e, '2026-09-02'), 3);
});

test('currentStreak: today not marked but yesterday is', () => {
  const e = { '2026-09-01': true, '2026-08-31': true };
  assert.equal(currentStreak(e, '2026-09-02'), 2);
});

test('currentStreak: gap before yesterday => 0', () => {
  assert.equal(currentStreak({ '2026-08-30': true }, '2026-09-02'), 0);
});

test('currentStreak: single day', () => {
  assert.equal(currentStreak({ '2026-09-02': true }, '2026-09-02'), 1);
});

test('longestStreak: run in the middle of history', () => {
  const e = {
    '2026-01-01': true,
    '2026-02-01': true, '2026-02-02': true, '2026-02-03': true, '2026-02-04': true,
    '2026-03-01': true,
  };
  assert.equal(longestStreak(e), 4);
});

test('longestStreak: empty', () => {
  assert.equal(longestStreak({}), 0);
});

test('totalDays counts marked days', () => {
  assert.equal(totalDays({ '2026-09-01': true, '2026-09-02': true }), 2);
  assert.equal(totalDays({}), 0);
});

test('completionRate over a range longer than history', () => {
  const e = { '2026-09-01': true, '2026-09-02': true };
  assert.deepEqual(completionRate(e, '2026-09-01', '2026-09-10'), { done: 2, total: 10, pct: 20 });
});

test('completionRate single day', () => {
  assert.deepEqual(
    completionRate({ '2026-09-02': true }, '2026-09-02', '2026-09-02'),
    { done: 1, total: 1, pct: 100 },
  );
});

test('completionRate empty/backwards range guard', () => {
  assert.deepEqual(completionRate({}, '2026-09-02', '2026-09-01'), { done: 0, total: 0, pct: 0 });
});

test('rangeBounds week: last 7 days, week mode', () => {
  assert.deepEqual(
    rangeBounds('week', '2026-09-02', '2026-01-01'),
    { fromStr: '2026-08-27', toStr: '2026-09-02', mode: 'week' },
  );
});

test('rangeBounds year: 52 Monday-aligned weeks, grid mode', () => {
  const r = rangeBounds('year', '2026-09-02', '2020-01-01');
  assert.equal(r.toStr, '2026-09-02');
  assert.equal(r.mode, 'grid');
  assert.equal(mondayOf(r.fromStr), r.fromStr);
  assert.equal(r.fromStr, addDays('2026-08-31', -7 * 51));
});

test('rangeBounds all: from createdAt Monday, never into the future', () => {
  const r = rangeBounds('all', '2026-09-02', '2026-08-15');
  assert.equal(r.fromStr, mondayOf('2026-08-15'));
  assert.equal(r.toStr, '2026-09-02');
  const r2 = rangeBounds('all', '2026-09-02', '2099-01-01');
  assert.equal(r2.fromStr, mondayOf('2026-09-02'));
});
