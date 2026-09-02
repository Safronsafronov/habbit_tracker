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
