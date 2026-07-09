export const spacing = {
  0: '0px',
  px: '1px',
  0.5: '2px',
  1: '4px',
  1.5: '6px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
  24: '96px',
} as const;

export const radii = {
  none: '0px',
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '24px',
  full: '9999px',
} as const;

export const shadows = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md: '0 2px 8px 0 rgb(0 0 0 / 0.08)',
  lg: '0 10px 30px -5px rgb(0 0 0 / 0.1)',
  focus: '0 0 0 3px rgb(47 92 255 / 0.35)',
} as const;

export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radii;
