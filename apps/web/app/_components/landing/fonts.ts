import { Inter } from 'next/font/google';

// Body font for the landing only — headings stay on the app-wide Montserrat
// (`font-sans`). Exposed as `--font-inter`, consumed by the `font-body` utility.
export const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});
