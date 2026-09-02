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
    case 'add':
      sheet = { mode: 'add', accent: nextAccent(state) };
      render();
      break;
    case 'edit-habit':
      sheet = { mode: 'edit', id: d.id, accent: getHabit(state, d.id).accent };
      render();
      break;
    case 'pick-accent': {
      const n = document.getElementById('habit-name');
      const em = document.getElementById('habit-emoji');
      if (n) sheet.name = n.value;
      if (em) sheet.emoji = em.value;
      sheet.accent = d.accent;
      render();
      break;
    }
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
    case 'set-theme':
      state = setTheme(state, d.theme);
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
