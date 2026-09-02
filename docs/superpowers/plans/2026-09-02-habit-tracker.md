# Habit Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a static, offline-capable personal habit tracker web app that installs to the iPhone home screen and is published on GitHub Pages.

**Architecture:** Static files, no build step. ES modules in the browser. All state in `localStorage`. Pure logic modules (`stats.js`, `storage.js`, `heatmap.js`) are unit-tested with `node --test`; the view layer (`ui.js`) produces HTML strings and `app.js` owns state, routing (via `location.hash`), and a single delegated click handler.

**Tech Stack:** Vanilla HTML/CSS/JS, ES modules, `node --test` (Node ≥ 18), Service Worker for offline, Web App Manifest for install.

## Global Constraints

- No build step, no dependencies, no framework. Browser JS is ES modules loaded with `<script type="module">`.
- All resource paths are **relative** (`./js/app.js`, `./sw.js`) so the app works from `username.github.io/<repo>/`.
- `localStorage` key: `habitTracker.v1`. Whole state is one JSON blob.
- Habit entries are **binary**: presence of a `YYYY-MM-DD` key means "done".
- Dates are **local**, never UTC. Format `YYYY-MM-DD`, built from `Date` components.
- Week starts **Monday**.
- Tests run with `node --test` and Node's built-in `assert/strict`. Node ≥ 18.
- Font stack, verbatim: `-apple-system, "SF Pro Text", "Inter", system-ui, sans-serif`.
- Numeric readouts use `font-variant-numeric: tabular-nums`.
- Theme mechanics per spec §5.1: light tokens on bare `:root`; dark values under both `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }` and `:root[data-theme="dark"] { … }`.
- Exact colors: spec §5.2 (neutrals + app accent) and §5.3 (10 habit accents). `js/accents.js` is the single source for habit-accent hex.
- Habit name: 1–40 chars, trimmed. Emoji optional.
- Spec: `docs/superpowers/specs/2026-09-02-habit-tracker-design.md`.

---

## File Structure

| File | Responsibility |
|---|---|
| `index.html` | App shell: meta, manifest link, apple-touch-icon, `#app` + `#sheet` mount points, module script tag. |
| `styles.css` | All theme tokens and layout. |
| `js/accents.js` | `ACCENTS` map (`key → {light, dark}` hex) and `ACCENT_KEYS` order. |
| `js/stats.js` | Pure date helpers + streak / rate / range math. |
| `js/storage.js` | `localStorage` read/write, schema defaults, migration, habit CRUD, entry toggle. All mutators return a new state object. |
| `js/heatmap.js` | `buildGrid(...)` — turns a date window + entries into columns of cells (data only, no DOM). |
| `js/ui.js` | Pure view: `state → HTML string` for list, detail, sheet, settings, and the shared heatmap markup. |
| `js/app.js` | Owns `state`, `range`, `sheet`; hash routing; delegated click handler; theme application; SW registration. |
| `manifest.webmanifest` | PWA manifest. |
| `sw.js` | Precache app shell, cache-first for own assets, navigation → cached `index.html`. |
| `tools/make-icons.mjs` | Dependency-free PNG icon generator (run once, and again if the mark changes). |
| `icons/` | `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`. |
| `tests/stats.test.js` | Unit tests for `stats.js`. |
| `tests/storage.test.js` | Unit tests for `storage.js`. |
| `tests/heatmap.test.js` | Unit tests for `heatmap.js`. |
| `package.json` | `{"type":"module","scripts":{"test":"node --test"}}`. |
| `.nojekyll` | Empty; stops GitHub Pages from touching the tree. |
| `README.md` | Publish steps + add-to-home-screen. |

---

## Task 1: Scaffold + date/stat math (`stats.js`)

**Files:**
- Create: `package.json`
- Create: `js/stats.js`
- Test: `tests/stats.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `formatDate(date: Date): string` — local `YYYY-MM-DD`.
  - `parseDate(str: string): Date` — local midnight.
  - `todayStr(now?: Date): string`.
  - `addDays(str: string, n: number): string`.
  - `mondayOf(str: string): string`.
  - `enumerateDays(fromStr: string, toStr: string): string[]` — inclusive; `[]` if `fromStr > toStr`.
  - `currentStreak(entries: Record<string,true>, today: string): number`.
  - `longestStreak(entries: Record<string,true>): number`.
  - `totalDays(entries: Record<string,true>): number`.
  - `completionRate(entries, fromStr, toStr): { done: number, total: number, pct: number }`.
  - `rangeBounds(rangeKey: 'week'|'month'|'q'|'half'|'year'|'all', today: string, createdAtStr: string): { fromStr: string, toStr: string, mode: 'week'|'grid' }`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "habit-tracker",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 2: Write the failing tests**

Create `tests/stats.test.js`:

```js
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test tests/stats.test.js`
Expected: FAIL — `Cannot find module '../js/stats.js'`.

- [ ] **Step 4: Implement `js/stats.js`**

```js
// Pure date + statistics helpers. No DOM, no localStorage. All dates are local
// "YYYY-MM-DD" strings; string comparison is a valid chronological compare.

export function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayStr(now = new Date()) {
  return formatDate(now);
}

export function addDays(str, n) {
  const dt = parseDate(str);
  dt.setDate(dt.getDate() + n);
  return formatDate(dt);
}

export function mondayOf(str) {
  const dt = parseDate(str);
  const dow = (dt.getDay() + 6) % 7; // Mon=0 … Sun=6
  dt.setDate(dt.getDate() - dow);
  return formatDate(dt);
}

export function enumerateDays(fromStr, toStr) {
  if (fromStr > toStr) return [];
  const out = [];
  let cur = fromStr;
  while (cur <= toStr) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

export function currentStreak(entries, today) {
  const anchor = entries[today] ? today : addDays(today, -1);
  if (!entries[anchor]) return 0;
  let count = 0;
  let cur = anchor;
  while (entries[cur]) {
    count++;
    cur = addDays(cur, -1);
  }
  return count;
}

export function longestStreak(entries) {
  const days = Object.keys(entries).filter((k) => entries[k]).sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const d of days) {
    run = prev !== null && addDays(prev, 1) === d ? run + 1 : 1;
    if (run > best) best = run;
    prev = d;
  }
  return best;
}

export function totalDays(entries) {
  return Object.keys(entries).filter((k) => entries[k]).length;
}

export function completionRate(entries, fromStr, toStr) {
  const days = enumerateDays(fromStr, toStr);
  const total = days.length;
  const done = days.filter((d) => entries[d]).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return { done, total, pct };
}

const RANGE_WEEKS = { month: 5, q: 14, half: 26, year: 52 };

export function rangeBounds(rangeKey, today, createdAtStr) {
  if (rangeKey === 'week') {
    return { fromStr: addDays(today, -6), toStr: today, mode: 'week' };
  }
  if (rangeKey === 'all') {
    const base = createdAtStr <= today ? createdAtStr : today;
    return { fromStr: mondayOf(base), toStr: today, mode: 'grid' };
  }
  const weeks = RANGE_WEEKS[rangeKey];
  return { fromStr: addDays(mondayOf(today), -7 * (weeks - 1)), toStr: today, mode: 'grid' };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test tests/stats.test.js`
Expected: PASS — all tests, 0 failures.

- [ ] **Step 6: Commit**

```bash
git add package.json js/stats.js tests/stats.test.js
git commit -m "feat: date and streak math with tests"
```

---

## Task 2: Accent palette + storage layer (`accents.js`, `storage.js`)

**Files:**
- Create: `js/accents.js`
- Create: `js/storage.js`
- Test: `tests/storage.test.js`

**Interfaces:**
- Consumes: `todayStr` from `js/stats.js`.
- Produces:
  - `js/accents.js`: `ACCENTS: Record<string, {light: string, dark: string}>`, `ACCENT_KEYS: string[]` (insertion order = UI order = auto-assign order).
  - `js/storage.js`:
    - `STORAGE_KEY = 'habitTracker.v1'`.
    - `makeDefaultState(): State` — `{ version: 1, settings: { theme: 'system' }, habits: [] }`.
    - `loadState(storage): State` — missing → default; bad JSON → default with `_corrupt: true`; partial object → migrated.
    - `saveState(storage, state): void` — strips `_corrupt`.
    - `genId(): string` — `"h_" + 6 base36 chars`.
    - `getHabit(state, id): Habit | undefined`.
    - `nextAccent(state): string` — first `ACCENT_KEYS` entry not in use, else wraps by count.
    - `createHabit(state, { name, emoji, accent }): { state: State, habit: Habit }`.
    - `updateHabit(state, id, patch): State`.
    - `deleteHabit(state, id): State`.
    - `toggleEntry(state, id, dateStr): State`.
    - `setTheme(state, theme): State`.
  - `Habit = { id, name, emoji, accent, createdAt, archived: false, entries: Record<string,true> }`.

- [ ] **Step 1: Create `js/accents.js`**

```js
// Single source of truth for per-habit accent colours (spec §5.3).
export const ACCENTS = {
  indigo: { light: '#5B5BD6', dark: '#7C7CF0' },
  blue:   { light: '#2F6FEB', dark: '#4C8DFF' },
  cyan:   { light: '#0E9AB8', dark: '#35C4DE' },
  green:  { light: '#1FA971', dark: '#34D399' },
  lime:   { light: '#5F9E1F', dark: '#86C440' },
  amber:  { light: '#D9931F', dark: '#F0B23C' },
  orange: { light: '#E5622E', dark: '#FB8148' },
  red:    { light: '#DC4B4B', dark: '#FF6060' },
  pink:   { light: '#D6428A', dark: '#FF6BB0' },
  purple: { light: '#8A4FD8', dark: '#A874F5' },
};

export const ACCENT_KEYS = Object.keys(ACCENTS);
```

- [ ] **Step 2: Write the failing tests**

Create `tests/storage.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STORAGE_KEY, makeDefaultState, loadState, saveState,
  createHabit, updateHabit, deleteHabit, toggleEntry, nextAccent, setTheme, getHabit,
} from '../js/storage.js';
import { ACCENT_KEYS } from '../js/accents.js';

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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test tests/storage.test.js`
Expected: FAIL — `Cannot find module '../js/storage.js'`.

- [ ] **Step 4: Implement `js/storage.js`**

```js
import { ACCENT_KEYS } from './accents.js';
import { todayStr } from './stats.js';

export const STORAGE_KEY = 'habitTracker.v1';

export function makeDefaultState() {
  return { version: 1, settings: { theme: 'system' }, habits: [] };
}

export function genId() {
  return 'h_' + Math.random().toString(36).slice(2, 8).padEnd(6, '0');
}

function migrate(state) {
  if (!state || typeof state !== 'object') return makeDefaultState();
  if (!state.version) state.version = 1;
  if (!state.settings || typeof state.settings !== 'object') state.settings = { theme: 'system' };
  if (!state.settings.theme) state.settings.theme = 'system';
  if (!Array.isArray(state.habits)) state.habits = [];
  return state;
}

export function loadState(storage) {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return makeDefaultState();
  try {
    return migrate(JSON.parse(raw));
  } catch {
    return { ...makeDefaultState(), _corrupt: true };
  }
}

export function saveState(storage, state) {
  const { _corrupt, ...clean } = state;
  storage.setItem(STORAGE_KEY, JSON.stringify(clean));
}

export function getHabit(state, id) {
  return state.habits.find((h) => h.id === id);
}

export function nextAccent(state) {
  const used = new Set(state.habits.map((h) => h.accent));
  return ACCENT_KEYS.find((k) => !used.has(k)) || ACCENT_KEYS[state.habits.length % ACCENT_KEYS.length];
}

export function createHabit(state, { name, emoji, accent }) {
  const habit = {
    id: genId(),
    name: name.trim().slice(0, 40),
    emoji: emoji || '',
    accent: accent || nextAccent(state),
    createdAt: todayStr(),
    archived: false,
    entries: {},
  };
  return { state: { ...state, habits: [...state.habits, habit] }, habit };
}

export function updateHabit(state, id, patch) {
  return {
    ...state,
    habits: state.habits.map((h) => {
      if (h.id !== id) return h;
      const next = { ...h, ...patch };
      if (typeof next.name === 'string') next.name = next.name.trim().slice(0, 40);
      return next;
    }),
  };
}

export function deleteHabit(state, id) {
  return { ...state, habits: state.habits.filter((h) => h.id !== id) };
}

export function toggleEntry(state, id, dateStr) {
  return {
    ...state,
    habits: state.habits.map((h) => {
      if (h.id !== id) return h;
      const entries = { ...h.entries };
      if (entries[dateStr]) delete entries[dateStr];
      else entries[dateStr] = true;
      return { ...h, entries };
    }),
  };
}

export function setTheme(state, theme) {
  return { ...state, settings: { ...state.settings, theme } };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test`
Expected: PASS — `tests/stats.test.js` and `tests/storage.test.js`, 0 failures.

- [ ] **Step 6: Commit**

```bash
git add js/accents.js js/storage.js tests/storage.test.js
git commit -m "feat: localStorage state layer with tests"
```

---

## Task 3: App shell, theme CSS, manifest, icons

Manual/visual verification task. No behaviour yet — this locks the visual foundation and the installable metadata so a reviewer can approve the look independently of the logic.

**Files:**
- Create: `index.html`
- Create: `styles.css`
- Create: `manifest.webmanifest`
- Create: `tools/make-icons.mjs`
- Create (generated): `icons/icon-192.png`, `icons/icon-512.png`, `icons/icon-maskable-512.png`, `icons/apple-touch-icon.png`
- Create: `.nojekyll` (empty)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - DOM contract for `app.js` / `ui.js`: mount points `#app` and `#sheet`; `<meta name="theme-color">` present and mutable.
  - CSS class contract used by `ui.js` (Tasks 5–8): `.app-header`, `.icon-btn`, `.segment`, `.seg-item.is-on`, `.list`, `.card`, `.card-top`, `.card-emoji`, `.card-title`, `.card-meta`, `.fire`, `.heatmap[data-mode]`, `.hm-col`, `.hm-month`, `.hm-cells`, `.cell[data-state][data-today]`, `.wk-cell`, `.check-btn.is-done`, `.fab`, `.btn.primary|.ghost|.danger`, `.empty`, `.detail-heat`, `.stats`, `.stat`, `.detail-actions`, `.sheet-backdrop`, `.sheet`, `.field`, `.accent-row`, `.accent-dot.is-on`, `.sheet-actions`, `.settings-row`.
  - Habit-accent colour is delivered as the CSS custom property `--habit-accent`, set inline by `ui.js` on `.card`, `.detail-heat`, `.heatmap`, `.check-btn`.

- [ ] **Step 1: Create `index.html`**

```html
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#F6F7F9">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="Habits">
  <title>Habits</title>
  <link rel="manifest" href="./manifest.webmanifest">
  <link rel="apple-touch-icon" href="./icons/apple-touch-icon.png">
  <link rel="icon" href="./icons/icon-192.png">
  <link rel="stylesheet" href="./styles.css">
</head>
<body>
  <div id="app"></div>
  <div id="sheet"></div>
  <script type="module" src="./js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `styles.css`**

```css
/* ===== theme tokens (spec §5.2) ===== */
:root {
  --bg:#F6F7F9; --surface:#FFFFFF; --surface-sunken:#EFF1F4;
  --cell-empty:#E7E9ED; --border:#E4E6EB;
  --text:#1A1C1F; --text-secondary:#626873; --text-tertiary:#9AA0AB;
  --accent:#4F46E5; --accent-press:#4338CA; --on-accent:#FFFFFF;
  --fire:#F59E0B; --danger:#E5484D;
  --shadow-card:0 1px 2px rgba(16,24,40,.06),0 1px 3px rgba(16,24,40,.10);
  --r-card:16px; --r-btn:12px; --r-cell:2px;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg:#0A0C0F; --surface:#14171C; --surface-sunken:#1C2027;
    --cell-empty:#262A31; --border:#22262D;
    --text:#E9EBEE; --text-secondary:#9AA1AC; --text-tertiary:#656B75;
    --accent:#6366F1; --accent-press:#7C7EF5;
    --fire:#FBBF24; --danger:#FF6369;
    --shadow-card:none;
  }
}
:root[data-theme="dark"] {
  --bg:#0A0C0F; --surface:#14171C; --surface-sunken:#1C2027;
  --cell-empty:#262A31; --border:#22262D;
  --text:#E9EBEE; --text-secondary:#9AA1AC; --text-tertiary:#656B75;
  --accent:#6366F1; --accent-press:#7C7EF5;
  --fire:#FBBF24; --danger:#FF6369;
  --shadow-card:none;
}

*, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
html, body { background:var(--bg); }
body {
  font-family:-apple-system,"SF Pro Text","Inter",system-ui,sans-serif;
  color:var(--text); font-size:14px; line-height:1.4;
  -webkit-font-smoothing:antialiased;
  -webkit-tap-highlight-color:transparent;
}
#app { max-width:640px; margin:0 auto; padding:calc(8px + env(safe-area-inset-top)) 16px calc(96px + env(safe-area-inset-bottom)); }

.app-header { display:flex; align-items:center; gap:8px; padding:12px 0 8px; }
.app-header h1 { flex:1; font-size:20px; font-weight:650; letter-spacing:-0.02em; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.icon-btn { width:32px; height:32px; display:grid; place-items:center; border:none;
  background:transparent; color:var(--text-secondary); font-size:18px; border-radius:10px; }
.icon-btn:active { background:var(--surface-sunken); }

/* segment control */
.segment { display:flex; gap:2px; padding:3px; background:var(--surface-sunken); border-radius:12px; margin:8px 0 16px; }
.seg-item { flex:1; border:none; background:transparent; color:var(--text-secondary);
  font:inherit; font-size:11px; font-weight:550; padding:7px 4px; border-radius:9px; letter-spacing:-0.01em; }
.seg-item.is-on { background:var(--surface); color:var(--text); box-shadow:0 1px 2px rgba(16,24,40,.12); }
:root[data-theme="dark"] .seg-item.is-on,
:root:not([data-theme="light"]) .seg-item.is-on { box-shadow:inset 0 0 0 1px var(--border); }

/* list + card */
.list { display:flex; flex-direction:column; gap:14px; }
.card { background:var(--surface); border-radius:var(--r-card); padding:16px; box-shadow:var(--shadow-card); }
:root[data-theme="dark"] .card,
:root:not([data-theme="light"]) .card { border:1px solid var(--border); }
.card-top { display:flex; align-items:center; gap:8px; margin-bottom:12px; }
.card-emoji { font-size:16px; }
.card-title { flex:1; font-size:14px; font-weight:600; letter-spacing:-0.01em; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.card-meta { font-size:11px; color:var(--text-secondary); font-variant-numeric:tabular-nums;
  display:flex; align-items:center; gap:4px; white-space:nowrap; }
.fire { color:var(--fire); }

/* heatmap */
.heatmap { display:flex; gap:3px; overflow-x:auto; padding-bottom:2px; }
.heatmap[data-mode="week"] { gap:6px; justify-content:space-between; }
.hm-col { display:flex; flex-direction:column; gap:3px; }
.hm-month { font-size:9px; color:var(--text-tertiary); height:10px; line-height:10px; white-space:nowrap; }
.hm-cells { display:grid; grid-auto-flow:row; grid-template-rows:repeat(7,1fr); gap:3px; }
.cell { width:10px; height:10px; border-radius:var(--r-cell); background:var(--cell-empty); display:block; border:0; padding:0; }
.cell[data-state="filled"] { background:var(--habit-accent); }
.cell[data-state="inactive"] { opacity:.4; }
.cell[data-today="1"] { box-shadow:0 0 0 1.5px var(--habit-accent); }
.wk-cell { display:flex; flex-direction:column; align-items:center; gap:4px; }
.wk-cell .cell { width:32px; height:32px; border-radius:6px; }
.wk-cell span { font-size:9px; color:var(--text-tertiary); }

/* check button */
.check-btn { margin-top:14px; width:100%; border:1px solid var(--habit-accent); background:transparent;
  color:var(--text); font:inherit; font-size:12px; font-weight:600; padding:10px; border-radius:var(--r-btn); }
.check-btn.is-done { background:var(--habit-accent); color:#fff; }

/* buttons */
.btn { border:none; font:inherit; font-size:12px; font-weight:600; padding:10px 16px; border-radius:var(--r-btn); }
.btn.primary { background:var(--accent); color:var(--on-accent); }
.btn.primary:active { background:var(--accent-press); }
.btn.ghost { background:var(--surface-sunken); color:var(--text); }
.btn.danger { background:transparent; color:var(--danger); }

/* fab */
.fab { position:fixed; right:calc(16px + env(safe-area-inset-right)); bottom:calc(20px + env(safe-area-inset-bottom));
  width:52px; height:52px; border-radius:50%; border:none; background:var(--accent); color:var(--on-accent);
  font-size:26px; line-height:1; box-shadow:0 4px 14px rgba(79,70,229,.4); }
.fab:active { background:var(--accent-press); }

/* empty state */
.empty { text-align:center; color:var(--text-secondary); padding:48px 16px;
  display:flex; flex-direction:column; gap:16px; align-items:center; }

/* detail */
.detail-heat { margin:8px 0 4px; }
.stats { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin:16px 0; }
.stat { background:var(--surface); border-radius:12px; padding:12px 8px; text-align:center; box-shadow:var(--shadow-card); }
:root[data-theme="dark"] .stat,
:root:not([data-theme="light"]) .stat { border:1px solid var(--border); }
.stat b { display:block; font-size:18px; font-weight:650; letter-spacing:-0.02em; font-variant-numeric:tabular-nums; }
.stat span { font-size:10px; color:var(--text-secondary); }
.detail-actions { display:flex; gap:8px; }
.detail-actions .btn { flex:1; }

/* bottom sheet */
#sheet:empty { display:none; }
.sheet-backdrop { position:fixed; inset:0; background:rgba(0,0,0,.4); }
.sheet { position:fixed; left:0; right:0; bottom:0; max-width:640px; margin:0 auto;
  background:var(--surface); border-radius:20px 20px 0 0;
  padding:20px 20px calc(20px + env(safe-area-inset-bottom));
  box-shadow:0 -8px 30px rgba(0,0,0,.2); }
.sheet h2 { font-size:16px; font-weight:650; margin-bottom:16px; letter-spacing:-0.01em; }
.field { display:flex; flex-direction:column; gap:6px; margin-bottom:14px; }
.field > span { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.06em; color:var(--text-tertiary); }
.field input { font:inherit; font-size:15px; padding:12px; border-radius:12px;
  border:1px solid var(--border); background:var(--surface-sunken); color:var(--text); }
.accent-row { display:flex; flex-wrap:wrap; gap:10px; }
.accent-dot { width:30px; height:30px; border-radius:50%; border:2px solid transparent; background:var(--dot); padding:0; }
.accent-dot.is-on { box-shadow:0 0 0 2px var(--surface),0 0 0 4px var(--dot); }
.sheet-actions { display:flex; gap:8px; margin-top:8px; }
.sheet-actions .btn { flex:1; }

/* settings */
.settings-row { display:flex; flex-direction:column; gap:8px; padding:8px 0; }
.settings-row > span { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.06em; color:var(--text-tertiary); }

@media (prefers-reduced-motion: no-preference) {
  .sheet { animation:sheet-up .16s ease-out; }
  @keyframes sheet-up { from { transform:translateY(100%); } }
}
```

- [ ] **Step 3: Create `manifest.webmanifest`**

```json
{
  "name": "Habits",
  "short_name": "Habits",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "background_color": "#0A0C0F",
  "theme_color": "#0A0C0F",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 4: Create `tools/make-icons.mjs`**

```js
// Dependency-free PNG icon generator. Draws an --accent rounded square with a
// 5×5 white dot grid. Run: node tools/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // colour type: RGBA
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter: none
    rgba.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idat = deflateSync(raw);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function draw(size, { bleed }) {
  const buf = Buffer.alloc(size * size * 4);
  const bg = [0x4f, 0x46, 0xe5];
  const radius = bleed ? 0 : size * 0.18;
  const grid = 5;
  const margin = size * 0.22;
  const span = size - margin * 2;
  const step = span / (grid - 1);
  const dotR = size * 0.055;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const cornerOut = radius > 0 && (
        (x < radius && y < radius && Math.hypot(radius - x, radius - y) > radius) ||
        (x > size - radius && y < radius && Math.hypot(x - (size - radius), radius - y) > radius) ||
        (x < radius && y > size - radius && Math.hypot(radius - x, y - (size - radius)) > radius) ||
        (x > size - radius && y > size - radius && Math.hypot(x - (size - radius), y - (size - radius)) > radius)
      );
      if (cornerOut) { buf[i + 3] = 0; continue; }
      buf[i] = bg[0]; buf[i + 1] = bg[1]; buf[i + 2] = bg[2]; buf[i + 3] = 255;
      for (let gy = 0; gy < grid; gy++) {
        for (let gx = 0; gx < grid; gx++) {
          if (Math.hypot(x - (margin + gx * step), y - (margin + gy * step)) <= dotR) {
            buf[i] = 255; buf[i + 1] = 255; buf[i + 2] = 255; buf[i + 3] = 255;
          }
        }
      }
    }
  }
  return buf;
}

mkdirSync('icons', { recursive: true });
writeFileSync('icons/icon-192.png', png(192, draw(192, { bleed: false })));
writeFileSync('icons/icon-512.png', png(512, draw(512, { bleed: false })));
writeFileSync('icons/icon-maskable-512.png', png(512, draw(512, { bleed: true })));
writeFileSync('icons/apple-touch-icon.png', png(180, draw(180, { bleed: true })));
console.log('icons written');
```

- [ ] **Step 5: Generate the icons**

Run: `node tools/make-icons.mjs`
Expected: prints `icons written`; `ls icons` shows the four PNGs, each non-empty.

- [ ] **Step 6: Create `.nojekyll`**

Run: `touch .nojekyll`

- [ ] **Step 7: Verify the shell in a browser**

Run: `python3 -m http.server 8000`
Then open `http://localhost:8000/` and check:
- Page loads with no console errors (the `app.js` 404 is expected until Task 5 — or create an empty `js/app.js` now; if so, `git add` it in Step 8).
- In DevTools, set `<html data-theme="dark">`: `document.documentElement.style` background and CSS vars flip to the dark palette (`--bg` = `#0A0C0F`). Remove the attribute → back to light. Set `data-theme="light"` while the OS is in dark mode → stays light.
- DevTools → Application → Manifest: parses, name "Habits", 3 icons resolve.
- `icons/apple-touch-icon.png` opens and shows the indigo mark.

- [ ] **Step 8: Commit**

```bash
git add index.html styles.css manifest.webmanifest tools/make-icons.mjs icons .nojekyll
git commit -m "feat: app shell, theme tokens, manifest and icons"
```

---

## Task 4: Heatmap grid model (`heatmap.js`)

**Files:**
- Create: `js/heatmap.js`
- Test: `tests/heatmap.test.js`

**Interfaces:**
- Consumes: `enumerateDays`, `addDays`, `mondayOf`, `parseDate` from `js/stats.js`.
- Produces:
  - `buildGrid({ fromStr, toStr, entries, todayStr, createdAtStr, mode }): { mode: 'week'|'grid', columns: Column[] }`.
  - `Column = { monthLabel: string | null, cells: Cell[] }` — 7 cells per column in `grid` mode; one column of 7 cells in `week` mode.
  - `Cell = { dateStr: string, state: 'filled'|'empty'|'inactive', isToday: boolean }`.
  - `state`: `inactive` if `dateStr < createdAtStr` or `dateStr > todayStr`; else `filled` if `entries[dateStr]`; else `empty`.
  - `MONTHS: string[]` — `['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек']` (exported for reuse/tests).

- [ ] **Step 1: Write the failing tests**

Create `tests/heatmap.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/heatmap.test.js`
Expected: FAIL — `Cannot find module '../js/heatmap.js'`.

- [ ] **Step 3: Implement `js/heatmap.js`**

```js
import { enumerateDays, addDays, mondayOf, parseDate } from './stats.js';

export const MONTHS = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

function cell(dateStr, entries, todayStr, createdAtStr) {
  let state;
  if (dateStr < createdAtStr || dateStr > todayStr) state = 'inactive';
  else if (entries[dateStr]) state = 'filled';
  else state = 'empty';
  return { dateStr, state, isToday: dateStr === todayStr };
}

export function buildGrid({ fromStr, toStr, entries, todayStr, createdAtStr, mode }) {
  if (mode === 'week') {
    const cells = enumerateDays(fromStr, toStr).map((d) => cell(d, entries, todayStr, createdAtStr));
    return { mode: 'week', columns: [{ monthLabel: null, cells }] };
  }

  const start = mondayOf(fromStr);
  const endMon = mondayOf(toStr);
  const columns = [];
  let colStart = start;
  let prevMonth = null;
  while (colStart <= endMon) {
    const cells = [];
    for (let i = 0; i < 7; i++) {
      cells.push(cell(addDays(colStart, i), entries, todayStr, createdAtStr));
    }
    const month = parseDate(colStart).getMonth();
    const monthLabel = month !== prevMonth ? MONTHS[month] : null;
    prevMonth = month;
    columns.push({ monthLabel, cells });
    colStart = addDays(colStart, 7);
  }
  return { mode: 'grid', columns };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/heatmap.test.js`
Expected: PASS — 4 tests, 0 failures.

- [ ] **Step 5: Run the whole suite**

Run: `node --test`
Expected: PASS — stats, storage, heatmap; 0 failures.

- [ ] **Step 6: Commit**

```bash
git add js/heatmap.js tests/heatmap.test.js
git commit -m "feat: heatmap grid model with tests"
```

---

## Task 5: List screen + routing + theme (`ui.js`, `app.js`)

Manual/visual verification. Delivers the running app with the list screen, range switcher, mark-today, navigation, and live theme. Add/edit sheet, detail, and settings screens are stubbed as no-ops here and completed in Tasks 6–8.

**Files:**
- Create: `js/ui.js`
- Create: `js/app.js` (replaces any empty placeholder from Task 3)

**Interfaces:**
- Consumes: `js/stats.js`, `js/heatmap.js`, `js/accents.js`, `js/storage.js`.
- Produces (`js/ui.js`, added to across Tasks 5–8):
  - `esc(s): string` — escapes `& < > "`.
  - `heatmapHTML({ habit, range, theme, interactive }): string` — `<div class="heatmap" …>`. When `interactive` and a cell is not `inactive`, the cell carries `data-action="toggle-cell" data-id data-date`.
  - `segmentHTML(range, { withAll }): string` — range switcher. Keys/labels: `year`→`Год`, `half`→`6 мес`, `q`→`3 мес`, `month`→`Месяц`, `week`→`Неделя`, and `all`→`Всё` only when `withAll`.
  - `listHTML({ state, range, theme }): string` — full `#app` innerHTML for `#/`.
  - `detailHTML(...)`, `sheetHTML(...)`, `settingsHTML(...)` — **stubs** in this task (see Step 1), real bodies added in Tasks 7, 6, 8 respectively. Their signatures are fixed now so `app.js` imports never change.
- Produces (`js/app.js`):
  - Module side effects only. Owns `let state`, `let range = 'year'`, `let sheet = null`.
  - `render()` — routes on `location.hash` (`#/`, `#/habit/:id`, `#/settings`), sets `#app`/`#sheet` innerHTML, applies theme, focuses `#habit-name` when a sheet is open.
  - `resolvedTheme(): 'light'|'dark'`, `applyTheme()`, `persist()`.
  - One delegated `document` click handler keyed on `data-action`. Tasks 6–8 add `case` branches only.
- Data-action vocabulary (full set; Tasks 6–8 add handlers, Task 5 wires the ones marked ✓):
  `add`, `open-settings` ✓, `open-habit` ✓, `set-range` ✓, `toggle-today` ✓, `back` ✓,
  `edit-habit`, `delete-habit`, `toggle-cell`, `pick-accent`, `save-habit`, `cancel-sheet`, `set-theme`.

- [ ] **Step 1: Create `js/ui.js`**

```js
import { rangeBounds, todayStr, currentStreak, totalDays, parseDate } from './stats.js';
import { buildGrid } from './heatmap.js';
import { ACCENTS } from './accents.js';

export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
));

const RANGES = [
  ['year', 'Год'], ['half', '6 мес'], ['q', '3 мес'],
  ['month', 'Месяц'], ['week', 'Неделя'], ['all', 'Всё'],
];

export function segmentHTML(range, { withAll = false } = {}) {
  const items = RANGES
    .filter(([k]) => withAll || k !== 'all')
    .map(([k, l]) => `<button class="seg-item${k === range ? ' is-on' : ''}" data-action="set-range" data-range="${k}">${l}</button>`)
    .join('');
  return `<div class="segment">${items}</div>`;
}

const WD = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

export function heatmapHTML({ habit, range, theme, interactive }) {
  const today = todayStr();
  const { fromStr, toStr, mode } = rangeBounds(range, today, habit.createdAt);
  const grid = buildGrid({
    fromStr, toStr, entries: habit.entries,
    todayStr: today, createdAtStr: habit.createdAt, mode,
  });
  const accent = ACCENTS[habit.accent][theme];

  const tap = (c) => (interactive && c.state !== 'inactive'
    ? ` data-action="toggle-cell" data-id="${habit.id}" data-date="${c.dateStr}"` : '');
  const cellTag = (c) => `<i class="cell" data-state="${c.state}"${c.isToday ? ' data-today="1"' : ''}${tap(c)}></i>`;

  if (grid.mode === 'week') {
    const cells = grid.columns[0].cells.map((c) => (
      `<div class="wk-cell">${cellTag(c)}<span>${WD[parseDate(c.dateStr).getDay()]}</span></div>`
    )).join('');
    return `<div class="heatmap" data-mode="week" style="--habit-accent:${accent}">${cells}</div>`;
  }

  const cols = grid.columns.map((col) => {
    const label = `<span class="hm-month">${col.monthLabel ?? ''}</span>`;
    const cells = col.cells.map(cellTag).join('');
    return `<div class="hm-col">${label}<div class="hm-cells">${cells}</div></div>`;
  }).join('');
  return `<div class="heatmap" data-mode="grid" style="--habit-accent:${accent}">${cols}</div>`;
}

export function listHTML({ state, range, theme }) {
  const today = todayStr();
  const cards = state.habits.map((h) => {
    const accent = ACCENTS[h.accent][theme];
    const cs = currentStreak(h.entries, today);
    const tot = totalDays(h.entries);
    const done = !!h.entries[today];
    return `
      <div class="card" data-action="open-habit" data-id="${h.id}" style="--habit-accent:${accent}">
        <div class="card-top">
          <span class="card-emoji">${esc(h.emoji || '•')}</span>
          <span class="card-title">${esc(h.name)}</span>
          <span class="card-meta"><span class="fire">🔥</span> ${cs} · ${tot}d</span>
        </div>
        ${heatmapHTML({ habit: h, range, theme, interactive: false })}
        <button class="check-btn${done ? ' is-done' : ''}" data-action="toggle-today" data-id="${h.id}">
          ${done ? 'Отмечено сегодня' : 'Отметить сегодня'}
        </button>
      </div>`;
  }).join('');

  const empty = `
    <div class="empty">
      <p>Пока нет привычек.</p>
      <button class="btn primary" data-action="add">Добавить привычку</button>
    </div>`;

  return `
    <header class="app-header">
      <h1>Habits</h1>
      <button class="icon-btn" data-action="open-settings" aria-label="Настройки">⚙︎</button>
    </header>
    ${segmentHTML(range, { withAll: false })}
    <main class="list">${state.habits.length ? cards : empty}</main>
    <button class="fab" data-action="add" aria-label="Добавить">+</button>`;
}

// --- Stubs. Real implementations land in later tasks; signatures are fixed now
//     so app.js imports never change. ---

// Task 7 replaces this.
export function detailHTML({ state, id, range, theme }) {
  const h = state.habits.find((x) => x.id === id);
  return `
    <header class="app-header">
      <button class="icon-btn" data-action="back" aria-label="Назад">‹</button>
      <h1>${esc(h ? h.name : '')}</h1><span class="icon-btn"></span>
    </header>
    <p class="empty">Экран деталей — Task 7.</p>`;
}

// Task 8 replaces this.
export function settingsHTML({ state, theme }) {
  return `
    <header class="app-header">
      <button class="icon-btn" data-action="back" aria-label="Назад">‹</button>
      <h1>Настройки</h1><span class="icon-btn"></span>
    </header>
    <p class="empty">Настройки — Task 8.</p>`;
}

// Task 6 replaces this.
export function sheetHTML({ sheet, state, theme }) {
  return '';
}
```

- [ ] **Step 2: Create `js/app.js`**

```js
import {
  loadState, saveState, createHabit, updateHabit, deleteHabit,
  toggleEntry, setTheme, nextAccent, getHabit,
} from './storage.js';
import { todayStr } from './stats.js';
import { listHTML, detailHTML, sheetHTML, settingsHTML } from './ui.js';

const appRoot = document.getElementById('app');
const sheetRoot = document.getElementById('sheet');
const themeMeta = document.querySelector('meta[name="theme-color"]');
const mq = window.matchMedia('(prefers-color-scheme: dark)');

let state = loadState(localStorage);
let range = 'year';
let sheet = null; // null | { mode:'add', accent } | { mode:'edit', id, accent }

function resolvedTheme() {
  const t = state.settings.theme;
  return t === 'system' ? (mq.matches ? 'dark' : 'light') : t;
}

function applyTheme() {
  const t = state.settings.theme;
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  themeMeta.setAttribute('content', resolvedTheme() === 'dark' ? '#0A0C0F' : '#F6F7F9');
}

function persist() {
  saveState(localStorage, state);
}

function render() {
  applyTheme();
  const theme = resolvedTheme();
  const hash = location.hash || '#/';

  if (hash.startsWith('#/habit/')) {
    const id = decodeURIComponent(hash.slice('#/habit/'.length));
    if (!getHabit(state, id)) { location.hash = '#/'; return; }
    appRoot.innerHTML = detailHTML({ state, id, range, theme });
  } else if (hash === '#/settings') {
    appRoot.innerHTML = settingsHTML({ state, theme });
  } else {
    appRoot.innerHTML = listHTML({ state, range, theme });
  }

  sheetRoot.innerHTML = sheet ? sheetHTML({ sheet, state, theme }) : '';
  if (sheet) {
    const n = document.getElementById('habit-name');
    if (n) n.focus();
  }
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const d = el.dataset;
  switch (d.action) {
    case 'open-settings':
      location.hash = '#/settings';
      break;
    case 'open-habit':
      location.hash = '#/habit/' + encodeURIComponent(d.id);
      break;
    case 'back':
      location.hash = '#/';
      break;
    case 'set-range':
      range = d.range;
      render();
      break;
    case 'toggle-today':
      state = toggleEntry(state, d.id, todayStr());
      persist();
      render();
      break;
    default:
      break;
  }
});

window.addEventListener('hashchange', render);
mq.addEventListener('change', () => { if (state.settings.theme === 'system') render(); });

render();
```

> Note for later tasks: Tasks 6–8 only (a) swap the matching stub in `ui.js` for a real implementation and (b) add `case` branches to this click handler. `app.js` imports and `render()` do not change.

- [ ] **Step 3: Verify the list screen in a browser**

Run: `python3 -m http.server 8000`
Open `http://localhost:8000/`, then in DevTools console seed data:

```js
localStorage.setItem('habitTracker.v1', JSON.stringify({
  version: 1,
  settings: { theme: 'system' },
  habits: [{
    id: 'h_test01', name: 'Post on Threads', emoji: '🧵', accent: 'indigo',
    createdAt: '2026-06-01', archived: false,
    entries: { '2026-09-01': true, '2026-08-31': true, '2026-08-30': true },
  }],
}));
location.reload();
```

Check:
- Card renders: emoji, title, `🔥 0 · 3d` meta (streak 0 because 2026-09-02 in the future vs real "today" — adjust seed dates to be recent if you want a live streak).
- Heatmap shows filled cells for the seeded dates in the accent colour; horizontal scroll works for "Год".
- Tap the range switcher: `Неделя` → a row of 7 big cells with weekday labels; `Месяц`/`3 мес`/`6 мес` → fewer/more columns; selection pill moves.
- "Отметить сегодня" toggles the today cell + button label + `🔥`/`d` meta, and survives reload.
- Tap the card body (not the button) → URL becomes `#/habit/h_test01`; screen stays on the list (detail is stubbed). `⚙︎` → `#/settings`; likewise stubbed. Both are expected no-vis* until Tasks 7–8.
- Settings → system theme still tracks the OS; forcing `document.documentElement.dataset.theme='dark'` flips palette and `<meta name="theme-color">` content.

- [ ] **Step 4: Commit**

```bash
git add js/ui.js js/app.js
git commit -m "feat: list screen, hash routing, live theme"
```

---

## Task 6: Add / edit habit sheet (`ui.js`, `app.js`)

Manual/visual verification.

**Files:**
- Modify: `js/ui.js` — replace the `sheetHTML` stub.
- Modify: `js/app.js` — add `add`, `edit-habit`, `pick-accent`, `save-habit`, `cancel-sheet` cases.

**Interfaces:**
- Consumes: `ACCENTS`, `ACCENT_KEYS` from `js/accents.js`; `esc` (already in `ui.js`); `createHabit`, `updateHabit`, `nextAccent` from `js/storage.js`.
- Produces (`ui.js`):
  - `sheetHTML({ sheet, state, theme }): string` where `sheet` is `{ mode:'add', accent }` or `{ mode:'edit', id, accent }`. Emits `.sheet-backdrop` (`data-action="cancel-sheet"`), inputs `#habit-name` (maxlength 40) and `#habit-emoji` (maxlength 8), one `.accent-dot` per `ACCENT_KEYS` entry (`data-action="pick-accent" data-accent` + inline `--dot` colour, `.is-on` for the selected one), and Cancel / Save buttons (`data-action="cancel-sheet"` / `data-action="save-habit"`).
- Produces (`app.js` handler behaviour):
  - `add` → `sheet = { mode:'add', accent: nextAccent(state) }; render()`.
  - `edit-habit` → `sheet = { mode:'edit', id: d.id, accent: getHabit(state,d.id).accent }; render()`.
  - `pick-accent` → `sheet.accent = d.accent; render()`.
  - `cancel-sheet` → `sheet = null; render()`.
  - `save-habit` → read `#habit-name` (trim; if empty, refocus and return), `#habit-emoji` (trim); `add` → `createHabit`, `edit` → `updateHabit(state, sheet.id, { name, emoji, accent: sheet.accent })`; then `sheet = null; persist(); render()`.

- [ ] **Step 1: Replace the `sheetHTML` stub in `js/ui.js`**

Update the import line at the top of `js/ui.js`:

```js
import { ACCENTS, ACCENT_KEYS } from './accents.js';
```

Replace the stub `export function sheetHTML(...) { return ''; }` with:

```js
export function sheetHTML({ sheet, state, theme }) {
  const editing = sheet.mode === 'edit';
  const h = editing ? state.habits.find((x) => x.id === sheet.id) : null;
  const name = h ? h.name : '';
  const emoji = h ? h.emoji : '';

  const dots = ACCENT_KEYS.map((k) => (
    `<button class="accent-dot${k === sheet.accent ? ' is-on' : ''}" data-action="pick-accent" data-accent="${k}" style="--dot:${ACCENTS[k][theme]}" aria-label="${k}"></button>`
  )).join('');

  return `
    <div class="sheet-backdrop" data-action="cancel-sheet"></div>
    <div class="sheet" role="dialog" aria-modal="true">
      <h2>${editing ? 'Изменить привычку' : 'Новая привычка'}</h2>
      <label class="field">
        <span>Название</span>
        <input id="habit-name" type="text" maxlength="40" value="${esc(name)}" placeholder="Например, Читать 20 минут">
      </label>
      <label class="field">
        <span>Эмодзи</span>
        <input id="habit-emoji" type="text" maxlength="8" value="${esc(emoji)}" placeholder="необязательно">
      </label>
      <div class="field">
        <span>Цвет</span>
        <div class="accent-row">${dots}</div>
      </div>
      <div class="sheet-actions">
        <button class="btn ghost" data-action="cancel-sheet">Отмена</button>
        <button class="btn primary" data-action="save-habit">Сохранить</button>
      </div>
    </div>`;
}
```

- [ ] **Step 2: Add handler cases in `js/app.js`**

Inside the `switch (d.action)` block, above `default:`, add:

```js
    case 'add':
      sheet = { mode: 'add', accent: nextAccent(state) };
      render();
      break;
    case 'edit-habit':
      sheet = { mode: 'edit', id: d.id, accent: getHabit(state, d.id).accent };
      render();
      break;
    case 'pick-accent':
      sheet.accent = d.accent;
      render();
      break;
    case 'cancel-sheet':
      sheet = null;
      render();
      break;
    case 'save-habit': {
      const nameEl = document.getElementById('habit-name');
      const name = nameEl.value.trim();
      if (!name) { nameEl.focus(); return; }
      const emoji = document.getElementById('habit-emoji').value.trim();
      if (sheet.mode === 'add') {
        state = createHabit(state, { name, emoji, accent: sheet.accent }).state;
      } else {
        state = updateHabit(state, sheet.id, { name, emoji, accent: sheet.accent });
      }
      sheet = null;
      persist();
      render();
      break;
    }
```

- [ ] **Step 3: Verify in a browser**

Run: `python3 -m http.server 8000` and open `http://localhost:8000/`.
- Tap **+** → sheet slides up; `#habit-name` is focused; a default accent dot is `.is-on`.
- Type a name, pick a different colour dot (`.is-on` moves), leave emoji blank, tap **Сохранить** → sheet closes, new card appears with `•` placeholder emoji and the chosen accent.
- Tap **+**, tap **Сохранить** with an empty name → nothing saved, name field refocuses.
- Tap **+**, tap the backdrop → sheet closes, nothing added.
- (Detail screen edit is verified in Task 7, but the `edit-habit` path can be smoke-tested now: run `document.querySelector('[data-action]')`… or wait for Task 7.)
- Reload → new habit persists.

- [ ] **Step 4: Commit**

```bash
git add js/ui.js js/app.js
git commit -m "feat: add/edit habit bottom sheet"
```

---

## Task 7: Habit detail screen (`ui.js`, `app.js`)

Manual/visual verification.

**Files:**
- Modify: `js/ui.js` — replace the `detailHTML` stub.
- Modify: `js/app.js` — add `toggle-cell` and `delete-habit` cases.

**Interfaces:**
- Consumes: `rangeBounds`, `currentStreak`, `longestStreak`, `totalDays`, `completionRate`, `todayStr` from `js/stats.js`; `ACCENTS` from `js/accents.js`; `heatmapHTML`, `segmentHTML`, `esc` (already in `ui.js`); `toggleEntry`, `deleteHabit` from `js/storage.js`.
- Produces (`ui.js`):
  - `detailHTML({ state, id, range, theme }): string` — header with `data-action="back"` and `<h1>` = emoji + name; `.detail-heat` wrapper with inline `--habit-accent` containing `heatmapHTML({ habit, range, theme, interactive: true })`; `segmentHTML(range, { withAll: true })`; a `.stats` grid of 4 `.stat` (`<b>` value + `<span>` label): текущий стрик, лучший стрик, всего дней, `${pct}%` за период (pct from `completionRate` over `rangeBounds(range, today, habit.createdAt)`); `.detail-actions` with `data-action="edit-habit"` (`.btn.ghost`) and `data-action="delete-habit"` (`.btn.danger`), both carrying `data-id`.
- Produces (`app.js` handler behaviour):
  - `toggle-cell` → `state = toggleEntry(state, d.id, d.date); persist(); render()`.
  - `delete-habit` → `if (confirm('Удалить привычку и всю её историю?')) { state = deleteHabit(state, d.id); persist(); location.hash = '#/'; render(); }`.

- [ ] **Step 1: Replace the `detailHTML` stub in `js/ui.js`**

Update the stats import at the top of `js/ui.js` to include everything used:

```js
import {
  rangeBounds, todayStr, currentStreak, longestStreak,
  totalDays, completionRate, parseDate,
} from './stats.js';
```

Replace the stub `export function detailHTML(...)` with:

```js
export function detailHTML({ state, id, range, theme }) {
  const h = state.habits.find((x) => x.id === id);
  const today = todayStr();
  const { fromStr, toStr } = rangeBounds(range, today, h.createdAt);
  const cs = currentStreak(h.entries, today);
  const ls = longestStreak(h.entries);
  const tot = totalDays(h.entries);
  const { pct } = completionRate(h.entries, fromStr, toStr);
  const accent = ACCENTS[h.accent][theme];
  const heading = `${h.emoji ? esc(h.emoji) + ' ' : ''}${esc(h.name)}`;

  return `
    <header class="app-header">
      <button class="icon-btn" data-action="back" aria-label="Назад">‹</button>
      <h1>${heading}</h1>
      <span class="icon-btn" aria-hidden="true"></span>
    </header>
    <div class="detail-heat" style="--habit-accent:${accent}">
      ${heatmapHTML({ habit: h, range, theme, interactive: true })}
    </div>
    ${segmentHTML(range, { withAll: true })}
    <div class="stats">
      <div class="stat"><b>${cs}</b><span>Текущий стрик</span></div>
      <div class="stat"><b>${ls}</b><span>Лучший стрик</span></div>
      <div class="stat"><b>${tot}</b><span>Всего дней</span></div>
      <div class="stat"><b>${pct}%</b><span>За период</span></div>
    </div>
    <div class="detail-actions">
      <button class="btn ghost" data-action="edit-habit" data-id="${h.id}">Изменить</button>
      <button class="btn danger" data-action="delete-habit" data-id="${h.id}">Удалить</button>
    </div>`;
}
```

- [ ] **Step 2: Add handler cases in `js/app.js`**

Inside `switch (d.action)`, above `default:`, add:

```js
    case 'toggle-cell':
      state = toggleEntry(state, d.id, d.date);
      persist();
      render();
      break;
    case 'delete-habit':
      if (confirm('Удалить привычку и всю её историю?')) {
        state = deleteHabit(state, d.id);
        persist();
        location.hash = '#/';
        render();
      }
      break;
```

- [ ] **Step 3: Verify in a browser**

Run: `python3 -m http.server 8000`, open `http://localhost:8000/`, seed a habit whose `createdAt` and `entries` are near the real current date so streaks are non-zero. Then:
- Tap a card → detail screen: heading shows emoji + name; large heatmap; 4 stat tiles.
- Cross-check one stat by hand against the seed data (e.g. 3 consecutive days ending today → "Текущий стрик 3").
- Switch range on the detail segment, including **Всё** → heatmap and "За период %" update; **Всё** scrolls from `createdAt`.
- Tap a past, active heatmap cell → it toggles filled/empty, stats recompute, persists across reload. Tapping an `inactive` (pre-createdAt / future) cell does nothing.
- Tap **Изменить** → sheet opens prefilled; change the name → detail heading updates.
- Tap **Удалить** → confirm dialog; on OK, returns to list without the habit; on Cancel, nothing changes.
- Visiting `#/habit/does-not-exist` directly → redirects to `#/`.

- [ ] **Step 4: Commit**

```bash
git add js/ui.js js/app.js
git commit -m "feat: habit detail screen with editable heatmap and stats"
```

---

## Task 8: Settings screen + theme persistence (`ui.js`, `app.js`)

Manual/visual verification.

**Files:**
- Modify: `js/ui.js` — replace the `settingsHTML` stub.
- Modify: `js/app.js` — add the `set-theme` case.

**Interfaces:**
- Consumes: `setTheme` from `js/storage.js` (already imported in `app.js`); `esc` (unused here, fine).
- Produces (`ui.js`):
  - `settingsHTML({ state, theme }): string` — `.app-header` with `data-action="back"` + `<h1>Настройки</h1>`; one `.settings-row` labelled `Тема` containing a `.segment` of three `.seg-item` buttons, `data-action="set-theme"` with `data-theme` of `system` / `light` / `dark`, labels `Система` / `Светлая` / `Тёмная`, `.is-on` on `state.settings.theme`.
- Produces (`app.js` handler behaviour):
  - `set-theme` → `state = setTheme(state, d.theme); persist(); render()` (which calls `applyTheme()`).

- [ ] **Step 1: Replace the `settingsHTML` stub in `js/ui.js`**

```js
export function settingsHTML({ state, theme }) {
  const cur = state.settings.theme;
  const opts = [['system', 'Система'], ['light', 'Светлая'], ['dark', 'Тёмная']];
  const seg = opts.map(([k, l]) => (
    `<button class="seg-item${k === cur ? ' is-on' : ''}" data-action="set-theme" data-theme="${k}">${l}</button>`
  )).join('');
  return `
    <header class="app-header">
      <button class="icon-btn" data-action="back" aria-label="Назад">‹</button>
      <h1>Настройки</h1>
      <span class="icon-btn" aria-hidden="true"></span>
    </header>
    <div class="settings-row">
      <span>Тема</span>
      <div class="segment">${seg}</div>
    </div>`;
}
```

- [ ] **Step 2: Add the handler case in `js/app.js`**

Inside `switch (d.action)`, above `default:`, add:

```js
    case 'set-theme':
      state = setTheme(state, d.theme);
      persist();
      render();
      break;
```

- [ ] **Step 3: Verify in a browser**

Run: `python3 -m http.server 8000`, open `http://localhost:8000/`, tap `⚙︎`.
- Three options; `.is-on` reflects the stored value (`Система` on a fresh profile).
- Tap **Тёмная** → whole app switches to the dark palette immediately; `<html data-theme="dark">`; `<meta name="theme-color">` content is `#0A0C0F`. Reload → still dark.
- Tap **Светлая** → light even if the OS is in dark mode. Reload → still light.
- Tap **Система** → `data-theme` attribute removed; app follows the OS. Flip the OS/DevTools `prefers-color-scheme` while on this screen → app re-renders to match (via the `mq` change listener).
- **Назад** → returns to the list.

- [ ] **Step 4: Commit**

```bash
git add js/ui.js js/app.js
git commit -m "feat: settings screen with persisted theme choice"
```

---

## Task 9: Service worker + offline

Manual/visual verification. Added last so a stale cache never interferes with Tasks 5–8.

**Files:**
- Create: `js/sw-register.js`
- Modify: `index.html` — add `<script type="module" src="./js/sw-register.js"></script>` after the `app.js` script tag.
- Create: `sw.js` (repo root — must be a sibling of `index.html` so its scope covers the app).

**Interfaces:**
- Consumes: nothing.
- Produces: `sw.js` — precache the app shell on `install`, `skipWaiting`; drop old caches on `activate`, `clients.claim`; `fetch`: navigations → cached `./index.html` (fallback to network), other same-origin GETs → cache-first.

- [ ] **Step 1: Create `sw.js` at the repo root**

```js
const CACHE = 'habits-cache-v1';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './js/app.js',
  './js/sw-register.js',
  './js/ui.js',
  './js/storage.js',
  './js/stats.js',
  './js/heatmap.js',
  './js/accents.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  if (request.mode === 'navigate') {
    e.respondWith(caches.match('./index.html').then((r) => r || fetch(request)));
    return;
  }
  e.respondWith(caches.match(request).then((r) => r || fetch(request)));
});
```

- [ ] **Step 2: Create `js/sw-register.js`**

```js
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
```

- [ ] **Step 3: Wire it into `index.html`**

Add directly below the existing module script:

```html
  <script type="module" src="./js/app.js"></script>
  <script type="module" src="./js/sw-register.js"></script>
```

- [ ] **Step 4: Verify offline behaviour**

Run: `python3 -m http.server 8000`, open `http://localhost:8000/`.
- DevTools → Application → Service Workers: `sw.js` is "activated and running". Cache Storage → `habits-cache-v1` lists every asset in `ASSETS`.
- Check the "Offline" box (or DevTools Network → Offline), reload → app still loads, seeded habits render, range switching and mark-today still work (writes go to `localStorage`).
- Navigate to `#/settings` and `#/habit/:id` while offline → both render (navigation falls back to cached `index.html`, hash routing does the rest).
- Bump `CACHE` to `habits-cache-v2`, reload twice → old cache is gone from Cache Storage, new one present.

- [ ] **Step 5: Commit**

```bash
git add sw.js js/sw-register.js index.html
git commit -m "feat: service worker for offline app shell"
```

---

## Task 10: README, publish, acceptance pass

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

```markdown
# Habits

Personal habit tracker. Static web app — no backend, data lives in `localStorage`
on the device. Works offline and installs to the iOS home screen.

## Run locally

ES modules need HTTP (not `file://`):

    python3 -m http.server 8000

Open <http://localhost:8000/>.

## Test

    node --test

## Publish on GitHub Pages

1. Push this repo to GitHub.
2. Settings → Pages → Build and deployment → Source: **Deploy from a branch**,
   Branch: **main**, folder: **/ (root)**. Save.
3. Wait for the Pages build, then open `https://<user>.github.io/<repo>/`.

All paths are relative, so the subdirectory URL works as-is.

## Add to the iPhone home screen

1. Open the Pages URL in Safari.
2. Share → **Add to Home Screen** → Add.
3. Launch it from the icon — it opens full-screen and works without a connection.

## Regenerate icons

    node tools/make-icons.mjs
```

- [ ] **Step 2: Run the full automated suite**

Run: `node --test`
Expected: PASS — `tests/stats.test.js`, `tests/storage.test.js`, `tests/heatmap.test.js`; 0 failures.

- [ ] **Step 3: Run the manual acceptance checklist (spec §8)**

Serve with `python3 -m http.server 8000`, start from an empty `localStorage`, and confirm each:

1. Add a habit → appears with chosen emoji + accent.
2. "Отметить сегодня" fills today's cell; tapping again clears it.
3. Reload → data intact.
4. Open detail → the 4 metrics are correct against known data.
5. Tap a past active cell in detail → toggles, metrics recompute.
6. Switch range → heatmap and % change on list and detail.
7. Edit a habit (name / emoji / accent) → reflected on list and detail.
8. Delete a habit → confirm → gone, back to list.
9. Settings: Светлая / Тёмная / Система apply instantly and survive reload; `theme-color` meta tracks.
10. Dark theme matches spec §5.2 tokens (deep blue-black bg, borders not shadows).
11. Airplane Mode → launching from the home screen still opens the app with data.
12. Installed to home screen → correct icon, full-screen `standalone`, safe-area padding respected.
13. Served from a subdirectory (`/<repo>/`) → all assets and the SW load.

Fix any failure in its owning module, re-run `node --test`, re-verify, and note the fix in the commit.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: readme with publish and install steps"
```

---

## Self-Review (completed while writing)

**Spec coverage**

| Spec section | Task(s) |
|---|---|
| §1 features: add/edit/delete, binary mark, GitHub-style heatmap, ranges, themes | 2, 4, 5, 6, 7, 8 |
| §2 architecture / file layout / hash routing | 3, 5 |
| §3 data model, `habitTracker.v1`, migration, corrupt-JSON guard | 2 |
| §4.1 list screen + global range segment + FAB + empty state | 5 |
| §4.2 detail screen + 4 stats + editable cells | 7 |
| §4.3 add/edit sheet (name, emoji, accent, auto-accent) | 6 |
| §4.4 single heatmap renderer, range→columns table, week row, inactive days, today ring | 4, 5 |
| §4.5 settings theme segment | 8 |
| §5.1 theme mechanics (`:root` / media / `[data-theme]`, `theme-color`) | 3, 5, 8 |
| §5.2 neutral + app-accent tokens (exact hex) | 3 |
| §5.3 10 habit accents, light/dark, order = auto-assign | 2, 3, 6 |
| §5.4 typography (font stack, sizes, tabular-nums) | 3 |
| §5.5 safe-area, tap-highlight, reduced-motion | 3 |
| §6 manifest, icons, apple meta, `sw.js` app-shell, relative paths | 3, 9 |
| §7 `stats.js` pure functions + listed edge-case tests | 1 |
| §8 acceptance checklist | 10 |
| §9 open items (confirm dialog = native `confirm`; heatmap cell sizing; icon mark) | 7 (confirm), 3 (cell CSS / icon) |

**Placeholder scan:** none — every code step carries full file or full function bodies; every verification step names the command and the expected result.

**Type consistency:** `buildGrid` return `{ mode, columns:[{monthLabel, cells:[{dateStr,state,isToday}]}] }` is produced in Task 4 and consumed identically in Task 5 `heatmapHTML`. `rangeBounds(rangeKey, today, createdAtStr) → {fromStr,toStr,mode}` defined in Task 1, used in Tasks 4/5/7. `ui.js` exports `esc`, `segmentHTML`, `heatmapHTML`, `listHTML`, `detailHTML`, `sheetHTML`, `settingsHTML` — the four screen functions exist as stubs from Task 5 so `app.js` imports are stable; Tasks 6/7/8 swap bodies only. `storage.js` mutators (`createHabit` returns `{state,habit}`; `updateHabit`/`deleteHabit`/`toggleEntry`/`setTheme` return `State`) are used that way in `app.js`.

