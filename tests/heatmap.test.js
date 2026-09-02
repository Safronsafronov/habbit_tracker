import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGrid } from '../js/heatmap.js';

test('week mode: 7 cells in one column, states and today flag', () => {
  const g = buildGrid({
    fromStr: '2026-08-27', toStr: '2026-09-02',
    entries: { '2026-09-01': true },
    todayStr: '2026-09-02', createdAtStr: '2026-08-01', mode: 'week',
  });
  assert.equal(g.mode, 'week');
  assert.equal(g.columns.length, 1);
  assert.equal(g.columns[0].cells.length, 7);
  const byDate = Object.fromEntries(g.columns[0].cells.map((c) => [c.dateStr, c]));
  assert.equal(byDate['2026-09-01'].state, 'filled');
  assert.equal(byDate['2026-09-02'].state, 'empty');
  assert.equal(byDate['2026-09-02'].isToday, true);
});

test('grid mode: columns are Monday-aligned weeks of 7', () => {
  const g = buildGrid({
    fromStr: '2026-08-31', toStr: '2026-09-02',
    entries: {}, todayStr: '2026-09-02', createdAtStr: '2026-08-31', mode: 'grid',
  });
  assert.equal(g.mode, 'grid');
  assert.equal(g.columns[0].cells.length, 7);
  assert.equal(g.columns[0].cells[0].dateStr, '2026-08-31'); // Monday
});

test('grid mode: before createdAt and after today are inactive', () => {
  const g = buildGrid({
    fromStr: '2026-08-31', toStr: '2026-09-02',
    entries: {}, todayStr: '2026-09-02', createdAtStr: '2026-09-01', mode: 'grid',
  });
  const byDate = Object.fromEntries(g.columns.flatMap((c) => c.cells).map((c) => [c.dateStr, c]));
  assert.equal(byDate['2026-08-31'].state, 'inactive');
  assert.equal(byDate['2026-09-01'].state, 'empty');
  assert.equal(byDate['2026-09-03'].state, 'inactive');
});

test('grid mode: the first column of a month carries a label', () => {
  const g = buildGrid({
    fromStr: '2026-08-24', toStr: '2026-09-07',
    entries: {}, todayStr: '2026-09-07', createdAtStr: '2026-01-01', mode: 'grid',
  });
  assert.equal(g.columns[0].monthLabel, 'Авг');
  assert.equal(g.columns[1].monthLabel, null); // still August
  const sep = g.columns.find((c) => c.cells.some((x) => x.dateStr === '2026-09-07'));
  assert.equal(sep.monthLabel, 'Сен');
});
