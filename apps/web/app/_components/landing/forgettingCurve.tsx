'use client';

import { motion, useReducedMotion } from 'framer-motion';

// Plot area: x 40→460, y 30 (100% memory) → 250 (0%).
const withoutReview = 'M40 30 C 90 160, 150 220, 460 240';
const withMimir = [
  'M40 30 C 65 100, 85 135, 110 150',
  'L110 30 C 145 85, 180 110, 210 120',
  'L210 30 C 260 70, 300 85, 330 90',
  'L330 30 C 380 45, 420 55, 460 60',
].join(' ');
const reviews = [110, 210, 330];
// SVG text scales with the chart, so labels need a bigger size on narrow screens
// to land around 11px on screen.
const labelClass = 'fill-neutral-500 text-[18px] sm:text-[12px]';

export function ForgettingCurve() {
  const shouldReduceMotion = useReducedMotion();
  const reveal = (delay = 0) =>
    shouldReduceMotion
      ? {}
      : {
          initial: { pathLength: 0 },
          whileInView: { pathLength: 1 },
          viewport: { once: true, amount: 0.6 },
          transition: { duration: 1.8, ease: 'easeInOut' as const, delay },
        };
  const fadeIn = (delay = 0) =>
    shouldReduceMotion
      ? {}
      : {
          initial: { opacity: 0 },
          whileInView: { opacity: 1 },
          viewport: { once: true, amount: 0.6 },
          transition: { duration: 0.6, delay },
        };

  return (
    <figure>
      <svg
        viewBox="-20 0 500 290"
        role="img"
        aria-label="Forgetting curve: without review, memory drops close to zero within days. With Mimir, each scheduled review restores it, and memory decays more slowly after every review."
        className="h-auto w-full"
      >
        <line x1="40" y1="20" x2="40" y2="250" className="stroke-neutral-200" strokeWidth="1.5" />
        <line x1="40" y1="250" x2="465" y2="250" className="stroke-neutral-200" strokeWidth="1.5" />
        <text x="30" y="34" textAnchor="end" className={labelClass}>
          100%
        </text>
        <text x="30" y="254" textAnchor="end" className={labelClass}>
          0%
        </text>
        <text x="460" y="272" textAnchor="end" className={labelClass}>
          Time →
        </text>
        {reviews.map((x) => (
          <text key={x} x={x} y="272" textAnchor="middle" className={labelClass}>
            Review
          </text>
        ))}

        <motion.path
          d={withoutReview}
          fill="none"
          strokeWidth="2.5"
          strokeDasharray="6 6"
          className="stroke-neutral-500"
          {...fadeIn()}
        />
        <motion.path
          d={withMimir}
          fill="none"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
          className="stroke-neutral-900"
          {...reveal(0.2)}
        />
        {reviews.map((x, i) => (
          <motion.circle
            key={x}
            cx={x}
            cy="30"
            r="7"
            strokeWidth="3"
            className="fill-brand-300 stroke-white"
            {...fadeIn(0.6 + i * 0.4)}
          />
        ))}
      </svg>

      <figcaption className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-neutral-600">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="w-6 border-t-[3px] border-neutral-900" />
          With Mimir
        </span>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="w-6 border-t-[3px] border-dashed border-neutral-500" />
          Without review
        </span>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="size-3 rounded-full bg-brand-300" />
          Scheduled review
        </span>
      </figcaption>
    </figure>
  );
}
