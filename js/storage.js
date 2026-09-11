import { ACCENT_KEYS } from './accents.js';
import { todayStr } from './stats.js';

export const STORAGE_KEY = 'habitTracker.v1';

export function makeDefaultState() {
  return { version: 1, settings: { theme: 'system' }, habits: [] };
}

export function genId() {
  return 'h_' + Math.random().toString(36).slice(2, 8).padEnd(6, '0');
}

function migrate(state) {
  if (!state || typeof state !== 'object') return makeDefaultState();
  if (!state.version) state.version = 1;
  if (!state.settings || typeof state.settings !== 'object') state.settings = { theme: 'system' };
  if (!state.settings.theme) state.settings.theme = 'system';
  if (!Array.isArray(state.habits)) state.habits = [];
  state.habits = state.habits
    .filter((h) => h && typeof h === 'object')
    .map((h) => ({
      ...h,
      id: typeof h.id === 'string' && h.id ? h.id : genId(),
      name: typeof h.name === 'string' ? h.name.slice(0, 40) : '',
      emoji: typeof h.emoji === 'string' ? h.emoji : '',
      accent: ACCENT_KEYS.includes(h.accent) ? h.accent : ACCENT_KEYS[0],
      createdAt: /^\d{4}-\d{2}-\d{2}$/.test(h.createdAt) ? h.createdAt : todayStr(),
      archived: h.archived === true,
      entries: h.entries && typeof h.entries === 'object' && !Array.isArray(h.entries) ? h.entries : {},
    }));
  return state;
}

export function loadState(storage) {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return makeDefaultState();
  try {
    return migrate(JSON.parse(raw));
  } catch {
    return { ...makeDefaultState(), _corrupt: true };
  }
}

export function saveState(storage, state) {
  const { _corrupt, ...clean } = state;
  storage.setItem(STORAGE_KEY, JSON.stringify(clean));
}

export function getHabit(state, id) {
  return state.habits.find((h) => h.id === id);
}

export function nextAccent(state) {
  const used = new Set(state.habits.map((h) => h.accent));
  return ACCENT_KEYS.find((k) => !used.has(k)) || ACCENT_KEYS[state.habits.length % ACCENT_KEYS.length];
}

export function createHabit(state, { name, emoji, accent, createdAt }) {
  const habit = {
    id: genId(),
    name: name.trim().slice(0, 40),
    emoji: emoji || '',
    accent: accent || nextAccent(state),
    createdAt: createdAt || todayStr(),
    archived: false,
    entries: {},
  };
  return { state: { ...state, habits: [...state.habits, habit] }, habit };
}

export function updateHabit(state, id, patch) {
  return {
    ...state,
    habits: state.habits.map((h) => {
      if (h.id !== id) return h;
      const next = { ...h, ...patch };
      if (typeof next.name === 'string') next.name = next.name.trim().slice(0, 40);
      return next;
    }),
  };
}

export function deleteHabit(state, id) {
  return { ...state, habits: state.habits.filter((h) => h.id !== id) };
}

export function toggleEntry(state, id, dateStr) {
  return {
    ...state,
    habits: state.habits.map((h) => {
      if (h.id !== id) return h;
      const entries = { ...h.entries };
      if (entries[dateStr]) delete entries[dateStr];
      else entries[dateStr] = true;
      return { ...h, entries };
    }),
  };
}

export function setTheme(state, theme) {
  return { ...state, settings: { ...state.settings, theme } };
}
