// Single source of truth for per-habit accent colours.
// Muted / lower-saturation set so the calendar fills read calm, not neon.
export const ACCENTS = {
  indigo: { light: '#6667AB', dark: '#8788C4' },
  blue:   { light: '#4F7CB8', dark: '#6E9BD2' },
  cyan:   { light: '#3E93A6', dark: '#5FB3C2' },
  green:  { light: '#4E9C72', dark: '#6FBB8F' },
  lime:   { light: '#7A9B4E', dark: '#9BBA72' },
  amber:  { light: '#C39A55', dark: '#DAB77C' },
  orange: { light: '#C67A52', dark: '#DB9A78' },
  red:    { light: '#C25E5E', dark: '#D98686' },
  pink:   { light: '#BE6E97', dark: '#D695B7' },
  purple: { light: '#8E68B4', dark: '#AC8ECF' },
};

export const ACCENT_KEYS = Object.keys(ACCENTS);
