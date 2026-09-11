import {
  loadState, saveState, createHabit, updateHabit, deleteHabit,
  toggleEntry, setTheme, nextAccent, getHabit,
} from './storage.js';
import { todayStr } from './stats.js';
import { todayYM, listMonths, shiftYM, dayState } from './calendar.js';
import {
  mainHTML, monthViewHTML, monthGridsHTML,
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
let sheet = null;               // null | {mode:'add',accent,name?,emoji?,start?} | {mode:'edit',id,accent,name?,emoji?,start?}
let context = null;             // null | habitId  (set by Task 6 long-press)
let suppressNextClick = false; // swallow the click that trails a fired long-press
let firstRender = true;         // first render is instant (no slide)
let navDir = null;              // 1 = push, -1 = pop; set by a click handler before it changes the hash

let monthWindow = null;         // { id, from:{year,month}, to:{year,month} }

function normalizeStart(value) {
  const today = todayStr();
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value <= today ? value : today;
}

// ---------- routing ----------
function parseHash() {
  const h = location.hash || '#/';
  if (h === '#/settings') return { name: 'settings' };
  const m = h.match(/^#\/h\/([^/]+)$/);
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
function windowMonths() {
  return listMonths(monthWindow.from, monthWindow.to);
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

  if (route.name === 'month' && !getHabit(state, route.id)) {
    location.hash = '#/';
    return;
  }

  let html;
  if (route.name === 'month') {
    ensureMonthWindow(route.id);
    html = monthViewHTML({ state, id: route.id, months: windowMonths(), theme });
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
    scrollIntoContainer(sc, sc && sc.querySelector('.month[data-cur="1"]'));
    wireMonthScroll(sc);
  } else if (route.name === 'main') {
    view.querySelectorAll('.heat-scroll').forEach((sc) => { sc.scrollLeft = sc.scrollWidth; });
  }

  sheetRoot.innerHTML = sheet ? sheetHTML({ sheet, state, theme }) : '';
  if (sheet) {
    const n = document.getElementById('habit-name');
    if (n) n.focus();
    wireSheetSwipe();
  }
  ctxRoot.innerHTML = context ? contextMenuHTML({ habit: getHabit(state, context) }) : '';
  markLiftedCard();
}

// ---------- events ----------
document.addEventListener('click', (e) => {
  if (suppressNextClick) { suppressNextClick = false; return; }
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const d = el.dataset;
  switch (d.action) {
    case 'open-habit':
      navDir = 1;
      location.hash = '#/h/' + encodeURIComponent(d.id);
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
      const startEl = document.getElementById('habit-start');
      if (startEl) sheet.start = startEl.value;
      sheet.accent = d.accent;
      render({ instant: true });
      break;
    }
    case 'save-habit': {
      const nameEl = document.getElementById('habit-name');
      const name = nameEl.value.trim();
      if (!name) { nameEl.focus(); return; }
      const emoji = document.getElementById('habit-emoji').value.trim();
      const createdAt = normalizeStart(document.getElementById('habit-start').value);
      if (sheet.mode === 'add') {
        state = createHabit(state, { name, emoji, accent: sheet.accent, createdAt }).state;
      } else {
        state = updateHabit(state, sheet.id, { name, emoji, accent: sheet.accent, createdAt });
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
  if (e.target.closest('input, button')) return;
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

render({ instant: true });
