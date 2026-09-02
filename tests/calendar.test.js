import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  monthMatrix, monthName, weekdayLabels, ymKey, shiftYM,
  todayYM, listMonths, dayState,
} from '../js/calendar.js';

test('monthMatrix: September 2026 (Tuesday start) → one leading blank, 30 dates', () => {
  const w = monthMatrix(2026, 8);
  assert.equal(w[0][0], null);
  assert.equal(w[0][1], '2026-09-01');
  w.forEach((row) => assert.equal(row.length, 7));
  assert.equal(w.flat().filter(Boolean).length, 30);
  assert.equal(w.at(-1).at(-1), null); // trailing padded
});

test('monthMatrix: February 2028 includes the leap day and not the 30th', () => {
  const flat = monthMatrix(2028, 1).flat();
  assert.ok(flat.includes('2028-02-29'));
  assert.ok(!flat.includes('2028-02-30'));
});

test('monthMatrix: November 2026 (Sunday start) → 6 leading blanks', () => {
  const w = monthMatrix(2026, 10);
  assert.deepEqual(w[0].slice(0, 6), [null, null, null, null, null, null]);
  assert.equal(w[0][6], '2026-11-01');
});

test('monthMatrix: non-null dates are contiguous and well-formed', () => {
  const flat = monthMatrix(2026, 8).flat();
  const filledIdx = flat.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
  assert.equal(filledIdx.at(-1) - filledIdx[0] + 1, filledIdx.length);
  flat.filter(Boolean).forEach((s) => assert.match(s, /^\d{4}-\d{2}-\d{2}$/));
});

test('shiftYM crosses year boundaries', () => {
  assert.deepEqual(shiftYM({ year: 2026, month: 0 }, -1), { year: 2025, month: 11 });
  assert.deepEqual(shiftYM({ year: 2026, month: 11 }, 1), { year: 2027, month: 0 });
  assert.deepEqual(shiftYM({ year: 2026, month: 5 }, -18), { year: 2024, month: 11 });
});

test('ymKey zero-pads the month', () => {
  assert.equal(ymKey({ year: 2026, month: 8 }), '2026-09');
  assert.equal(ymKey({ year: 2026, month: 0 }), '2026-01');
});

test('todayYM parses a local date string', () => {
  assert.deepEqual(todayYM('2026-09-02'), { year: 2026, month: 8 });
});

test('listMonths is inclusive and crosses the year end', () => {
  assert.deepEqual(
    listMonths({ year: 2026, month: 11 }, { year: 2027, month: 1 }),
    [{ year: 2026, month: 11 }, { year: 2027, month: 0 }, { year: 2027, month: 1 }],
  );
  assert.deepEqual(
    listMonths({ year: 2026, month: 3 }, { year: 2026, month: 3 }),
    [{ year: 2026, month: 3 }],
  );
});

test('dayState covers every case', () => {
  const e = { '2026-09-01': true, '2026-09-02': true };
  assert.equal(dayState('2026-09-20', e, '2026-09-02'), 'future');
  assert.equal(dayState('2026-09-02', e, '2026-09-02'), 'marked-today');
  assert.equal(dayState('2026-09-02', {}, '2026-09-02'), 'today');
  assert.equal(dayState('2026-09-01', e, '2026-09-02'), 'marked');
  assert.equal(dayState('2026-08-15', e, '2026-09-02'), 'plain');
});

test('monthName and weekdayLabels content', () => {
  assert.equal(monthName(0), 'Январь');
  assert.equal(monthName(11), 'Декабрь');
  assert.deepEqual(weekdayLabels(), ['п', 'в', 'с', 'ч', 'п', 'с', 'в']);
});
