# Habit Tracker v2 (iOS Calendar) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the v1 GitHub-heatmap UI with a native-feeling iOS-Calendar model: per-habit 3-month strip on the main screen, a continuously scrolling month view, a continuously scrolling year view, day marking by tap, and no metrics anywhere.

**Architecture:** Same static/no-build/ES-modules/`localStorage`/PWA base as v1. New pure `js/calendar.js` produces month matrices and day-state; `js/ui.js` is rewritten as pure `state → HTML string` view functions for the three screens plus sheet/settings/context-menu; `js/app.js` is rewritten for a 3-level hash-routed navigation stack with push/pop slide transitions, long-press context menu, sheet swipe-to-dismiss, targeted day-toggle DOM updates, and lazy month/year window extension on scroll. Dead v1 logic (`js/heatmap.js`, streak/rate/range functions in `js/stats.js`) is removed last.

**Tech Stack:** Vanilla HTML/CSS/JS, ES modules, `node --test` (Node ≥ 18), Service Worker, Web App Manifest.

## Global Constraints

- No build step, no dependencies, no framework. Browser JS is ES modules.
- All resource paths **relative** (`./js/…`, `./sw.js`) — works from `user.github.io/<repo>/`.
- `localStorage` key: `habitTracker.v1`. Data model unchanged from v1: `{ version:1, settings:{theme}, habits:[{id,name,emoji,accent,createdAt,archived:false,entries:{}}] }`. `entries[date] === true` means marked.
- Dates are **local** `YYYY-MM-DD`, built from `Date` components; string comparison is chronological compare. Weeks start **Monday**.
- Marking rule: any day with `dateStr <= todayStr` is toggleable; `dateStr > todayStr` (future) is inert. `createdAt` no longer restricts marking.
- No metrics anywhere (no streak, total, completion %). No range switcher. No "mark today" button.
- Font stack, verbatim: `-apple-system, "SF Pro Text", "Inter", system-ui, sans-serif`.
- Theme mechanics (unchanged from v1): light tokens on bare `:root`; dark values under both `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }` and `:root[data-theme="dark"] { … }`. `body` paints an explicit `--bg`.
- New token `--today`: `#FF3B30` on `:root`, `#FF453A` in both dark blocks. Distinct from `--danger`.
- Habit-accent colour reaches CSS as the `--habit-accent` custom property, set inline by `ui.js` on the card / month-scroll / year-scroll containers.
- Hash routes: `#/` (main), `#/h/:id` (month view), `#/h/:id/year` (year view), `#/settings`. A missing `:id` redirects to `#/`.
- Navigation depth for transition direction: main = 0, month = 1, settings = 1, year = 2. `newDepth - prevDepth > 0` → push (slide in from right); `< 0` → pop (slide out to right); `=== 0` or `noAnim` → instant swap.
- `prefers-reduced-motion: reduce` → all screen transitions and overlay animations become a ≤120ms opacity cross-fade or nothing.
- Tests run with `node --test` and `node:assert/strict`. Node ≥ 18.
- Service worker cache name bumps to `habits-cache-v2` in this plan; navigations stay network-first (from v1 final), other GETs cache-first.
- Spec: `docs/superpowers/specs/2026-09-02-habit-tracker-v2-calendar.md`.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `js/calendar.js` | **create** | Pure: month matrices, month names, weekday labels, `ym` helpers, `dayState`. |
| `tests/calendar.test.js` | **create** | Unit tests for `calendar.js`. |
| `js/stats.js` | trim (Task 8) | Keep only date primitives: `formatDate`, `parseDate`, `todayStr`, `addDays`, `mondayOf`, `enumerateDays`. Remove streak/rate/range functions + `RANGE_WEEKS`. |
| `tests/stats.test.js` | trim (Task 8) | Drop tests for removed functions. |
| `js/heatmap.js` | **delete** (Task 8) | No longer used. |
| `tests/heatmap.test.js` | **delete** (Task 8) | — |
| `js/ui.js` | **rewrite** (Task 3) | Pure view: `esc`, `mainHTML`, `miniMonthHTML`, `monthGridHTML`, `monthGridsHTML`, `monthViewHTML`, `yearBlockHTML`, `yearBlocksHTML`, `yearViewHTML`, `sheetHTML`, `settingsHTML`, `contextMenuHTML`. |
| `tests/ui.test.js` | **create** (Task 3) | Smoke tests: escaping, data-action presence/absence by day state, strip month count. |
| `js/app.js` | **rewrite** (Tasks 4–6) | State, 3-level hash routing, push/pop transitions, delegated click handler, long-press context menu, sheet swipe, targeted day-toggle, lazy month/year windows, theme, SW registration entry. |
| `js/storage.js` | unchanged | State load/save, migration/normalization, habit CRUD, `toggleEntry`. |
| `js/accents.js` | unchanged | `ACCENTS`, `ACCENT_KEYS`. |
| `js/sw-register.js` | unchanged | SW registration. |
| `styles.css` | **rewrite** (Task 2) | Full v2 stylesheet: tokens (+`--today`), nav bars, main card + strip, day cells, month view, year view, sheet, context menu, transitions, iOS press states. Keep the v1 token system. |
| `index.html` | modify (Task 2) | Add `<div id="context"></div>`; keep `#app`, `#sheet`, meta, script tags. |
| `sw.js` | modify (Task 7) | `ASSETS`: remove `./js/heatmap.js`, add `./js/calendar.js`; `CACHE` → `habits-cache-v2`. |
| `README.md` | check (Task 7) | Confirm the "Deploying an update" section still describes the `CACHE` bump. |

**Broken-window note:** after Task 3 the app is non-functional in the browser (v2 `ui.js` against v1 `app.js`) until Task 4 lands. Task 3's deliverable is verified by `node --test`, not the browser. This is expected for a rewrite.

---

## Task 1: Calendar model (`js/calendar.js`)

**Files:**
- Create: `js/calendar.js`
- Test: `tests/calendar.test.js`

**Interfaces:**
- Consumes: `parseDate`, `formatDate` from `js/stats.js` (both survive the Task 8 trim).
- Produces:
  - `MONTH_NAMES: string[]` (12, Russian nominative).
  - `monthName(month: number): string` — `month` is 0–11.
  - `weekdayLabels(): string[]` → `['п','в','с','ч','п','с','в']`.
  - `ymKey(ym: {year,month}): string` → `"YYYY-MM"` zero-padded month.
  - `shiftYM(ym: {year,month}, delta: number): {year,month}` — add `delta` months, normalising across years.
  - `todayYM(todayStr: string): {year,month}`.
  - `listMonths(fromYM, toYM): {year,month}[]` — inclusive, ascending.
  - `monthMatrix(year: number, month: number): (string|null)[][]` — weeks of 7 (Monday-first); `null` for leading/trailing blanks; else `"YYYY-MM-DD"`.
  - `dayState(dateStr: string, entries: Record<string,true>, todayStr: string): 'future'|'today'|'marked-today'|'marked'|'plain'`.

- [ ] **Step 1: Write the failing tests**

Create `tests/calendar.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/calendar.test.js`
Expected: FAIL — `Cannot find module '../js/calendar.js'`.

- [ ] **Step 3: Implement `js/calendar.js`**

```js
// Pure calendar helpers. No DOM. Dates are local "YYYY-MM-DD" strings.
import { parseDate, formatDate } from './stats.js';

export const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

export function monthName(month) {
  return MONTH_NAMES[month];
}

export function weekdayLabels() {
  return ['п', 'в', 'с', 'ч', 'п', 'с', 'в'];
}

export function ymKey(ym) {
  return `${ym.year}-${String(ym.month + 1).padStart(2, '0')}`;
}

export function shiftYM(ym, delta) {
  let y = ym.year;
  let m = ym.month + delta;
  while (m < 0) { m += 12; y -= 1; }
  while (m > 11) { m -= 12; y += 1; }
  return { year: y, month: m };
}

export function todayYM(todayStr) {
  const d = parseDate(todayStr);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function listMonths(fromYM, toYM) {
  const out = [];
  let cur = { year: fromYM.year, month: fromYM.month };
  while (cur.year < toYM.year || (cur.year === toYM.year && cur.month <= toYM.month)) {
    out.push({ year: cur.year, month: cur.month });
    cur = shiftYM(cur, 1);
  }
  return out;
}

export function monthMatrix(year, month) {
  const lead = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0 … Sun=6
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < lead; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(formatDate(new Date(year, month, d)));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function dayState(dateStr, entries, todayStr) {
  if (dateStr > todayStr) return 'future';
  const marked = Boolean(entries[dateStr]);
  if (dateStr === todayStr) return marked ? 'marked-today' : 'today';
  return marked ? 'marked' : 'plain';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/calendar.test.js`
Expected: PASS — 10 tests, 0 failures.

- [ ] **Step 5: Run the whole suite**

Run: `node --test`
Expected: PASS — `calendar`, `stats`, `storage`, `heatmap` suites; 0 failures.

- [ ] **Step 6: Commit**

```bash
git add js/calendar.js tests/calendar.test.js
git commit -m "feat: calendar model (month matrix, day state) with tests

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: v2 stylesheet + `#context` mount

Manual/visual verification. Replaces the whole stylesheet and adds one mount point. No behaviour — this is the visual + structural foundation that Tasks 3–6 render into.

**Files:**
- Rewrite: `styles.css`
- Modify: `index.html`

**Interfaces:**
- Consumes: nothing.
- Produces (the class/DOM contract consumed by `js/ui.js` in Task 3 and `js/app.js` in Tasks 4–6):
  - Mounts: `#app` (transition stage), `#sheet`, `#context`.
  - Screen layer: `.view` (one per screen inside `#app`), transition classes `.enter-from-right`, `.enter-from-left`, `.exit-to-left`, `.exit-to-right`.
  - Main: `.app-header` + `h1` + `.icon-btn`; `.list`; `.card` (+ `.lifted`); `.card-head`, `.card-emoji`, `.card-title`; `.strip`; `.mini-month` (+ `.is-cur`), `.mini-label`, `.mini-grid`; `.fab`; `.empty`; `.banner-error` (corrupt-data banner, carried over from v1).
  - Day cell (shared by mini / month / year): `.day` (+ `.pad`) wrapping `.dot`; `[data-state]` in `future|today|marked|marked-today|plain`.
  - Sub-screen nav: `.nav-bar` + `.nav-back` (+ `.chev`) + `.nav-title` + `.nav-spacer`.
  - Month view: `.weekday-row`; `#month-scroll` / `.month-scroll`; `.month` (`[data-ym]`, `[data-cur]`), `.month-name` (+ `.is-cur`), `.month-grid`.
  - Year view: `#year-scroll` / `.year-scroll`; `.year-block` (`[data-year]`); `.year-heading` (sticky); `.year-grid`; `.ymini` (+ `.is-cur`), `.ymini-label`, `.ymini-grid`.
  - Sheet: `.sheet-backdrop`, `.sheet` (`#sheet-panel`), `.grabber`, `.field`, `.accent-row`, `.accent-dot` (+ `.is-on`), `.sheet-actions`.
  - Context menu: `.ctx-backdrop`, `.ctx-sheet`, `.ctx-item` (+ `.danger`).
  - Settings: `.settings-row`, `.segment`, `.seg-item` (+ `.is-on`).
  - Buttons: `.btn` (+ `.primary`, `.ghost`, `.danger`).

- [ ] **Step 1: Rewrite `styles.css`**

```css
/* ===== theme tokens ===== */
:root {
  --bg:#F6F7F9; --surface:#FFFFFF; --surface-sunken:#EFF1F4;
  --border:#E4E6EB;
  --text:#1A1C1F; --text-secondary:#626873; --text-tertiary:#9AA0AB;
  --accent:#4F46E5; --accent-press:#4338CA; --on-accent:#FFFFFF;
  --today:#FF3B30; --danger:#E5484D;
  --shadow-card:0 1px 2px rgba(16,24,40,.06),0 1px 3px rgba(16,24,40,.10);
  --shadow-lift:0 12px 40px rgba(16,24,40,.28);
  --r-card:16px; --r-btn:12px;
  --ease-ios:cubic-bezier(.32,.72,0,1);
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg:#0A0C0F; --surface:#14171C; --surface-sunken:#1C2027;
    --border:#22262D;
    --text:#E9EBEE; --text-secondary:#9AA1AC; --text-tertiary:#656B75;
    --accent:#6366F1; --accent-press:#7C7EF5;
    --today:#FF453A; --danger:#FF6369;
    --shadow-card:none;
    --shadow-lift:0 12px 44px rgba(0,0,0,.6);
  }
}
:root[data-theme="dark"] {
  --bg:#0A0C0F; --surface:#14171C; --surface-sunken:#1C2027;
  --border:#22262D;
  --text:#E9EBEE; --text-secondary:#9AA1AC; --text-tertiary:#656B75;
  --accent:#6366F1; --accent-press:#7C7EF5;
  --today:#FF453A; --danger:#FF6369;
  --shadow-card:none;
  --shadow-lift:0 12px 44px rgba(0,0,0,.6);
}

*, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
html, body {
  background:var(--bg); height:100%; overflow:hidden;
  overscroll-behavior:none;
}
body {
  font-family:-apple-system,"SF Pro Text","Inter",system-ui,sans-serif;
  color:var(--text); font-size:15px; line-height:1.4;
  -webkit-font-smoothing:antialiased;
  -webkit-tap-highlight-color:transparent;
}

/* ===== transition stage ===== */
#app {
  position:relative; overflow:hidden;
  width:100%; height:100dvh;
}
@supports not (height: 100dvh) { #app { height:100vh; } }

.view {
  position:absolute; inset:0;
  background:var(--bg);
  display:flex; flex-direction:column;
  overflow:hidden;
  padding-top:env(safe-area-inset-top);
  transition:transform .34s var(--ease-ios), opacity .34s var(--ease-ios);
}
.view.enter-from-right { transform:translateX(100%); }
.view.enter-from-left  { transform:translateX(-100%); }
.view.exit-to-left  { transform:translateX(-22%); opacity:.5; }
.view.exit-to-right { transform:translateX(100%); }
@media (prefers-reduced-motion: reduce) {
  .view { transition:opacity .12s linear; }
  .view.enter-from-right, .view.enter-from-left,
  .view.exit-to-left, .view.exit-to-right { transform:none; opacity:0; }
}

/* ===== main header ===== */
.app-header {
  display:flex; align-items:center; gap:8px;
  padding:12px 16px 8px;
}
.app-header h1 {
  flex:1; font-size:30px; font-weight:700; letter-spacing:-.02em;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
.icon-btn {
  width:40px; height:40px; display:grid; place-items:center;
  border:0; background:transparent; color:var(--text-secondary);
  font-size:20px; border-radius:12px;
}
.icon-btn:active { background:var(--surface-sunken); }

/* ===== sub-screen nav bar ===== */
.nav-bar {
  display:flex; align-items:center;
  min-height:44px; padding:6px 10px;
  border-bottom:.5px solid var(--border);
}
.nav-back {
  display:inline-flex; align-items:center; gap:2px;
  min-width:84px; height:40px; padding:0 6px;
  border:0; background:none; font:inherit; font-size:17px;
  color:var(--accent);
}
.nav-back .chev { font-size:24px; line-height:1; margin-top:-2px; }
.nav-back:active { opacity:.5; }
.nav-title {
  flex:1; text-align:center; font-size:14px; font-weight:600; letter-spacing:-.01em;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
.nav-spacer { min-width:84px; }

/* ===== main list + cards ===== */
.list { flex:1; overflow-y:auto; -webkit-overflow-scrolling:touch;
  padding:4px 16px calc(96px + env(safe-area-inset-bottom)); display:flex; flex-direction:column; gap:14px; }
.card {
  background:var(--surface); border-radius:var(--r-card); padding:14px;
  box-shadow:var(--shadow-card);
  transition:transform .18s var(--ease-ios), box-shadow .18s var(--ease-ios);
  user-select:none; -webkit-user-select:none; -webkit-touch-callout:none;
}
:root[data-theme="dark"] .card,
:root:not([data-theme="light"]) .card { border:1px solid var(--border); }
.card:active { transform:scale(.985); }
.card.lifted { transform:scale(1.03); box-shadow:var(--shadow-lift); position:relative; z-index:60; }
.card-head { display:flex; align-items:center; gap:8px; margin-bottom:10px; }
.card-emoji { font-size:17px; }
.card-title { flex:1; font-size:15px; font-weight:600; letter-spacing:-.01em;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.strip { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:10px; }
.mini-month { min-width:0; }
.mini-label { font-size:11px; font-weight:600; color:var(--text-secondary); margin-bottom:4px; }
.mini-month.is-cur .mini-label { color:var(--today); }
.mini-grid { display:grid; grid-template-columns:repeat(7, minmax(0,1fr)); gap:1px; }
.mini-grid .day { aspect-ratio:1; }
.mini-grid .dot { width:15px; height:15px; font-size:9px; }
.mini-grid .day[data-state="marked-today"] .dot { box-shadow:0 0 0 1.5px var(--today); }

/* ===== shared day cell ===== */
.day {
  width:100%; aspect-ratio:1;
  display:grid; place-items:center;
  border:0; background:none; padding:0; margin:0; font-family:inherit;
  -webkit-tap-highlight-color:transparent;
}
.day.pad { visibility:hidden; }
.day .dot {
  width:36px; height:36px; border-radius:50%;
  display:grid; place-items:center;
  font-size:17px; font-weight:400; color:var(--text);
  transition:transform .09s var(--ease-ios);
}
.day[data-state="future"] { pointer-events:none; }
.day[data-state="future"] .dot { color:var(--text-tertiary); }
.day[data-state="today"] .dot { color:var(--today); font-weight:700; }
.day[data-state="marked"] .dot { background:var(--habit-accent); color:#fff; font-weight:600; }
.day[data-state="marked-today"] .dot {
  background:var(--habit-accent); color:#fff; font-weight:700;
  box-shadow:0 0 0 2px var(--today);
}
button.day:active .dot { transform:scale(.86); }

/* ===== month view ===== */
.weekday-row {
  display:grid; grid-template-columns:repeat(7, minmax(0,1fr));
  padding:6px 10px; border-bottom:.5px solid var(--border);
}
.weekday-row span { text-align:center; font-size:12px; color:var(--text-secondary); }
.month-scroll {
  flex:1; overflow-y:auto; -webkit-overflow-scrolling:touch; overscroll-behavior:contain;
  padding:0 10px calc(40px + env(safe-area-inset-bottom));
}
.month { padding-top:14px; }
.month-name {
  font-size:22px; font-weight:700; letter-spacing:-.02em;
  margin:12px 6px 8px;
}
.month-name.is-cur { color:var(--today); }
.month-grid { display:grid; grid-template-columns:repeat(7, minmax(0,1fr)); gap:2px; }
.month-grid .day { min-height:44px; }

/* ===== year view ===== */
.year-scroll {
  flex:1; overflow-y:auto; -webkit-overflow-scrolling:touch; overscroll-behavior:contain;
  padding:0 12px calc(40px + env(safe-area-inset-bottom));
}
.year-heading {
  position:sticky; top:0; z-index:5;
  background:var(--bg);
  font-size:22px; font-weight:700; letter-spacing:-.02em;
  padding:12px 2px 8px;
}
.year-grid { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:16px 10px; padding-bottom:10px; }
.ymini { border:0; background:none; padding:0; font-family:inherit; text-align:left; min-width:0; }
.ymini:active { opacity:.55; }
.ymini-label { display:block; font-size:13px; font-weight:700; margin:0 0 4px 2px; }
.ymini.is-cur .ymini-label { color:var(--today); }
.ymini-grid { display:grid; grid-template-columns:repeat(7, minmax(0,1fr)); gap:1px; }
.ymini-grid .dot { width:11px; height:11px; font-size:7px; }
.ymini-grid .day[data-state="marked-today"] .dot { box-shadow:0 0 0 1.5px var(--today); }

/* ===== fab / buttons / empty ===== */
.fab {
  position:fixed; right:calc(16px + env(safe-area-inset-right));
  bottom:calc(20px + env(safe-area-inset-bottom));
  width:52px; height:52px; border-radius:50%; border:0;
  background:var(--accent); color:var(--on-accent); font-size:26px; line-height:1;
  box-shadow:0 4px 14px rgba(79,70,229,.4); z-index:40;
}
.fab:active { background:var(--accent-press); transform:scale(.94); }
.btn { border:0; font:inherit; font-size:14px; font-weight:600; padding:12px 16px; border-radius:var(--r-btn); }
.btn:active { opacity:.7; }
.btn.primary { background:var(--accent); color:var(--on-accent); }
.btn.ghost { background:var(--surface-sunken); color:var(--text); }
.btn.danger { background:transparent; color:var(--danger); }
.empty { flex:1; display:flex; flex-direction:column; gap:16px; align-items:center; justify-content:center;
  text-align:center; color:var(--text-secondary); padding:48px 16px; }
.banner-error {
  margin:8px 16px 0; padding:10px 12px; border-radius:var(--r-btn);
  background:var(--surface); border:1px solid var(--danger); color:var(--danger);
  font-size:12px; font-weight:550;
}

/* ===== bottom sheet ===== */
#sheet:empty, #context:empty { display:none; }
.sheet-backdrop { position:fixed; inset:0; background:rgba(0,0,0,.4); z-index:70; }
.sheet {
  position:fixed; left:0; right:0; bottom:0; z-index:71;
  max-width:640px; margin:0 auto;
  background:var(--surface); border-radius:22px 22px 0 0;
  padding:8px 20px calc(20px + env(safe-area-inset-bottom));
  box-shadow:0 -8px 30px rgba(0,0,0,.25);
  animation:sheet-up .3s var(--ease-ios);
  touch-action:none;
}
.grabber { width:36px; height:5px; border-radius:3px; background:var(--text-tertiary);
  margin:6px auto 12px; opacity:.6; }
.sheet h2 { font-size:17px; font-weight:650; margin-bottom:16px; letter-spacing:-.01em; }
.field { display:flex; flex-direction:column; gap:6px; margin-bottom:14px; }
.field > span { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.06em; color:var(--text-tertiary); }
.field input { font:inherit; font-size:16px; padding:12px; border-radius:12px;
  border:1px solid var(--border); background:var(--surface-sunken); color:var(--text); }
.accent-row { display:flex; flex-wrap:wrap; gap:10px; }
.accent-dot { width:30px; height:30px; border-radius:50%; border:2px solid transparent; background:var(--dot); padding:0; }
.accent-dot.is-on { box-shadow:0 0 0 2px var(--surface),0 0 0 4px var(--dot); }
.sheet-actions { display:flex; gap:8px; margin-top:8px; }
.sheet-actions .btn { flex:1; }
@keyframes sheet-up { from { transform:translateY(100%); } }

/* ===== context menu ===== */
.ctx-backdrop {
  position:fixed; inset:0; z-index:50;
  background:rgba(0,0,0,.25);
  backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px);
  animation:ctx-fade .2s ease-out;
}
.ctx-sheet {
  position:fixed; left:16px; right:16px; z-index:61;
  bottom:calc(24px + env(safe-area-inset-bottom));
  max-width:608px; margin:0 auto;
  background:var(--surface); border-radius:16px; overflow:hidden;
  box-shadow:var(--shadow-lift);
  animation:ctx-pop .2s var(--ease-ios);
}
.ctx-item {
  display:block; width:100%; text-align:center;
  border:0; background:none; font:inherit; font-size:16px; color:var(--text);
  padding:16px;
}
.ctx-item + .ctx-item { border-top:.5px solid var(--border); }
.ctx-item.danger { color:var(--danger); font-weight:600; }
.ctx-item:active { background:var(--surface-sunken); }
@keyframes ctx-fade { from { opacity:0; } }
@keyframes ctx-pop { from { opacity:0; transform:scale(.9); } }
@media (prefers-reduced-motion: reduce) {
  .sheet, .ctx-backdrop, .ctx-sheet { animation:none; }
}

/* ===== settings ===== */
.settings-row { display:flex; flex-direction:column; gap:8px; padding:16px; }
.settings-row > span { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.06em; color:var(--text-tertiary); }
.segment { display:flex; gap:2px; padding:3px; background:var(--surface-sunken); border-radius:12px; }
.seg-item { flex:1; border:0; background:transparent; color:var(--text-secondary);
  font:inherit; font-size:13px; font-weight:550; padding:8px 4px; border-radius:9px; }
.seg-item.is-on { background:var(--surface); color:var(--text); box-shadow:0 1px 2px rgba(16,24,40,.12); }
:root[data-theme="dark"] .seg-item.is-on,
:root:not([data-theme="light"]) .seg-item.is-on { box-shadow:inset 0 0 0 1px var(--border); }
.seg-item:active { opacity:.6; }
```

- [ ] **Step 2: Update `index.html`**

Add `<div id="context"></div>` directly after the existing `<div id="sheet"></div>`. The file becomes:

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
  <div id="context"></div>
  <script type="module" src="./js/app.js"></script>
  <script type="module" src="./js/sw-register.js"></script>
</body>
</html>
```

- [ ] **Step 3: Verify tokens and layout primitives in a browser**

Run: `python3 -m http.server 8000`, open `http://localhost:8000/`.
The app JS is v1 and will error (expected — v1 `ui.js` still present, v1 `app.js` still present, so it actually still renders the v1 UI with the *new* stylesheet — layout will look broken, that's fine). Instead verify the stylesheet directly in the console:

```js
// token check
const root = document.documentElement;
getComputedStyle(root).getPropertyValue('--today').trim();        // "#FF3B30" (light) — flip OS/devtools to dark → "#FF453A"
root.setAttribute('data-theme','dark');
getComputedStyle(root).getPropertyValue('--bg').trim();           // "#0A0C0F"
getComputedStyle(root).getPropertyValue('--today').trim();        // "#FF453A"
root.removeAttribute('data-theme');

// inject a day cell and confirm the marked circle uses --habit-accent
document.body.insertAdjacentHTML('beforeend',
  '<div style="--habit-accent:#4C8DFF;padding:20px"><span class="day" data-state="marked"><span class="dot">9</span></span>' +
  '<span class="day" data-state="marked-today"><span class="dot">2</span></span>' +
  '<span class="day" data-state="today"><span class="dot">3</span></span></div>');
const dot = document.querySelector('.day[data-state="marked"] .dot');
getComputedStyle(dot).backgroundColor;                            // rgb(76, 141, 255)
getComputedStyle(document.querySelector('.day[data-state="marked-today"] .dot')).boxShadow; // contains the --today red
getComputedStyle(document.querySelector('.day[data-state="today"] .dot')).color;            // the --today red
```

Confirm: `--today` resolves in both themes; `#context` element exists (`document.getElementById('context')`); marked `.dot` background is the injected accent; `marked-today` `.dot` has a red ring; `today` `.dot` text is red.

- [ ] **Step 4: Run the suite (unchanged)**

Run: `node --test`
Expected: PASS — `calendar`, `stats`, `storage`, `heatmap`; 0 failures.

- [ ] **Step 5: Commit**

```bash
git add styles.css index.html
git commit -m "feat: v2 stylesheet (calendar layout, iOS nav/press/transitions) + #context mount

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: v2 view layer (`js/ui.js`)

**Files:**
- Rewrite: `js/ui.js`
- Test: `tests/ui.test.js`

**Interfaces:**
- Consumes:
  - `ACCENTS`, `ACCENT_KEYS` from `js/accents.js`.
  - `todayStr` from `js/stats.js`.
  - `monthMatrix`, `monthName`, `weekdayLabels`, `dayState`, `ymKey`, `shiftYM`, `todayYM` from `js/calendar.js`.
  - `getHabit` from `js/storage.js`.
- Produces (every export is a pure `→ string`; no DOM, no listeners):
  - `esc(s): string` — escapes `& < > "`.
  - `mainHTML({ state, theme }): string` — full `#app` view for `#/`.
  - `miniMonthHTML({ ym, habit, today }): string` — one compact month for the main card strip (no weekday row).
  - `monthGridHTML({ ym, habit, today }): string` — one full `<section class="month">` for the month view.
  - `monthGridsHTML({ months, habit, today }): string` — concatenated `monthGridHTML` over a `{year,month}[]`.
  - `monthViewHTML({ state, id, months, theme }): string` — full view for `#/h/:id` (nav bar, weekday row, `#month-scroll` wrapping `monthGridsHTML`).
  - `yearBlockHTML({ year, habit, today }): string` — one `<section class="year-block">` (heading + 12 `.ymini`).
  - `yearBlocksHTML({ years, habit, today }): string` — concatenated `yearBlockHTML` over a `number[]`.
  - `yearViewHTML({ state, id, years, theme }): string` — full view for `#/h/:id/year` (nav bar, `#year-scroll` wrapping `yearBlocksHTML`).
  - `sheetHTML({ sheet, state, theme }): string` — bottom sheet; `sheet` is `{mode:'add',accent,name?,emoji?}` or `{mode:'edit',id,accent,name?,emoji?}`.
  - `settingsHTML({ state }): string` — settings view for `#/settings`.
  - `contextMenuHTML({ habit }): string` — long-press overlay (`.ctx-backdrop` + `.ctx-sheet`).
- Data-action vocabulary emitted (wired in Tasks 4–6): `open-habit`, `open-settings`, `add` (Task 4); `toggle-day` (Task 4); `open-year`, `back-main` (Task 4/5); `open-month` (Task 5); `edit-habit`, `delete-habit`, `close-context` (Task 6); `pick-accent`, `save-habit`, `cancel-sheet` (Task 6, unchanged from v1); `set-theme` (Task 4).
- Day cell markup contract: `<span class="day pad"></span>` for a `null` cell; `<button class="day" data-state="<st>" data-action="toggle-day" data-id data-date><span class="dot">N</span></button>` when `interactive && st !== 'future'`; otherwise `<span class="day" data-state="<st>"><span class="dot">N</span></span>`.

- [ ] **Step 1: Write `js/ui.js`**

```js
import { ACCENTS, ACCENT_KEYS } from './accents.js';
import { todayStr } from './stats.js';
import {
  monthMatrix, monthName, weekdayLabels, dayState, ymKey, shiftYM, todayYM,
} from './calendar.js';
import { getHabit } from './storage.js';

export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
));

const accentHex = (habit, theme) => ACCENTS[habit.accent][theme];

// ---- shared day cell ----
function dayCell(dateStr, habit, today, interactive) {
  if (!dateStr) return '<span class="day pad"></span>';
  const st = dayState(dateStr, habit.entries, today);
  const num = Number(dateStr.slice(8, 10));
  if (interactive && st !== 'future') {
    return `<button class="day" data-state="${st}" data-action="toggle-day" data-id="${habit.id}" data-date="${dateStr}"><span class="dot">${num}</span></button>`;
  }
  return `<span class="day" data-state="${st}"><span class="dot">${num}</span></span>`;
}

function gridCells(ym, habit, today, interactive) {
  return monthMatrix(ym.year, ym.month).flat()
    .map((d) => dayCell(d, habit, today, interactive)).join('');
}

// ---- main screen ----
export function miniMonthHTML({ ym, habit, today }) {
  const isCur = ymKey(ym) === today.slice(0, 7);
  return `<div class="mini-month${isCur ? ' is-cur' : ''}">`
    + `<div class="mini-label">${monthName(ym.month)}</div>`
    + `<div class="mini-grid">${gridCells(ym, habit, today, false)}</div>`
    + `</div>`;
}

export function mainHTML({ state, theme }) {
  const today = todayStr();
  const cur = todayYM(today);
  const strip = [shiftYM(cur, -1), cur, shiftYM(cur, 1)];
  const cards = state.habits.map((h) => (
    `<div class="card" data-action="open-habit" data-id="${h.id}" style="--habit-accent:${accentHex(h, theme)}">`
    + `<div class="card-head"><span class="card-emoji">${esc(h.emoji || '•')}</span>`
    + `<span class="card-title">${esc(h.name)}</span></div>`
    + `<div class="strip">${strip.map((ym) => miniMonthHTML({ ym, habit: h, today })).join('')}</div>`
    + `</div>`
  )).join('');
  const empty = '<div class="empty"><p>Пока нет привычек.</p>'
    + '<button class="btn primary" data-action="add">Добавить привычку</button></div>';
  const banner = state._corrupt
    ? '<div class="banner-error" role="alert">Не удалось прочитать сохранённые данные. Начат новый список — старые данные не тронуты.</div>'
    : '';
  return `
    ${banner}
    <header class="app-header">
      <h1>Habits</h1>
      <button class="icon-btn" data-action="open-settings" aria-label="Настройки">⚙︎</button>
    </header>
    <main class="list">${state.habits.length ? cards : empty}</main>
    <button class="fab" data-action="add" aria-label="Добавить">+</button>`;
}

// ---- month view ----
export function monthGridHTML({ ym, habit, today }) {
  const isCur = ymKey(ym) === today.slice(0, 7);
  const yearTag = ym.month === 0 ? ` ${ym.year}` : '';
  return `<section class="month" data-ym="${ymKey(ym)}"${isCur ? ' data-cur="1"' : ''}>`
    + `<h2 class="month-name${isCur ? ' is-cur' : ''}">${monthName(ym.month)}${yearTag}</h2>`
    + `<div class="month-grid">${gridCells(ym, habit, today, true)}</div>`
    + `</section>`;
}

export function monthGridsHTML({ months, habit, today }) {
  return months.map((ym) => monthGridHTML({ ym, habit, today })).join('');
}

export function monthViewHTML({ state, id, months, theme }) {
  const h = getHabit(state, id);
  const today = todayStr();
  const navYear = todayYM(today).year;
  const wk = weekdayLabels().map((w) => `<span>${w}</span>`).join('');
  return `
    <header class="nav-bar">
      <button class="nav-back" data-action="open-year" data-id="${h.id}"><span class="chev">‹</span>${navYear}</button>
      <span class="nav-title">${h.emoji ? esc(h.emoji) + ' ' : ''}${esc(h.name)}</span>
      <span class="nav-spacer"></span>
    </header>
    <div class="weekday-row">${wk}</div>
    <div class="month-scroll" id="month-scroll" style="--habit-accent:${accentHex(h, theme)}">${monthGridsHTML({ months, habit: h, today })}</div>`;
}

// ---- year view ----
export function yearBlockHTML({ year, habit, today }) {
  const minis = [];
  for (let m = 0; m < 12; m += 1) {
    const ym = { year, month: m };
    const isCur = ymKey(ym) === today.slice(0, 7);
    minis.push(
      `<button class="ymini${isCur ? ' is-cur' : ''}" data-action="open-month" data-id="${habit.id}" data-year="${year}" data-month="${m}">`
      + `<span class="ymini-label">${monthName(m)}</span>`
      + `<span class="ymini-grid">${gridCells(ym, habit, today, false)}</span>`
      + `</button>`,
    );
  }
  return `<section class="year-block" data-year="${year}">`
    + `<h2 class="year-heading">${year}</h2>`
    + `<div class="year-grid">${minis.join('')}</div>`
    + `</section>`;
}

export function yearBlocksHTML({ years, habit, today }) {
  return years.map((year) => yearBlockHTML({ year, habit, today })).join('');
}

export function yearViewHTML({ state, id, years, theme }) {
  const h = getHabit(state, id);
  const today = todayStr();
  return `
    <header class="nav-bar">
      <button class="nav-back" data-action="back-main"><span class="chev">‹</span>Привычки</button>
      <span class="nav-title">${h.emoji ? esc(h.emoji) + ' ' : ''}${esc(h.name)}</span>
      <span class="nav-spacer"></span>
    </header>
    <div class="year-scroll" id="year-scroll" style="--habit-accent:${accentHex(h, theme)}">${yearBlocksHTML({ years, habit: h, today })}</div>`;
}

// ---- bottom sheet (unchanged behaviour from v1, + grabber) ----
export function sheetHTML({ sheet, state, theme }) {
  const editing = sheet.mode === 'edit';
  const h = editing ? getHabit(state, sheet.id) : null;
  const name = sheet.name !== undefined ? sheet.name : (h ? h.name : '');
  const emoji = sheet.emoji !== undefined ? sheet.emoji : (h ? h.emoji : '');
  const dots = ACCENT_KEYS.map((k) => (
    `<button class="accent-dot${k === sheet.accent ? ' is-on' : ''}" data-action="pick-accent" data-accent="${k}" style="--dot:${ACCENTS[k][theme]}" aria-label="${k}"></button>`
  )).join('');
  return `
    <div class="sheet-backdrop" data-action="cancel-sheet"></div>
    <div class="sheet" role="dialog" aria-modal="true" id="sheet-panel">
      <div class="grabber"></div>
      <h2>${editing ? 'Изменить привычку' : 'Новая привычка'}</h2>
      <label class="field"><span>Название</span>
        <input id="habit-name" type="text" maxlength="40" value="${esc(name)}" placeholder="Например, Читать 20 минут"></label>
      <label class="field"><span>Эмодзи</span>
        <input id="habit-emoji" type="text" maxlength="8" value="${esc(emoji)}" placeholder="необязательно"></label>
      <div class="field"><span>Цвет</span><div class="accent-row">${dots}</div></div>
      <div class="sheet-actions">
        <button class="btn ghost" data-action="cancel-sheet">Отмена</button>
        <button class="btn primary" data-action="save-habit">Сохранить</button>
      </div>
    </div>`;
}

// ---- settings ----
export function settingsHTML({ state }) {
  const cur = state.settings.theme;
  const opts = [['system', 'Система'], ['light', 'Светлая'], ['dark', 'Тёмная']];
  const seg = opts.map(([k, l]) => (
    `<button class="seg-item${k === cur ? ' is-on' : ''}" data-action="set-theme" data-theme="${k}">${l}</button>`
  )).join('');
  return `
    <header class="nav-bar">
      <button class="nav-back" data-action="back-main"><span class="chev">‹</span>Привычки</button>
      <span class="nav-title">Настройки</span>
      <span class="nav-spacer"></span>
    </header>
    <div class="settings-row"><span>Тема</span><div class="segment">${seg}</div></div>`;
}

// ---- context menu ----
export function contextMenuHTML({ habit }) {
  return `
    <div class="ctx-backdrop" data-action="close-context"></div>
    <div class="ctx-sheet">
      <button class="ctx-item" data-action="edit-habit" data-id="${habit.id}">Изменить</button>
      <button class="ctx-item danger" data-action="delete-habit" data-id="${habit.id}">Удалить</button>
    </div>`;
}
```

- [ ] **Step 2: Write `tests/ui.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  esc, mainHTML, monthGridHTML, monthViewHTML, yearBlockHTML, contextMenuHTML,
} from '../js/ui.js';

const habit = (over = {}) => ({
  id: 'h1', name: 'Read', emoji: '📖', accent: 'blue',
  createdAt: '2020-01-01', archived: false, entries: {}, ...over,
});
const stateWith = (h) => ({ version: 1, settings: { theme: 'system' }, habits: [h] });

test('esc escapes the four HTML-significant characters', () => {
  assert.equal(esc('<b>&"x'), '&lt;b&gt;&amp;&quot;x');
});

test('mainHTML escapes a hostile habit name and renders a 3-month strip', () => {
  const html = mainHTML({ state: stateWith(habit({ name: '<script>' })), theme: 'dark' });
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('data-action="open-habit"'));
  assert.equal((html.match(/class="mini-month/g) || []).length, 3);
});

test('mainHTML renders the corrupt-data banner only when state._corrupt is set', () => {
  const base = { version: 1, settings: { theme: 'system' }, habits: [] };
  assert.ok(!mainHTML({ state: base, theme: 'light' }).includes('banner-error'));
  assert.ok(mainHTML({ state: { ...base, _corrupt: true }, theme: 'light' }).includes('banner-error'));
});

test('monthGridHTML: past marked day is a tappable button, future day is inert', () => {
  const html = monthGridHTML({
    ym: { year: 2026, month: 8 },
    habit: habit({ entries: { '2026-09-01': true } }),
    today: '2026-09-15',
  });
  assert.match(html, /<button class="day" data-state="marked" data-action="toggle-day" data-id="h1" data-date="2026-09-01">/);
  assert.match(html, /<span class="day" data-state="future"><span class="dot">20<\/span><\/span>/);
  assert.ok(!html.includes('data-date="2026-09-20"')); // future carries no toggle action
});

test('monthGridHTML: January heading carries the year, other months do not', () => {
  const jan = monthGridHTML({ ym: { year: 2027, month: 0 }, habit: habit(), today: '2026-09-15' });
  const feb = monthGridHTML({ ym: { year: 2027, month: 1 }, habit: habit(), today: '2026-09-15' });
  assert.match(jan, /<h2 class="month-name">Январь 2027<\/h2>/);
  assert.match(feb, /<h2 class="month-name">Февраль<\/h2>/);
});

test('monthViewHTML: nav back button opens the year and sets --habit-accent', () => {
  const html = monthViewHTML({
    state: stateWith(habit()), id: 'h1',
    months: [{ year: 2026, month: 8 }], theme: 'light',
  });
  assert.match(html, /data-action="open-year" data-id="h1"/);
  assert.ok(html.includes('id="month-scroll"'));
  assert.ok(html.includes('--habit-accent:#2F6FEB')); // ACCENTS.blue.light
});

test('yearBlockHTML: 12 month buttons, current month flagged, sticky heading', () => {
  const html = yearBlockHTML({ year: 2026, habit: habit(), today: '2026-09-15' });
  assert.equal((html.match(/class="ymini[ "]/g) || []).length, 12); // 12 month buttons (not the -label/-grid spans)
  assert.match(html, /class="ymini is-cur" data-action="open-month" data-id="h1" data-year="2026" data-month="8"/);
  assert.ok(html.includes('<h2 class="year-heading">2026</h2>'));
});

test('contextMenuHTML wires edit and delete for the habit id', () => {
  const html = contextMenuHTML({ habit: habit() });
  assert.match(html, /data-action="edit-habit" data-id="h1"/);
  assert.match(html, /data-action="delete-habit" data-id="h1"/);
  assert.match(html, /data-action="close-context"/);
});
```

- [ ] **Step 3: Run the new tests to verify they fail**

Run: `node --test tests/ui.test.js`
Expected: FAIL — the current `js/ui.js` exports `listHTML`/`detailHTML`/`heatmapHTML`, not the v2 names, so the imports are `undefined` and the first `mainHTML(...)` call throws `TypeError`.

- [ ] **Step 4: Confirm `js/ui.js` from Step 1 is in place, then run the tests to verify they pass**

Run: `node --test tests/ui.test.js`
Expected: PASS — 8 tests, 0 failures.

- [ ] **Step 5: Run the whole suite**

Run: `node --test`
Expected: PASS — `calendar`, `stats`, `storage`, `heatmap`, `ui`; 0 failures.
(The browser app is now broken — v1 `app.js` imports `listHTML` etc. that no longer exist. Task 4 fixes it. Do not open the browser for this task.)

- [ ] **Step 6: Commit**

```bash
git add js/ui.js tests/ui.test.js
git commit -m "feat: v2 view layer — main strip, month view, year view, context menu

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: v2 controller core (`js/app.js`) — routing, transitions, main + month + settings + sheet

Manual/visual verification. Full rewrite of `js/app.js`. Brings the app back to life. Covers every route rendering, push/pop slide transitions, the main screen, the month screen (scroll-to-current + lazy-extend-upward), settings, the add/edit sheet, theme, and targeted day-toggle. Year-view *interaction* (tap-a-month, lazy-extend) is Task 5; the long-press context menu and sheet swipe-to-dismiss are Task 6 — their markup already renders but does nothing yet.

**Files:**
- Rewrite: `js/app.js`

**Interfaces:**
- Consumes:
  - `loadState`, `saveState`, `createHabit`, `updateHabit`, `deleteHabit`, `toggleEntry`, `setTheme`, `nextAccent`, `getHabit` from `js/storage.js`.
  - `todayStr` from `js/stats.js`.
  - `todayYM`, `listMonths`, `shiftYM`, `ymKey`, `dayState` from `js/calendar.js`.
  - `mainHTML`, `monthViewHTML`, `monthGridsHTML`, `yearViewHTML`, `settingsHTML`, `sheetHTML`, `contextMenuHTML` from `js/ui.js`.
- Produces: module side effects only. Module-level `let` bindings other tasks extend: `state`, `sheet`, `context`, `navDir`, `firstRender`, `monthWindow`, `pendingMonthScroll`, `yearWindow`, `pendingYearScroll`. Functions other tasks call/extend: `parseHash()`, `render(opts)`, `persist()`, `resolvedTheme()`, `scrollIntoContainer(sc, target)`, `wireMonthScroll(sc)`, `ensureMonthWindow(id)`, `ensureYearWindow(id)`, `windowMonths()`, `windowYears()`.
- Transition direction: click handlers set `navDir` (`1` = push / slide in from right, `-1` = pop / slide in from left) right before assigning `location.hash`. The `hashchange` listener reads `navDir` (default `-1` when unset, i.e. browser back/forward). `render({ instant: true })` skips the slide entirely (in-place re-render).
- Click `data-action` cases handled here: `open-habit`, `open-year`, `back-main`, `open-settings`, `toggle-day`, `set-theme`, `add`, `edit-habit`, `pick-accent`, `save-habit`, `cancel-sheet`. Left for Task 5: `open-month`. Left for Task 6: `close-context`, `delete-habit` (+ long-press, sheet swipe).

- [ ] **Step 1: Rewrite `js/app.js`**

```js
import {
  loadState, saveState, createHabit, updateHabit, deleteHabit,
  toggleEntry, setTheme, nextAccent, getHabit,
} from './storage.js';
import { todayStr } from './stats.js';
import { todayYM, listMonths, shiftYM, ymKey, dayState } from './calendar.js';
import {
  mainHTML, monthViewHTML, monthGridsHTML, yearViewHTML,
  settingsHTML, sheetHTML, contextMenuHTML,
} from './ui.js';

const appRoot = document.getElementById('app');
const sheetRoot = document.getElementById('sheet');
const ctxRoot = document.getElementById('context');
const themeMeta = document.querySelector('meta[name="theme-color"]');
const mq = window.matchMedia('(prefers-color-scheme: dark)');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const MONTH_BATCH = 12;

let state = loadState(localStorage);
let sheet = null;               // null | {mode:'add',accent,name?,emoji?} | {mode:'edit',id,accent,name?,emoji?}
let context = null;             // null | habitId  (set by Task 6 long-press)
let firstRender = true;         // first render is instant (no slide)
let navDir = null;              // 1 = push, -1 = pop; set by a click handler before it changes the hash

let monthWindow = null;         // { id, from:{year,month}, to:{year,month} }
let pendingMonthScroll = null;  // {year,month}
let yearWindow = null;          // { id, from:number, to:number }
let pendingYearScroll = null;   // {year,month}  (used by Task 5)

// ---------- routing ----------
function parseHash() {
  const h = location.hash || '#/';
  if (h === '#/settings') return { name: 'settings' };
  let m = h.match(/^#\/h\/([^/]+)\/year$/);
  if (m) return { name: 'year', id: decodeURIComponent(m[1]) };
  m = h.match(/^#\/h\/([^/]+)$/);
  if (m) return { name: 'month', id: decodeURIComponent(m[1]) };
  return { name: 'main' };
}

// ---------- theme ----------
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
  if (state._corrupt) return;
  saveState(localStorage, state);
}

// ---------- render windows ----------
function ensureMonthWindow(id) {
  if (monthWindow && monthWindow.id === id) return;
  const cur = todayYM(todayStr());
  monthWindow = { id, from: shiftYM(cur, -MONTH_BATCH), to: shiftYM(cur, 1) };
}
function ensureYearWindow(id) {
  if (yearWindow && yearWindow.id === id) return;
  const y = todayYM(todayStr()).year;
  yearWindow = { id, from: y - 1, to: y };
}
function windowMonths() {
  return listMonths(monthWindow.from, monthWindow.to);
}
function windowYears() {
  const out = [];
  for (let y = yearWindow.from; y <= yearWindow.to; y += 1) out.push(y);
  return out;
}

// ---------- scrolling ----------
function scrollIntoContainer(sc, target) {
  if (!sc || !target) return;
  sc.scrollTop += target.getBoundingClientRect().top - sc.getBoundingClientRect().top;
}
function wireMonthScroll(sc) {
  if (!sc) return;
  let extending = false;
  sc.addEventListener('scroll', () => {
    if (extending || sc.scrollTop > 160) return;
    extending = true;
    const prevHeight = sc.scrollHeight;
    monthWindow.from = shiftYM(monthWindow.from, -MONTH_BATCH);
    sc.innerHTML = monthGridsHTML({
      months: windowMonths(), habit: getHabit(state, monthWindow.id), today: todayStr(),
    });
    sc.scrollTop += sc.scrollHeight - prevHeight;
    extending = false;
  }, { passive: true });
}

// ---------- view swap with slide transition ----------
function swapView(html, dir) {
  const instant = firstRender || dir === 0 || reduceMotion.matches || !appRoot.firstElementChild;
  if (instant) {
    appRoot.innerHTML = `<div class="view">${html}</div>`;
    return;
  }
  const outgoing = appRoot.firstElementChild;
  const incoming = document.createElement('div');
  incoming.className = `view ${dir > 0 ? 'enter-from-right' : 'enter-from-left'}`;
  incoming.innerHTML = html;
  appRoot.appendChild(incoming);
  void incoming.offsetWidth; // reflow so the enter class is the starting state
  incoming.classList.remove('enter-from-right', 'enter-from-left');
  outgoing.classList.add(dir > 0 ? 'exit-to-left' : 'exit-to-right');
  let done = false;
  const finish = () => { if (!done) { done = true; outgoing.remove(); } };
  incoming.addEventListener('transitionend', finish, { once: true });
  setTimeout(finish, 500);
}

// ---------- render ----------
function render(opts = {}) {
  applyTheme();
  const theme = resolvedTheme();
  const route = parseHash();

  if ((route.name === 'month' || route.name === 'year') && !getHabit(state, route.id)) {
    location.hash = '#/';
    return;
  }

  let html;
  if (route.name === 'month') {
    ensureMonthWindow(route.id);
    html = monthViewHTML({ state, id: route.id, months: windowMonths(), theme });
  } else if (route.name === 'year') {
    ensureYearWindow(route.id);
    html = yearViewHTML({ state, id: route.id, years: windowYears(), theme });
  } else if (route.name === 'settings') {
    html = settingsHTML({ state });
  } else {
    html = mainHTML({ state, theme });
  }

  const dir = opts.instant ? 0 : (opts.dir ?? 1);
  swapView(html, dir);
  firstRender = false;

  const view = appRoot.lastElementChild;
  if (route.name === 'month') {
    const sc = view.querySelector('#month-scroll');
    const targetSel = pendingMonthScroll
      ? `.month[data-ym="${ymKey(pendingMonthScroll)}"]`
      : '.month[data-cur="1"]';
    scrollIntoContainer(sc, sc && sc.querySelector(targetSel));
    pendingMonthScroll = null;
    wireMonthScroll(sc);
  } else if (route.name === 'year') {
    const sc = view.querySelector('#year-scroll');
    scrollIntoContainer(sc, sc && (sc.querySelector('.ymini.is-cur') || sc.querySelector('.year-block')));
    pendingYearScroll = null;
  }

  sheetRoot.innerHTML = sheet ? sheetHTML({ sheet, state, theme }) : '';
  if (sheet) {
    const n = document.getElementById('habit-name');
    if (n) n.focus();
  }
  ctxRoot.innerHTML = context ? contextMenuHTML({ habit: getHabit(state, context) }) : '';
}

// ---------- events ----------
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const d = el.dataset;
  switch (d.action) {
    case 'open-habit':
      navDir = 1;
      location.hash = '#/h/' + encodeURIComponent(d.id);
      break;
    case 'open-year':
      navDir = 1;
      location.hash = '#/h/' + encodeURIComponent(d.id) + '/year';
      break;
    case 'back-main':
      navDir = -1;
      location.hash = '#/';
      break;
    case 'open-settings':
      navDir = 1;
      location.hash = '#/settings';
      break;
    case 'toggle-day': {
      state = toggleEntry(state, d.id, d.date);
      persist();
      const habit = getHabit(state, d.id);
      const st = dayState(d.date, habit.entries, todayStr());
      document.querySelectorAll(`.day[data-date="${d.date}"]`).forEach((cell) => {
        cell.dataset.state = st;
      });
      break;
    }
    case 'set-theme':
      state = setTheme(state, d.theme);
      persist();
      render({ instant: true });
      break;
    case 'add':
      sheet = { mode: 'add', accent: nextAccent(state) };
      render({ instant: true });
      break;
    case 'edit-habit': {
      const h = getHabit(state, d.id);
      context = null;
      sheet = { mode: 'edit', id: d.id, accent: h.accent };
      render({ instant: true });
      break;
    }
    case 'pick-accent': {
      const nameEl = document.getElementById('habit-name');
      const emojiEl = document.getElementById('habit-emoji');
      if (nameEl) sheet.name = nameEl.value;
      if (emojiEl) sheet.emoji = emojiEl.value;
      sheet.accent = d.accent;
      render({ instant: true });
      break;
    }
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
      delete state._corrupt;
      persist();
      render({ instant: true });
      break;
    }
    case 'cancel-sheet':
      sheet = null;
      render({ instant: true });
      break;
    default:
      break;
  }
});

window.addEventListener('hashchange', () => {
  const dir = navDir === null ? -1 : navDir; // untagged hashchange = browser back/forward => pop
  navDir = null;
  render({ dir });
});
mq.addEventListener('change', () => { if (state.settings.theme === 'system') render({ instant: true }); });

render({ instant: true });
```

- [ ] **Step 2: Run the suite (unchanged by this task)**

Run: `node --test`
Expected: PASS — `calendar`, `stats`, `storage`, `heatmap`, `ui`; 0 failures.

- [ ] **Step 3: Verify in a browser**

Run: `python3 -m http.server 8000`, open `http://localhost:8000/`. In DevTools, first unregister any v1 service worker and clear caches (it will otherwise serve stale JS):

```js
navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
caches.keys().then((ks) => ks.forEach((k) => caches.delete(k)));
```

Then seed data with recent dates and reload:

```js
const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const hist = (p, span) => { const e = {}; for (let i = 0; i < span; i++) if (Math.random() < p) e[iso(i)] = true; return e; };
localStorage.setItem('habitTracker.v1', JSON.stringify({
  version: 1, settings: { theme: 'system' }, habits: [
    { id: 'h_a', name: 'Post on Threads', emoji: '🧵', accent: 'blue', createdAt: iso(120), archived: false, entries: hist(0.6, 120) },
    { id: 'h_b', name: 'Cycling', emoji: '🚴', accent: 'pink', createdAt: iso(40), archived: false, entries: hist(0.4, 40) },
  ],
}));
location.reload();
```

Confirm:
- **Main:** each card shows emoji + name + a 3-month strip (previous / current / next); the current month's label is red; today's cell is a red number; marked days are filled circles in the habit's accent; the page does **not** scroll horizontally (check `document.documentElement.scrollWidth === document.documentElement.clientWidth`). No range switcher, no "mark today", no metrics.
- **Open month:** tap a card → the month view slides in from the right; nav bar shows `‹ <year>` (accent) and the habit name; the weekday row `п в с ч п с в` is pinned; the view opens with the **current month** at the top.
- **Toggle:** tap a past day → it toggles between plain and a filled accent circle; tapping today toggles between the red number and an accent circle with a red ring; reload → the change persisted. Tapping a future (dimmed) day does nothing.
- **Lazy extend up:** scroll the month view to the very top → older months appear and the viewport stays put (no jump).
- **Back:** browser back (or edge-swipe) → slides back to the main list.
- **Year (basic):** from the month view tap `‹ <year>` → the year view slides in; 12 mini-months per year, 3 per row, current month's label red, marked days tinted; opens near the current year. (Tapping a mini-month does nothing yet — Task 5.) `‹ Привычки` → back to main.
- **Settings:** gear icon → settings slides in; switching Система/Светлая/Тёмная applies instantly and survives reload; `<meta name="theme-color">` content flips; `--today` stays red in both themes.
- **Add:** FAB → sheet slides up with a grabber; type a name, pick a colour (typed name is retained), Save → new card appears and persists. Empty name → Save is a no-op and refocuses.
- **Reduced motion:** DevTools → Rendering → emulate `prefers-reduced-motion: reduce` → navigations cross-fade instead of sliding.

- [ ] **Step 4: Screenshot the main screen and the month view for the reviewer**

Use the browser screenshot tool on the main list and on an opened month view.

- [ ] **Step 5: Commit**

```bash
git add js/app.js
git commit -m "feat: v2 controller — routing, slide transitions, main + month + settings + sheet

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Year view interaction (`js/app.js`)

Manual/visual verification. Adds tap-a-month navigation from the year view and lazy year-window extension in both scroll directions.

**Files:**
- Modify: `js/app.js`

**Interfaces:**
- Consumes (already available): `yearWindow`, `windowYears()`, `getHabit`, `todayStr`, `pendingMonthScroll`, the `render()` year branch, `scrollIntoContainer`.
- Adds: import `yearBlocksHTML` from `js/ui.js`; function `wireYearScroll(sc)`; `open-month` click case.

- [ ] **Step 1: Add `yearBlocksHTML` to the `ui.js` import in `js/app.js`**

Change the import block:

```js
import {
  mainHTML, monthViewHTML, monthGridsHTML, yearViewHTML, yearBlocksHTML,
  settingsHTML, sheetHTML, contextMenuHTML,
} from './ui.js';
```

- [ ] **Step 2: Add `wireYearScroll` next to `wireMonthScroll` in `js/app.js`**

```js
function wireYearScroll(sc) {
  if (!sc) return;
  let extending = false;
  sc.addEventListener('scroll', () => {
    if (extending) return;
    const nearTop = sc.scrollTop < 200;
    const nearBottom = sc.scrollHeight - sc.scrollTop - sc.clientHeight < 200;
    if (!nearTop && !nearBottom) return;
    extending = true;
    const prevHeight = sc.scrollHeight;
    if (nearTop) yearWindow.from -= 1;
    if (nearBottom) yearWindow.to += 1;
    sc.innerHTML = yearBlocksHTML({
      years: windowYears(), habit: getHabit(state, yearWindow.id), today: todayStr(),
    });
    if (nearTop) sc.scrollTop += sc.scrollHeight - prevHeight;
    extending = false;
  }, { passive: true });
}
```

- [ ] **Step 3: Wire it in the `render()` year branch**

Replace the year branch inside `render()`:

```js
  } else if (route.name === 'year') {
    const sc = view.querySelector('#year-scroll');
    scrollIntoContainer(sc, sc && (sc.querySelector('.ymini.is-cur') || sc.querySelector('.year-block')));
    pendingYearScroll = null;
    wireYearScroll(sc);
  }
```

- [ ] **Step 4: Add the `open-month` click case**

In the `switch (d.action)` block, above `default:`:

```js
    case 'open-month':
      navDir = 1;
      pendingMonthScroll = { year: Number(d.year), month: Number(d.month) };
      location.hash = '#/h/' + encodeURIComponent(d.id);
      break;
```

- [ ] **Step 5: Run the suite (unchanged)**

Run: `node --test`
Expected: PASS — all suites; 0 failures.

- [ ] **Step 6: Verify in a browser**

Run: `python3 -m http.server 8000`, open `http://localhost:8000/` (unregister SW / clear caches as in Task 4 Step 3 if stale). Seed data (Task 4 Step 3 snippet). Then:
- Open a habit → `‹ <year>` → year view. Scroll **down** past December → the next year's blocks appear and scrolling continues smoothly. Scroll **up** past January → previous years appear and the viewport stays anchored (no jump).
- The year heading (`2026`, `2027`, …) stays pinned to the top of the scroll area as you pass each year.
- Tap a mini-month → the month view slides in from the right, scrolled so **that** month is at the top (not today's month).
- From that month view, `‹ <year>` → year view again; `‹ Привычки` → back to main.

- [ ] **Step 7: Screenshot the year view for the reviewer.**

- [ ] **Step 8: Commit**

```bash
git add js/app.js
git commit -m "feat: v2 year view — tap-a-month navigation and lazy year extension

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Long-press context menu + sheet swipe-to-dismiss (`js/app.js`)

Manual/visual verification. Adds the iOS-style long-press context menu on the main card (blurred backdrop, lifted card, «Изменить / Удалить») and swipe-down-to-dismiss for the bottom sheet. Wires the last two `data-action` cases (`close-context`, `delete-habit`).

**Files:**
- Modify: `js/app.js`

**Interfaces:**
- Consumes (already available): `context`, `sheet`, `render()`, `deleteHabit`, `getHabit`, `persist()`, `navDir`, `parseHash()`, `contextMenuHTML` (imported in Task 4).
- Adds: `let suppressNextClick`; functions `markLiftedCard()`, `wireSheetSwipe()`; pointer/scroll listeners for long-press; click cases `close-context`, `delete-habit`; a guard line at the top of the existing click handler; a `wireSheetSwipe()` call and a `markLiftedCard()` call inside `render()`.

- [ ] **Step 1: Add `suppressNextClick` and the long-press guard to the click handler in `js/app.js`**

Add near the other module `let` declarations:

```js
let suppressNextClick = false; // swallow the click that trails a fired long-press
```

Change the first line inside `document.addEventListener('click', (e) => {` from:

```js
  const el = e.target.closest('[data-action]');
```

to:

```js
  if (suppressNextClick) { suppressNextClick = false; return; }
  const el = e.target.closest('[data-action]');
```

- [ ] **Step 2: Add the `close-context` and `delete-habit` cases**

In the `switch (d.action)` block, above `default:`:

```js
    case 'close-context':
      context = null;
      render({ instant: true });
      break;
    case 'delete-habit':
      if (confirm('Удалить привычку и всю её историю?')) {
        state = deleteHabit(state, d.id);
        persist();
      }
      context = null;
      render({ instant: true });
      break;
```

- [ ] **Step 3: Add `markLiftedCard` and `wireSheetSwipe` to `js/app.js`**

Place near the other DOM helpers (e.g. after `wireYearScroll`):

```js
function markLiftedCard() {
  appRoot.querySelectorAll('.card.lifted').forEach((c) => c.classList.remove('lifted'));
  if (context) {
    const c = appRoot.querySelector(`.card[data-id="${context}"]`);
    if (c) c.classList.add('lifted');
  }
}

function wireSheetSwipe() {
  const panel = document.getElementById('sheet-panel');
  if (!panel) return;
  let startY = null;
  let dy = 0;
  panel.addEventListener('pointerdown', (e) => {
    if (e.target.closest('input, button')) return;
    startY = e.clientY;
    dy = 0;
    panel.style.transition = 'none';
  });
  panel.addEventListener('pointermove', (e) => {
    if (startY === null) return;
    dy = Math.max(0, e.clientY - startY);
    panel.style.transform = `translateY(${dy}px)`;
  });
  const end = () => {
    if (startY === null) return;
    panel.style.transition = '';
    panel.style.transform = '';
    const dismiss = dy > panel.offsetHeight * 0.3;
    startY = null;
    dy = 0;
    if (dismiss) { sheet = null; render({ instant: true }); }
  };
  panel.addEventListener('pointerup', end);
  panel.addEventListener('pointercancel', end);
}
```

- [ ] **Step 4: Call the two helpers from `render()`**

Change the sheet block inside `render()` from:

```js
  sheetRoot.innerHTML = sheet ? sheetHTML({ sheet, state, theme }) : '';
  if (sheet) {
    const n = document.getElementById('habit-name');
    if (n) n.focus();
  }
  ctxRoot.innerHTML = context ? contextMenuHTML({ habit: getHabit(state, context) }) : '';
```

to:

```js
  sheetRoot.innerHTML = sheet ? sheetHTML({ sheet, state, theme }) : '';
  if (sheet) {
    const n = document.getElementById('habit-name');
    if (n) n.focus();
    wireSheetSwipe();
  }
  ctxRoot.innerHTML = context ? contextMenuHTML({ habit: getHabit(state, context) }) : '';
  markLiftedCard();
```

- [ ] **Step 5: Add the long-press listeners at the end of `js/app.js`**

Place directly above the final `render({ instant: true });` call:

```js
// ---------- long-press context menu ----------
let lpTimer = null;
let lpStartXY = null;

function clearLongPress() {
  if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; }
  lpStartXY = null;
}

document.addEventListener('pointerdown', (e) => {
  if (sheet || context) return;
  const card = e.target.closest('.card');
  if (!card) return;
  lpStartXY = { x: e.clientX, y: e.clientY };
  const id = card.dataset.id;
  lpTimer = setTimeout(() => {
    lpTimer = null;
    context = id;
    suppressNextClick = true;
    render({ instant: true });
  }, 450);
});
document.addEventListener('pointermove', (e) => {
  if (lpTimer && lpStartXY
    && Math.hypot(e.clientX - lpStartXY.x, e.clientY - lpStartXY.y) > 10) {
    clearLongPress();
  }
});
document.addEventListener('pointerup', clearLongPress);
document.addEventListener('pointercancel', clearLongPress);
document.addEventListener('scroll', clearLongPress, true);
```

- [ ] **Step 6: Run the suite (unchanged)**

Run: `node --test`
Expected: PASS — all suites; 0 failures.

- [ ] **Step 7: Verify in a browser**

Run: `python3 -m http.server 8000`, open `http://localhost:8000/` (clear SW/caches if stale), seed data (Task 4 Step 3). Then:
- **Long-press** a card (hold ~0.5s without moving) → the backdrop blurs, the pressed card lifts (scale + shadow), and a «Изменить / Удалить» menu appears. A normal tap still opens the month view; a press that moves (a scroll) does **not** trigger the menu.
- Tap the blurred backdrop → menu closes, card returns.
- Long-press → «Изменить» → the edit sheet opens pre-filled with that habit; changing the name and saving updates the card.
- Long-press → «Удалить» → native confirm → on OK the card disappears and the menu closes; on Cancel nothing changes and the menu closes.
- Open the add/edit sheet → drag it **down** from the grabber/title area → it follows the finger; release past ~⅓ height → it dismisses; release before that → it snaps back. Dragging from a colour dot or an input does not move the sheet.
- `prefers-reduced-motion: reduce` → the context menu and sheet appear without scale/slide animation.

- [ ] **Step 8: Screenshot the open context menu for the reviewer.**

- [ ] **Step 9: Commit**

```bash
git add js/app.js
git commit -m "feat: v2 long-press context menu and sheet swipe-to-dismiss

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Remove dead v1 logic (`js/heatmap.js`, streak/rate/range in `js/stats.js`)

**Files:**
- Delete: `js/heatmap.js`
- Delete: `tests/heatmap.test.js`
- Rewrite: `js/stats.js`
- Rewrite: `tests/stats.test.js`

**Interfaces:**
- After this task `js/stats.js` exports exactly: `formatDate`, `parseDate`, `todayStr`, `addDays`, `mondayOf`, `enumerateDays`. (`addDays` / `mondayOf` / `enumerateDays` are retained as the general date-primitive toolkit per spec §3.4 even though v2 does not currently call all of them.)
- Removed: `currentStreak`, `longestStreak`, `totalDays`, `completionRate`, `rangeBounds`, `RANGE_WEEKS`, and `buildGrid` / `MONTHS` (whole `heatmap.js`).

- [ ] **Step 1: Confirm nothing still imports the doomed symbols**

Run: `grep -rn "heatmap\|buildGrid\|currentStreak\|longestStreak\|totalDays\|completionRate\|rangeBounds\|RANGE_WEEKS" js/ tests/ index.html sw.js`
Expected: matches **only** inside `js/heatmap.js`, `tests/heatmap.test.js`, and `sw.js` (the `./js/heatmap.js` line in `ASSETS`, fixed in Task 8). If any match is in `js/ui.js`, `js/app.js`, or another live file, STOP — a prior task left a reference; report it.

- [ ] **Step 2: Delete the heatmap files**

```bash
git rm js/heatmap.js tests/heatmap.test.js
```

- [ ] **Step 3: Rewrite `js/stats.js`**

```js
// Pure date helpers. No DOM, no localStorage. Dates are local "YYYY-MM-DD"
// strings built from Date components; string comparison is a valid
// chronological compare.

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
```

- [ ] **Step 4: Rewrite `tests/stats.test.js`**

```js
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
```

- [ ] **Step 5: Run the whole suite**

Run: `node --test`
Expected: PASS — `calendar`, `stats` (4 tests), `storage`, `ui`; **no** `heatmap` suite; 0 failures.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: drop v1 heatmap module and unused streak/rate/range helpers

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: Service worker cache bump + README + acceptance pass

**Files:**
- Rewrite: `sw.js`
- Check: `README.md`

- [ ] **Step 1: Rewrite `sw.js`**

```js
const CACHE = 'habits-cache-v2';
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
  './js/calendar.js',
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
    e.respondWith(
      fetch(request)
        .then((r) => {
          if (r.ok) {
            const copy = r.clone();
            caches.open(CACHE).then((c) => c.put('./index.html', copy)).catch(() => {});
          }
          return r;
        })
        .catch(() => caches.match('./index.html')),
    );
    return;
  }
  e.respondWith(caches.match(request).then((r) => r || fetch(request)));
});
```

- [ ] **Step 2: Check `README.md`**

Open `README.md`. Confirm it has a "Deploying an update" section that tells the maintainer to bump the `CACHE` constant in `sw.js` on each deploy. It should already exist from v1. If it is missing or no longer accurate, set that section to:

```markdown
## Deploying an update

The service worker caches all assets. After changing any file, bump the
`CACHE` constant in `sw.js` (e.g. `habits-cache-v3`) and redeploy — the old
cache is purged on the next launch. The page shell itself is fetched
network-first, so HTML/routing changes show up on the next online launch even
without a bump; JS/CSS/icon changes need the bump.
```

- [ ] **Step 3: Run the whole suite**

Run: `node --test`
Expected: PASS — `calendar`, `stats`, `storage`, `ui`; 0 failures.

- [ ] **Step 4: Full manual acceptance (spec §6.4)**

Serve with `python3 -m http.server 8000`. In DevTools, unregister the SW and clear Cache Storage once, then hard-reload so the v2 SW installs. Seed the two-habit fixture from Task 4 Step 3. Verify each:

1. Main: each habit shows exactly 3 months (prev / current / next); no horizontal page scroll at 375pt (`document.documentElement.scrollWidth === clientWidth`); today is a red number; marked days are habit-colour circles.
2. Tap a card → month view slides in, opened at the current month; nav shows `‹ <year>` + habit name.
3. Month view: scroll to top loads older months without a jump; tapping a past day toggles a circle and survives reload; tapping a future day does nothing.
4. Month view shows no metrics anywhere.
5. `‹ <year>` → year view; scroll down past December continues into the next year, scroll up loads past years; the year heading stays pinned.
6. Tap a mini-month in the year view → month view opened at that month.
7. `‹ Привычки` from the year view → main.
8. Long-press a card → blurred menu with a lifted card; «Изменить» opens the pre-filled sheet; «Удалить» (after confirm) removes the habit.
9. Sheet: grabber, slides up from the bottom, swipe-down dismisses; adding a habit works; picking a colour after typing a name keeps the name.
10. Settings: Система / Светлая / Тёмная apply instantly and survive reload; `--today` is red in both themes.
11. Screen transitions slide (push/pop); with `prefers-reduced-motion: reduce` they cross-fade.
12. Offline (DevTools offline, or Airplane Mode from the home screen): the app opens and marks still save; Cache Storage shows only `habits-cache-v2` (the v1 cache is gone).
13. Served from a `/subdir/` path locally → all assets and the SW load (relative paths).

Record PASS/FAIL + one observation per item. Fix any FAIL in its owning module, re-run `node --test`, re-verify. If a failure needs a judgement call or contradicts the spec, STOP and report instead of guessing.

- [ ] **Step 5: Screenshot the final main screen (light and dark) for the reviewer.**

- [ ] **Step 6: Commit**

```bash
git add sw.js README.md
git commit -m "feat: bump service worker cache to v2 for the calendar rewrite

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review (completed while writing)

**Spec coverage**

| Spec section | Task(s) |
|---|---|
| §1 pts 1–7 (no h-scroll, 3-month main, tap→month, zoom→year, no switchers, no metrics, native feel) | 2 (CSS), 3 (view), 4–6 (controller) |
| §2.1 main screen (3-month strip, today red, long-press menu, FAB, empty state) | 3 (`mainHTML`), 4 (FAB/open), 6 (long-press) |
| §2.2 month view (nav `‹ year`, sticky weekday row, continuous scroll, open at current, lazy up, tap toggle, no metrics) | 3 (`monthViewHTML`), 4 (scroll/lazy/toggle) |
| §2.3 year view (nav `‹ Привычки`, continuous scroll across years, sticky year heading, 12 minis ×3, tap→month) | 3 (`yearViewHTML`), 4 (render/scroll), 5 (lazy both ways + `open-month`) |
| §2.4 settings (theme segment) | 3 (`settingsHTML`), 4 (`set-theme`) |
| §2.5 transition map (push/pop directions) | 4 (`navDir` model) |
| §3.1 data model unchanged; `createdAt` no longer gates marking; `_corrupt` banner + `persist` guard retained | 3 (`dayCell` uses `dayState`, no `createdAt` check; `mainHTML` renders `.banner-error` on `state._corrupt`), 2 (`.banner-error` CSS), 4 (`persist` guard, `delete state._corrupt` on save) |
| §3.2 day states (future/today/marked/marked-today/plain) | 1 (`dayState`), 2 (`.day[data-state]` CSS), 3 (`dayCell`) |
| §3.3 `calendar.js` API | 1 |
| §3.4 trim `stats.js` | 7 |
| §3.5 delete `heatmap.js` | 7 |
| §4 file structure | all |
| §5.1 slide transitions + reduced-motion | 2 (CSS), 4 (`swapView`) |
| §5.2 press states, ≥44pt targets | 2 (CSS `:active`, `.month-grid .day{min-height:44px}`) |
| §5.3 sheet (grabber, slide-up, swipe-down, backdrop) | 2 (CSS), 3 (`sheetHTML` grabber), 6 (`wireSheetSwipe`) |
| §5.4 context menu (blur, lift, list, close) | 2 (CSS `.ctx-*`, `.card.lifted`), 3 (`contextMenuHTML`), 6 (long-press + `markLiftedCard`) |
| §5.5 momentum scroll, no h-scroll | 2 (`-webkit-overflow-scrolling`, `overflow-x` via `minmax(0,1fr)` + `html{overflow:hidden}`) |
| §5.6 tokens + `--today` in both dark blocks | 2 |
| §6.1 `calendar.test.js` cases | 1 |
| §6.2 trimmed `stats.test.js` | 7 |
| §6.3 `storage.test.js` untouched | — (no task modifies it) |
| §6.4 acceptance checklist | 8 |
| §7 open items (mini-cell sizing, card-lift approach, scroll compensation, sheet fling threshold) | resolved in-plan: mini cell 15px / year cell 11px (Task 2); lift = `.card.lifted` class, no clone (Task 6); `scrollTop += scrollHeight delta` compensation (Tasks 4–5); dismiss at 30% panel height (Task 6) |

**Placeholder scan:** none. Every code step carries a full file or a full function/case with exact surrounding context and the exact line to change.

**Type consistency:**
- `calendar.js` exports (`monthMatrix`, `monthName`, `weekdayLabels`, `ymKey`, `shiftYM`, `todayYM`, `listMonths`, `dayState`, `MONTH_NAMES`) — consumed with matching names/arity in `ui.js` (Task 3) and `app.js` (Task 4).
- `ui.js` screen functions all take a single options object; `dayCell`/`gridCells` are private positional helpers. `app.js` calls `monthViewHTML({state,id,months,theme})`, `yearViewHTML({state,id,years,theme})`, `monthGridsHTML({months,habit,today})`, `yearBlocksHTML({years,habit,today})`, `sheetHTML({sheet,state,theme})`, `settingsHTML({state})`, `contextMenuHTML({habit})`, `mainHTML({state,theme})` — all matching Task 3 signatures.
- `dayState` return strings (`future|today|marked|marked-today|plain`) match the CSS `[data-state="…"]` selectors in Task 2 and the `dayCell` interactive guard (`st !== 'future'`).
- `data-action` values emitted by Task 3 markup (`open-habit`, `open-settings`, `add`, `toggle-day`, `open-year`, `back-main`, `open-month`, `edit-habit`, `delete-habit`, `close-context`, `pick-accent`, `save-habit`, `cancel-sheet`, `set-theme`) each have a handler by Task 6 (`open-month` by Task 5; the rest by Task 4 or Task 6).
- `monthWindow` / `yearWindow` shape `{ id, from, to }` written by `ensureMonthWindow`/`ensureYearWindow` (Task 4) and read by `windowMonths`/`windowYears` (Task 4) and the lazy-extend handlers (Tasks 4–5).
- `navDir` (`1|-1|null`) set by click handlers, read once by the `hashchange` listener, then nulled — consistent across Tasks 4–6.

