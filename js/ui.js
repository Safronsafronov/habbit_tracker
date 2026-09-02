import {
  rangeBounds, todayStr, currentStreak, longestStreak,
  totalDays, completionRate, parseDate,
} from './stats.js';
import { buildGrid } from './heatmap.js';
import { ACCENTS, ACCENT_KEYS } from './accents.js';

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

export function sheetHTML({ sheet, state, theme }) {
  const editing = sheet.mode === 'edit';
  const h = editing ? state.habits.find((x) => x.id === sheet.id) : null;
  const name = sheet.name !== undefined ? sheet.name : (h ? h.name : '');
  const emoji = sheet.emoji !== undefined ? sheet.emoji : (h ? h.emoji : '');

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
