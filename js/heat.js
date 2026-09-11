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
