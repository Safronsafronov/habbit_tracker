import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STORAGE_KEY, makeDefaultState, loadState, saveState,
  createHabit, updateHabit, deleteHabit, toggleEntry, nextAccent, setTheme, getHabit,
} from '../js/storage.js';
import { ACCENT_KEYS } from '../js/accents.js';
import { todayStr } from '../js/stats.js';

function fakeStorage(init = {}) {
  const store = { ...init };
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    _store: store,
  };
}

test('loadState: missing key => default state', () => {
  assert.deepEqual(loadState(fakeStorage()), makeDefaultState());
});

test('loadState: corrupt JSON => default state, flagged', () => {
  const s = loadState(fakeStorage({ [STORAGE_KEY]: '{not json' }));
  assert.equal(s.habits.length, 0);
  assert.equal(s._corrupt, true);
});

test('migrate: habit with bogus accent => first accent key', () => {
  const raw = JSON.stringify({ version: 1, habits: [{ id: 'h1', accent: 'bogus', entries: {} }] });
  const s = loadState(fakeStorage({ [STORAGE_KEY]: raw }));
  assert.equal(s.habits[0].accent, ACCENT_KEYS[0]);
});

test('migrate: habit with missing entries => {}', () => {
  const raw = JSON.stringify({ version: 1, habits: [{ id: 'h1', accent: 'blue' }] });
  const s = loadState(fakeStorage({ [STORAGE_KEY]: raw }));
  assert.deepEqual(s.habits[0].entries, {});
});

test('migrate: habit with non-string createdAt => YYYY-MM-DD string', () => {
  const raw = JSON.stringify({ version: 1, habits: [{ id: 'h1', accent: 'blue', createdAt: 12345 }] });
  const s = loadState(fakeStorage({ [STORAGE_KEY]: raw }));
  assert.match(s.habits[0].createdAt, /^\d{4}-\d{2}-\d{2}$/);
});

test('migrate: non-object elements in habits are dropped', () => {
  const raw = JSON.stringify({ version: 1, habits: [null, 'x', { id: 'h1', accent: 'blue', entries: {} }] });
  const s = loadState(fakeStorage({ [STORAGE_KEY]: raw }));
  assert.equal(s.habits.length, 1);
  assert.equal(s.habits[0].id, 'h1');
});

test('loadState: partial object is migrated', () => {
  const s = loadState(fakeStorage({ [STORAGE_KEY]: JSON.stringify({ habits: [] }) }));
  assert.equal(s.version, 1);
  assert.equal(s.settings.theme, 'system');
});

test('saveState strips _corrupt', () => {
  const st = fakeStorage();
  saveState(st, { ...makeDefaultState(), _corrupt: true });
  assert.equal(JSON.parse(st._store[STORAGE_KEY])._corrupt, undefined);
});

test('createHabit adds a habit with trimmed name and chosen accent', () => {
  const { state, habit } = createHabit(makeDefaultState(), { name: '  Read  ', emoji: '📖', accent: 'blue' });
  assert.equal(state.habits.length, 1);
  assert.equal(habit.name, 'Read');
  assert.equal(habit.accent, 'blue');
  assert.deepEqual(habit.entries, {});
  assert.match(habit.id, /^h_[a-z0-9]{6}$/);
});

test('createHabit uses a provided createdAt', () => {
  const { habit } = createHabit(makeDefaultState(), {
    name: 'Читать', emoji: '📖', accent: 'blue', createdAt: '2026-01-15',
  });
  assert.equal(habit.createdAt, '2026-01-15');
});

test('createHabit falls back to today when createdAt is omitted', () => {
  const { habit } = createHabit(makeDefaultState(), { name: 'Читать', emoji: '', accent: 'blue' });
  assert.equal(habit.createdAt, todayStr());
});

test('nextAccent returns the first unused key in order', () => {
  let s = makeDefaultState();
  s = createHabit(s, { name: 'a', accent: ACCENT_KEYS[0] }).state;
  assert.equal(nextAccent(s), ACCENT_KEYS[1]);
});

test('toggleEntry adds then removes a date', () => {
  let { state, habit } = createHabit(makeDefaultState(), { name: 'a', accent: 'red' });
  state = toggleEntry(state, habit.id, '2026-09-02');
  assert.equal(state.habits[0].entries['2026-09-02'], true);
  state = toggleEntry(state, habit.id, '2026-09-02');
  assert.equal('2026-09-02' in state.habits[0].entries, false);
});

test('updateHabit patches fields and keeps entries', () => {
  let { state, habit } = createHabit(makeDefaultState(), { name: 'a', accent: 'red' });
  state = toggleEntry(state, habit.id, '2026-09-02');
  state = updateHabit(state, habit.id, { name: 'b', accent: 'green' });
  assert.equal(state.habits[0].name, 'b');
  assert.equal(state.habits[0].accent, 'green');
  assert.equal(state.habits[0].entries['2026-09-02'], true);
});

test('deleteHabit removes by id', () => {
  let { state, habit } = createHabit(makeDefaultState(), { name: 'a', accent: 'red' });
  state = deleteHabit(state, habit.id);
  assert.equal(state.habits.length, 0);
});

test('setTheme updates settings immutably', () => {
  const s0 = makeDefaultState();
  const s1 = setTheme(s0, 'dark');
  assert.equal(s1.settings.theme, 'dark');
  assert.equal(s0.settings.theme, 'system');
});

test('getHabit finds by id', () => {
  const { state, habit } = createHabit(makeDefaultState(), { name: 'a', accent: 'red' });
  assert.equal(getHabit(state, habit.id).name, 'a');
  assert.equal(getHabit(state, 'nope'), undefined);
});
