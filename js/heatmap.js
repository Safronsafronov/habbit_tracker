import { enumerateDays, addDays, mondayOf, parseDate } from './stats.js';

export const MONTHS = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

function cell(dateStr, entries, todayStr, createdAtStr) {
  let state;
  if (dateStr < createdAtStr || dateStr > todayStr) state = 'inactive';
  else if (entries[dateStr]) state = 'filled';
  else state = 'empty';
  return { dateStr, state, isToday: dateStr === todayStr };
}

export function buildGrid({ fromStr, toStr, entries, todayStr, createdAtStr, mode }) {
  if (mode === 'week') {
    const cells = enumerateDays(fromStr, toStr).map((d) => cell(d, entries, todayStr, createdAtStr));
    return { mode: 'week', columns: [{ monthLabel: null, cells }] };
  }

  const start = mondayOf(fromStr);
  const endMon = mondayOf(toStr);
  const columns = [];
  let colStart = start;
  let prevMonth = null;
  while (colStart <= endMon) {
    const cells = [];
    for (let i = 0; i < 7; i++) {
      cells.push(cell(addDays(colStart, i), entries, todayStr, createdAtStr));
    }
    const month = parseDate(colStart).getMonth();
    const monthLabel = month !== prevMonth ? MONTHS[month] : null;
    prevMonth = month;
    columns.push({ monthLabel, cells });
    colStart = addDays(colStart, 7);
  }
  return { mode: 'grid', columns };
}
