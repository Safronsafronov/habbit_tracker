// Single source of truth for per-habit accent colours (spec §5.3).
export const ACCENTS = {
  indigo: { light: '#5B5BD6', dark: '#7C7CF0' },
  blue:   { light: '#2F6FEB', dark: '#4C8DFF' },
  cyan:   { light: '#0E9AB8', dark: '#35C4DE' },
  green:  { light: '#1FA971', dark: '#34D399' },
  lime:   { light: '#5F9E1F', dark: '#86C440' },
  amber:  { light: '#D9931F', dark: '#F0B23C' },
  orange: { light: '#E5622E', dark: '#FB8148' },
  red:    { light: '#DC4B4B', dark: '#FF6060' },
  pink:   { light: '#D6428A', dark: '#FF6BB0' },
  purple: { light: '#8A4FD8', dark: '#A874F5' },
};

export const ACCENT_KEYS = Object.keys(ACCENTS);
