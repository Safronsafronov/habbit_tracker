// Pure date + statistics helpers. No DOM, no localStorage. All dates are local
// "YYYY-MM-DD" strings; string comparison is a valid chronological compare.

export function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayStr(now = new Date()) {
  return formatDate(now);
}

export function addDays(str, n) {
  const dt = parseDate(str);
  dt.setDate(dt.getDate() + n);
  return formatDate(dt);
}

export function mondayOf(str) {
  const dt = parseDate(str);
  const dow = (dt.getDay() + 6) % 7; // Mon=0 … Sun=6
  dt.setDate(dt.getDate() - dow);
  return formatDate(dt);
}

export function enumerateDays(fromStr, toStr) {
  if (fromStr > toStr) return [];
  const out = [];
  let cur = fromStr;
  while (cur <= toStr) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

export function currentStreak(entries, today) {
  const anchor = entries[today] ? today : addDays(today, -1);
  if (!entries[anchor]) return 0;
  let count = 0;
  let cur = anchor;
  while (entries[cur]) {
    count++;
    cur = addDays(cur, -1);
  }
  return count;
}

export function longestStreak(entries) {
  const days = Object.keys(entries).filter((k) => entries[k]).sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const d of days) {
    run = prev !== null && addDays(prev, 1) === d ? run + 1 : 1;
    if (run > best) best = run;
    prev = d;
  }
  return best;
}

export function totalDays(entries) {
  return Object.keys(entries).filter((k) => entries[k]).length;
}

export function completionRate(entries, fromStr, toStr) {
  const days = enumerateDays(fromStr, toStr);
  const total = days.length;
  const done = days.filter((d) => entries[d]).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return { done, total, pct };
}

const RANGE_WEEKS = { month: 5, q: 14, half: 26, year: 52 };

export function rangeBounds(rangeKey, today, createdAtStr) {
  if (rangeKey === 'week') {
    return { fromStr: addDays(today, -6), toStr: today, mode: 'week' };
  }
  if (rangeKey === 'all') {
    const base = createdAtStr <= today ? createdAtStr : today;
    return { fromStr: mondayOf(base), toStr: today, mode: 'grid' };
  }
  const weeks = RANGE_WEEKS[rangeKey];
  return { fromStr: addDays(mondayOf(today), -7 * (weeks - 1)), toStr: today, mode: 'grid' };
}
