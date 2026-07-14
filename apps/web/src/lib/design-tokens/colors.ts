export const colors = {
  /**
   * Coinbase-inspired brand blue. The 600 shade is the default for primary actions.
   */
  brand: {
    50: '#f2f7ff',
    100: '#dcecff',
    200: '#b8d2ff',
    300: '#85b2ff',
    400: '#4f89ff',
    500: '#2468ff',
    600: '#0052ff', // default
    700: '#003ed6',
    800: '#002ca4',
    900: '#001d72',
    950: '#08113c',
  },
  /**
   * Slate neutrals for surfaces, borders, and text on the new fintech-inspired UI.
   */
  neutral: {
    0: '#ffffff',
    50: '#f7f9fc',
    100: '#eef2f7',
    200: '#dde3ec',
    300: '#c1c9d6',
    400: '#97a2b3',
    500: '#69748a',
    600: '#525b6d',
    700: '#3b4354',
    800: '#272d3a',
    900: '#171c25',
    950: '#0b1018',
  },
  /**
   * Emerald accent used for highlights, success states, and subtle emphasis.
   */
  warm: {
    50: '#f0fbf7',
    100: '#d9f5ea',
    200: '#b6ebd4',
    300: '#87d9bb',
    400: '#4bc996',
    500: '#22b67d',
    600: '#14915d',
    700: '#0f7045',
    800: '#0b4e33',
    900: '#072f22',
    950: '#041910',
  },
  semantic: {
    success: '#14915d',
    warning: '#f59e0b',
    danger: '#e04f39',
    info: '#0052ff',
  },
  mastery: {
    new: '#97a2b3',
    learning: '#4f89ff',
    mastered: '#14915d',
  },
} as const;

export type ColorScale = keyof typeof colors;
