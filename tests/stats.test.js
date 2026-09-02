import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDate, parseDate, addDays, mondayOf, enumerateDays,
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

test('enumerateDays: inclusive, leap day, backwards range guard', () => {
  assert.deepEqual(
    enumerateDays('2028-02-28', '2028-03-01'),
    ['2028-02-28', '2028-02-29', '2028-03-01'],
  );
  assert.deepEqual(enumerateDays('2026-01-02', '2026-01-01'), []);
});
