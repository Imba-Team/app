import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

import { colors as tokens } from './src/lib/design-tokens/colors';
import { fonts, fontSizes, fontWeights, lineHeights } from './src/lib/design-tokens/typography';
import { radii, shadows, spacing } from './src/lib/design-tokens/spacing';

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      // shadcn semantic tokens (CSS variables → HSL) — see src/index.css
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },

        // Raw scales — reserved for illustrations, charts, mastery visualization
        brand: tokens.brand,
        neutral: tokens.neutral,
        warm: tokens.warm,
        'mastery-new': tokens.mastery.new,
        'mastery-learning': tokens.mastery.learning,
        'mastery-mastered': tokens.mastery.mastered,
      },
      borderRadius: {
        ...radii,
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      spacing,
      boxShadow: shadows,
      fontFamily: {
        sans: fonts.sans.split(',').map((f) => f.trim()),
        mono: fonts.mono.split(',').map((f) => f.trim()),
        serif: fonts.serif.split(',').map((f) => f.trim()),
      },
      fontSize: fontSizes,
      // Tailwind expects string values for fontWeight and lineHeight — stringify the tokens.
      fontWeight: Object.fromEntries(
        Object.entries(fontWeights).map(([k, v]) => [k, String(v)]),
      ) as Record<keyof typeof fontWeights, string>,
      lineHeight: Object.fromEntries(
        Object.entries(lineHeights).map(([k, v]) => [k, String(v)]),
      ) as Record<keyof typeof lineHeights, string>,
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [animate],
};

export default config;
