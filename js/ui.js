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
