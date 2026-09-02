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
