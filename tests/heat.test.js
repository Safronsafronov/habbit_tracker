import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heatWeeks } from '../js/heat.js';

test('exactly 365 non-null dates', () => {
  const weeks = heatWeeks('2026-09-11');
  const flat = weeks.flat().filter(Boolean);
  assert.equal(flat.length, 365);
});

test('last non-null cell is today', () => {
  const weeks = heatWeeks('2026-09-11');
  const flat = weeks.flat().filter(Boolean);
  assert.equal(flat[flat.length - 1], '2026-09-11');
});

test('first week is left-padded to align weekday (Friday start = 4 nulls)', () => {
  const weeks = heatWeeks('2026-09-11');
  assert.deepEqual(weeks[0].slice(0, 4), [null, null, null, null]);
  assert.equal(weeks[0][4], '2025-09-12');
});

test('every week has exactly 7 slots', () => {
  const weeks = heatWeeks('2026-09-11');
  weeks.forEach((w) => assert.equal(w.length, 7));
});

test('window spanning a leap day includes 2028-02-29, no trailing pad needed', () => {
  const weeks = heatWeeks('2028-03-05');
  const flat = weeks.flat();
  assert.ok(flat.includes('2028-02-29'));
  assert.equal(weeks[0][6], '2027-03-07'); // Sunday-aligned start, 6 leading nulls
  assert.equal(weeks[0].slice(0, 6).every((c) => c === null), true);
  assert.equal(weeks[weeks.length - 1][weeks[weeks.length - 1].length - 1], '2028-03-05');
});

test('dates run strictly consecutive day-by-day with no gaps', () => {
  const weeks = heatWeeks('2026-09-11');
  const flat = weeks.flat().filter(Boolean);
  for (let i = 1; i < flat.length; i += 1) {
    const prev = new Date(flat[i - 1]);
    const cur = new Date(flat[i]);
    assert.equal((cur - prev) / 86400000, 1);
  }
});
