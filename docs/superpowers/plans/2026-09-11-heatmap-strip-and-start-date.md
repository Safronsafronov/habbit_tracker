# Heatmap Strip + Start Date Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 3-mini-month strip on each habit card with a horizontally-scrollable 365-day heatmap, add a round "mark today" button to the card, and add an editable "Start date" field to the add/edit sheet.

**Architecture:** New pure module `js/heat.js` computes the 365-day grid (7 rows × ~53 columns); `js/ui.js` renders it and the check button; `js/app.js` wires the new `toggle-today` action and reads the start-date field; `js/storage.js` accepts `createdAt` in `createHabit`. Month/year screens, routing, sheet swipe, and settings are untouched.

**Tech Stack:** Vanilla JS ES modules, `node --test`, no build step.

## Global Constraints

- No new dependencies; static site, `localStorage` only.
- `.heat-scroll` is the only element with horizontal scroll; no other horizontal scroll anywhere.
- Start date is informational only — never gates which days can be marked.
- Bump `CACHE` in `sw.js` on completion (per README "Deploying an update").

---

### Task 1: `js/heat.js` — 365-day grid + tests

**Files:**
- Create: `js/heat.js`
- Test: `tests/heat.test.js`

**Interfaces:**
- Consumes: `addDays(str, n)` from `js/stats.js` (existing, `(dateStr, n) => "YYYY-MM-DD"`).
- Produces: `heatWeeks(todayStr)` — `(string) => Array<Array<string|null>>`, outer array = weeks (columns, oldest→newest), inner array = 7 entries Mon(0)…Sun(6), `null` for padding.

- [ ] **Step 1: Write the failing tests**

```js
// tests/heat.test.js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/heat.test.js`
Expected: FAIL — `Cannot find module '../js/heat.js'`

- [ ] **Step 3: Implement `js/heat.js`**

```js
// Pure heatmap-grid helper. No DOM. Dates are local "YYYY-MM-DD" strings.
import { addDays } from './stats.js';

function weekdayMon0(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return (new Date(y, m - 1, d).getDay() + 6) % 7; // Mon=0 … Sun=6
}

export function heatWeeks(todayStr) {
  const days = [];
  for (let i = 364; i >= 0; i -= 1) days.push(addDays(todayStr, -i));
  const lead = weekdayMon0(days[0]);
  const cells = [...Array(lead).fill(null), ...days];
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) {
    const week = cells.slice(i, i + 7);
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/heat.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add js/heat.js tests/heat.test.js
git commit -m "feat: pure 365-day heatmap grid module"
```

---

### Task 2: `js/storage.js` — `createHabit` accepts `createdAt`

**Files:**
- Modify: `js/storage.js:59-70`
- Test: `tests/storage.test.js`

**Interfaces:**
- Produces: `createHabit(state, { name, emoji, accent, createdAt })` — `createdAt` optional `"YYYY-MM-DD"`; falls back to `todayStr()` when falsy. Return shape unchanged (`{ state, habit }`).

- [ ] **Step 1: Write the failing test**

Add to `tests/storage.test.js`:

```js
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
```

(Add matching imports at the top if `createHabit`, `makeDefaultState`, `todayStr` aren't already imported in the file — check existing imports first and extend, don't duplicate.)

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/storage.test.js`
Expected: FAIL — first test: `habit.createdAt` is `todayStr()` not `'2026-01-15'`.

- [ ] **Step 3: Update `createHabit`**

In `js/storage.js`, change:

```js
export function createHabit(state, { name, emoji, accent, createdAt }) {
  const habit = {
    id: genId(),
    name: name.trim().slice(0, 40),
    emoji: emoji || '',
    accent: accent || nextAccent(state),
    createdAt: createdAt || todayStr(),
    archived: false,
    entries: {},
  };
  return { state: { ...state, habits: [...state.habits, habit] }, habit };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/storage.test.js`
Expected: PASS, all existing storage tests still green.

- [ ] **Step 5: Commit**

```bash
git add js/storage.js tests/storage.test.js
git commit -m "feat: createHabit accepts an explicit createdAt"
```

---

### Task 3: `js/ui.js` — heat strip, check button, start-date field

**Files:**
- Modify: `js/ui.js` (imports at top; `mainHTML` §main screen; `sheetHTML` §139-153)

**Interfaces:**
- Consumes: `heatWeeks(todayStr)` from `js/heat.js` (Task 1); `dayState` from `js/calendar.js` (existing); `todayStr` from `js/stats.js` (existing, already imported).
- Produces: `heatStripHTML({ habit, today })` — returns the `.heat-scroll` markup string, used by `mainHTML`. Each cell: `<span class="heat-day" data-state="<state>" data-date="<YYYY-MM-DD>">` (or `class="heat-day pad"` with no data attrs). Card markup gains `<button class="check-btn" data-action="toggle-today" data-id="<id>" data-state="on|off">`. Sheet gains `<input id="habit-start" type="date">`.

- [ ] **Step 1: Add the heat-strip renderer**

At the top of `js/ui.js`, add the import:

```js
import { heatWeeks } from './heat.js';
```

After the existing `gridCells` function, add:

```js
function heatDayCell(dateStr, habit, today) {
  if (!dateStr) return '<span class="heat-day pad"></span>';
  const st = dayState(dateStr, habit.entries, today);
  return `<span class="heat-day" data-state="${st}" data-date="${dateStr}"></span>`;
}

export function heatStripHTML({ habit, today }) {
  const cells = heatWeeks(today).flat().map((d) => heatDayCell(d, habit, today)).join('');
  return `<div class="heat-scroll"><div class="heat-grid">${cells}</div></div>`;
}
```

- [ ] **Step 2: Replace the main-screen card body**

In `mainHTML`, replace:

```js
  const cur = todayYM(today);
  const strip = [shiftYM(cur, -1), cur, shiftYM(cur, 1)];
  const cards = state.habits.map((h) => (
    `<div class="card" data-action="open-habit" data-id="${h.id}" style="--habit-accent:${accentHex(h, theme)}">`
    + `<div class="card-head"><span class="card-emoji">${esc(h.emoji || '•')}</span>`
    + `<span class="card-title">${esc(h.name)}</span></div>`
    + `<div class="strip">${strip.map((ym) => miniMonthHTML({ ym, habit: h, today })).join('')}</div>`
    + `</div>`
  )).join('');
```

with:

```js
  const cards = state.habits.map((h) => {
    const todayOn = dayState(today, h.entries, today) === 'marked-today';
    return `<div class="card" data-action="open-habit" data-id="${h.id}" style="--habit-accent:${accentHex(h, theme)}">`
      + `<div class="card-head"><span class="card-emoji">${esc(h.emoji || '•')}</span>`
      + `<span class="card-title">${esc(h.name)}</span>`
      + `<button class="check-btn" data-action="toggle-today" data-id="${h.id}" data-state="${todayOn ? 'on' : 'off'}" aria-label="Отметить сегодня">${todayOn ? '✓' : ''}</button></div>`
      + `${heatStripHTML({ habit: h, today })}`
      + `</div>`;
  }).join('');
```

`todayYM`/`shiftYM`/`miniMonthHTML` become unused in `mainHTML` — leave the `miniMonthHTML` function itself alone (still used nowhere else, but removing it is a separate cleanup call; per project convention, only remove what your own change makes dead **in this file's exports it's now unused**, so delete the `miniMonthHTML` function body and its now-unused `ymKey`/`shiftYM`-only-for-strip usage if no longer referenced anywhere else in the file). Check with:

```bash
grep -n "miniMonthHTML\|shiftYM\|todayYM" js/ui.js js/app.js
```

If `miniMonthHTML` has no remaining callers, delete its function definition; if `shiftYM`/`todayYM` imports become unused in `js/ui.js`, remove them from the import line (keep them if `app.js` still needs its own copies — this only concerns `js/ui.js`'s import list).

- [ ] **Step 3: Add the start-date field to the sheet**

In `sheetHTML`, after the `name`/`emoji` reads, add:

```js
  const start = sheet.start !== undefined ? sheet.start : (h ? h.createdAt : todayStr());
```

Then in the returned markup, insert a new field between «Название» and «Эмодзи»:

```html
      <label class="field"><span>Дата начала</span>
        <input id="habit-start" type="date" max="${todayStr()}" value="${esc(start)}"></label>
```

- [ ] **Step 4: Manually sanity-check the module loads**

Run: `node --check js/ui.js`
Expected: no output (syntax OK). Full behavioral check happens in Task 4/5 once `app.js` wires the new markup.

- [ ] **Step 5: Commit**

```bash
git add js/ui.js
git commit -m "feat: render 365-day heat strip, check button, and start-date field"
```

---

### Task 4: `js/app.js` — `toggle-today`, start-date handling, scroll-to-today

**Files:**
- Modify: `js/app.js` (imports; `case 'toggle-day'` area for the new `toggle-today` case; `pick-accent`/`save-habit` cases; `render()` main-screen branch)

**Interfaces:**
- Consumes: `heatStripHTML`/card markup from Task 3 (`.check-btn[data-action="toggle-today"]`, `.heat-day[data-date]`, `#habit-start`); `createHabit(state, { name, emoji, accent, createdAt })` from Task 2.

- [ ] **Step 1: Add the `toggle-today` action**

In `js/app.js`, right after the existing `case 'toggle-day': { ... break; }` block, add:

```js
    case 'toggle-today': {
      const today = todayStr();
      state = toggleEntry(state, d.id, today);
      persist();
      const habit = getHabit(state, d.id);
      const st = dayState(today, habit.entries, today);
      const card = appRoot.querySelector(`.card[data-id="${d.id}"]`);
      if (card) {
        const btn = card.querySelector('.check-btn');
        if (btn) {
          btn.dataset.state = st === 'marked-today' ? 'on' : 'off';
          btn.textContent = st === 'marked-today' ? '✓' : '';
        }
        const cell = card.querySelector(`.heat-day[data-date="${today}"]`);
        if (cell) cell.dataset.state = st;
      }
      break;
    }
```

- [ ] **Step 2: Carry `habit-start` through `pick-accent`**

In `case 'pick-accent'`, alongside the existing `nameEl`/`emojiEl` reads, add:

```js
      const startEl = document.getElementById('habit-start');
      if (startEl) sheet.start = startEl.value;
```

- [ ] **Step 3: Normalize and save `createdAt` in `save-habit`**

Add a helper near the top of `js/app.js` (below the other module-level `let`/`const` declarations, before `render`):

```js
function normalizeStart(value) {
  const today = todayStr();
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value <= today ? value : today;
}
```

In `case 'save-habit'`, after reading `emoji`, add:

```js
      const createdAt = normalizeStart(document.getElementById('habit-start').value);
```

Then change the two calls to pass it through:

```js
      if (sheet.mode === 'add') {
        state = createHabit(state, { name, emoji, accent: sheet.accent, createdAt }).state;
      } else {
        state = updateHabit(state, sheet.id, { name, emoji, accent: sheet.accent, createdAt });
      }
```

- [ ] **Step 4: Scroll each heat strip to today on main-screen render**

In `render()`, the block that currently does:

```js
  } else if (route.name === 'year') {
    const sc = view.querySelector('#year-scroll');
    scrollIntoContainer(sc, sc && (sc.querySelector('.ymini.is-cur') || sc.querySelector('.year-block')));
    pendingYearScroll = null;
    wireYearScroll(sc);
  }
```

gets a new branch appended after it:

```js
  } else if (route.name === 'main') {
    view.querySelectorAll('.heat-scroll').forEach((sc) => { sc.scrollLeft = sc.scrollWidth; });
  }
```

- [ ] **Step 5: Manual smoke test**

Run: `python3 -m http.server 8000` (from repo root), open `http://localhost:8000/`.
Expected: main screen shows the heat strip per habit, scrolled to today at the right edge; tapping the round button toggles today's cell and the button fill; tapping elsewhere on a card still opens the month screen; the add-habit sheet shows a "Дата начала" date field defaulting to today.

- [ ] **Step 6: Run the full test suite**

Run: `node --test`
Expected: all tests pass (existing + Task 1/2 additions).

- [ ] **Step 7: Commit**

```bash
git add js/app.js
git commit -m "feat: wire toggle-today, start-date save, and heat-strip scroll"
```

---

### Task 5: `styles.css` — heat strip, check button, remove orphaned mini-month styles

**Files:**
- Modify: `styles.css` (`.card-head`/`.strip`/`.mini-month`/`.mini-label`/`.mini-grid` block around line 120-132)

**Interfaces:**
- Consumes: `--habit-accent` (existing custom property, set inline per card); `--today`, `--r-btn`, `--ease-ios` tokens (existing).
- Produces: CSS classes `.check-btn`, `.heat-scroll`, `.heat-grid`, `.heat-day` (and its `[data-state]` variants), consumed by the markup from Task 3.

- [ ] **Step 1: Confirm `.mini-month`/`.strip`/`.mini-grid`/`.mini-label` are only used by the old main-screen markup**

Run:

```bash
grep -rn "mini-month\|mini-label\|mini-grid\|class=\"strip\"" js/ index.html
```

Expected: no remaining references after Task 3's edit (the year screen uses `.ymini*` classes, which are separate and must stay).

- [ ] **Step 2: Replace the CSS block**

Replace:

```css
.card-head { display:flex; align-items:center; gap:8px; margin-bottom:10px; }
.card-emoji { font-size:17px; }
.card-title { flex:1; font-size:15px; font-weight:600; letter-spacing:-.01em;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.strip { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:10px; }
.mini-month { min-width:0; }
.mini-label { font-size:11px; font-weight:600; color:var(--text-secondary); margin-bottom:4px; }
.mini-month.is-cur .mini-label { color:var(--today); }
.mini-grid { display:grid; grid-template-columns:repeat(7, minmax(0,1fr)); gap:2px; }
.mini-grid .day { aspect-ratio:1; }
/* small rounded squares that fill their cell — no overlap at any width */
.mini-grid .day .dot { width:100%; height:100%; border-radius:3px; font-size:8px; }
.mini-grid .day[data-state="marked-today"] .dot { box-shadow:inset 0 0 0 1.5px var(--today); }
```

with:

```css
.card-head { display:flex; align-items:center; gap:8px; margin-bottom:10px; }
.card-emoji { font-size:17px; }
.card-title { flex:1; font-size:15px; font-weight:600; letter-spacing:-.01em;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.check-btn {
  width:28px; height:28px; border-radius:50%; flex-shrink:0;
  display:grid; place-items:center; padding:0;
  border:1.5px solid var(--habit-accent); background:transparent;
  color:#fff; font-size:14px; font-weight:700; font-family:inherit;
  -webkit-tap-highlight-color:transparent;
  transition:transform .09s var(--ease-ios), background .12s var(--ease-ios);
}
.check-btn[data-state="on"] { background:var(--habit-accent); }
.check-btn:active { transform:scale(.86); }
.heat-scroll { overflow-x:auto; -webkit-overflow-scrolling:touch; overscroll-behavior:contain; }
.heat-scroll::-webkit-scrollbar { display:none; }
.heat-grid {
  display:grid; grid-auto-flow:column;
  grid-template-rows:repeat(7, 12px); grid-auto-columns:12px; gap:3px;
  width:max-content;
}
.heat-day { width:12px; height:12px; border-radius:3px; background:var(--surface-sunken); }
.heat-day.pad { visibility:hidden; }
.heat-day[data-state="plain"], .heat-day[data-state="today"] {
  background:color-mix(in srgb, var(--habit-accent) 16%, var(--surface-sunken));
}
.heat-day[data-state="today"] { box-shadow:inset 0 0 0 1.5px var(--today); }
.heat-day[data-state="marked"], .heat-day[data-state="marked-today"] { background:var(--habit-accent); }
.heat-day[data-state="marked-today"] { box-shadow:inset 0 0 0 1.5px var(--today); }
```

- [ ] **Step 3: Visual check**

Run: `python3 -m http.server 8000`, open `http://localhost:8000/` in a 375px-wide viewport (Safari/Chrome device toolbar), toggle light/dark.
Expected: strip scrolls horizontally, today's cell is visibly ringed, marked days are filled with the habit's accent color in both themes, check button matches habit accent and fills solid when today is marked.

- [ ] **Step 4: Commit**

```bash
git add styles.css
git commit -m "style: heat-strip grid and check button; drop orphaned mini-month styles"
```

---

### Task 6: Bump service worker cache + full regression pass

**Files:**
- Modify: `sw.js:1`

**Interfaces:** none (terminal task).

- [ ] **Step 1: Bump the cache version**

In `sw.js`, change:

```js
const CACHE = 'habits-cache-v2';
```

to:

```js
const CACHE = 'habits-cache-v3';
```

- [ ] **Step 2: Run the full automated test suite**

Run: `node --test`
Expected: all tests pass, including `tests/heat.test.js` and the updated `tests/storage.test.js`.

- [ ] **Step 3: Run the manual acceptance checklist**

Walk through the checklist in `docs/superpowers/specs/2026-09-11-heatmap-strip-and-start-date.md` §7 (items 1–10) against `http://localhost:8000/`, including an offline reload (DevTools → Network → Offline, then reload) to confirm the bumped cache serves the app.

- [ ] **Step 4: Commit**

```bash
git add sw.js
git commit -m "feat: bump service worker cache to v3 for the heatmap-strip rewrite"
```
