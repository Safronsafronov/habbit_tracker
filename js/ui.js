import { ACCENTS, ACCENT_KEYS } from './accents.js';
import { todayStr } from './stats.js';
import {
  monthMatrix, monthName, weekdayLabels, dayState, ymKey, todayYM,
} from './calendar.js';
import { getHabit } from './storage.js';
import { heatWeeks } from './heat.js';

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

function heatDayCell(dateStr, habit, today) {
  if (!dateStr) return '<span class="heat-day pad"></span>';
  const st = dayState(dateStr, habit.entries, today);
  return `<span class="heat-day" data-state="${st}" data-date="${dateStr}"></span>`;
}

export function heatStripHTML({ habit, today, weeks }) {
  const cells = (weeks ?? heatWeeks(today)).flat().map((d) => heatDayCell(d, habit, today)).join('');
  return `<div class="heat-scroll"><div class="heat-grid">${cells}</div></div>`;
}

// ---- main screen ----
export function mainHTML({ state, theme }) {
  const today = todayStr();
  const weeks = heatWeeks(today);
  const cards = state.habits.map((h) => {
    const todayOn = dayState(today, h.entries, today) === 'marked-today';
    return `<div class="card" data-action="open-habit" data-id="${h.id}" style="--habit-accent:${accentHex(h, theme)}">`
      + `<div class="card-head"><span class="card-emoji">${esc(h.emoji || '•')}</span>`
      + `<span class="card-title">${esc(h.name)}</span>`
      + `<button class="check-btn" data-action="toggle-today" data-id="${h.id}" data-state="${todayOn ? 'on' : 'off'}" aria-label="Отметить сегодня">${todayOn ? '✓' : ''}</button></div>`
      + `${heatStripHTML({ habit: h, today, weeks })}`
      + `</div>`;
  }).join('');
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
  const start = sheet.start !== undefined ? sheet.start : (h ? h.createdAt : todayStr());
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
      <label class="field"><span>Дата начала</span>
        <input id="habit-start" type="date" max="${todayStr()}" value="${esc(start)}"></label>
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
