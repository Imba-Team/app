export const colors = {
  /**
   * Iris Green — Mimir's brand color. Warm chartreuse/olive.
   * The 400 shade (#ACBD6F, provided) is the DEFAULT — used for shadcn --primary.
   * Shades 100/200/400 come from the source palette; the rest are interpolated.
   */
  brand: {
    50: '#f6f9ec',
    100: '#e4ebca', // source
    200: '#cbd581', // source
    300: '#bacb76',
    400: '#acbd6f', // source — DEFAULT
    500: '#96aa5b',
    600: '#7f9147',
    700: '#657339',
    800: '#4c5628',
    900: '#3a4220',
    950: '#1f2410',
  },
  /**
   * Warm neutrals — Greige → Weathered Taupe.
   * 100/300/700 are source palette shades. The rest are interpolated so we have
   * a full Tailwind-style scale (bg-neutral-50 through bg-neutral-950).
   */
  neutral: {
    0: '#ffffff',
    50: '#faf8f4',
    100: '#efeae4', // source (greige light)
    200: '#dfd8ce',
    300: '#cbc5b9', // source (greige)
    400: '#a89f8f',
    500: '#857c6c',
    600: '#6a6255',
    700: '#534d41', // source (weathered taupe)
    800: '#3d3830',
    900: '#2b2822',
    950: '#1a1814',
  },
  /**
   * Yellow Stone — warm accent. Feeds shadcn --accent and any highlight surface.
   * 200/400/500 are source palette shades.
   */
  warm: {
    50: '#fdf9e6',
    100: '#faf2c4',
    200: '#f6e9a8', // source
    300: '#ecdc94',
    400: '#e2d783', // source — DEFAULT
    500: '#d0bf72', // source
    600: '#a99852',
    700: '#7f7238',
    800: '#5b5227',
    900: '#3f381c',
    950: '#232010',
  },
  semantic: {
    success: '#7f9147', // brand-600 — deep iris green
    warning: '#d0bf72', // warm-500 — yellow stone
    danger: '#a6553f', // warm terra — synthesized to harmonize with the earthy palette
    info: '#5f6b7a', // muted blue-gray — synthesized
  },
  mastery: {
    new: '#a89f8f', // neutral-400 — muted warm gray
    learning: '#d0bf72', // warm-500 — yellow stone
    mastered: '#7f9147', // brand-600 — deep iris green
  },
} as const;

export type ColorScale = keyof typeof colors;
