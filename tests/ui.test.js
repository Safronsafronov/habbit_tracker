import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  esc, mainHTML, monthGridHTML, monthViewHTML, contextMenuHTML,
} from '../js/ui.js';

const habit = (over = {}) => ({
  id: 'h1', name: 'Read', emoji: '📖', accent: 'blue',
  createdAt: '2020-01-01', archived: false, entries: {}, ...over,
});
const stateWith = (h) => ({ version: 1, settings: { theme: 'system' }, habits: [h] });

test('esc escapes the four HTML-significant characters', () => {
  assert.equal(esc('<b>&"x'), '&lt;b&gt;&amp;&quot;x');
});

test('mainHTML escapes a hostile habit name and renders the heat strip', () => {
  const html = mainHTML({ state: stateWith(habit({ name: '<script>' })), theme: 'dark' });
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('data-action="open-habit"'));
  assert.ok(html.includes('class="heat-scroll"'));
  assert.ok(html.includes('class="heat-grid"'));
  assert.ok(html.includes('data-action="toggle-today"'));
  assert.equal((html.match(/class="heat-day" data-state="[^"]*" data-date="/g) || []).length, 365);
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

test('monthViewHTML: header has only an icon back button, no year link, and sets --habit-accent', () => {
  const html = monthViewHTML({
    state: stateWith(habit()), id: 'h1',
    months: [{ year: 2026, month: 8 }], theme: 'light',
  });
  assert.match(html, /<button class="icon-btn" data-action="back-main" aria-label="Назад">‹<\/button>/);
  assert.ok(!html.includes('open-year'));
  assert.ok(html.includes('id="month-scroll"'));
  assert.ok(html.includes('--habit-accent:#4F7CB8')); // ACCENTS.blue.light
});

test('contextMenuHTML wires edit and delete for the habit id', () => {
  const html = contextMenuHTML({ habit: habit() });
  assert.match(html, /data-action="edit-habit" data-id="h1"/);
  assert.match(html, /data-action="delete-habit" data-id="h1"/);
  assert.match(html, /data-action="close-context"/);
});
