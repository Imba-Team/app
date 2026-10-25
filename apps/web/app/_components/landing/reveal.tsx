'use client';

import { motion, useReducedMotion } from 'framer-motion';

// Fades and lifts its content in the first time it scrolls into view.
// Renders a plain div when the visitor prefers reduced motion.
export function Reveal({ className, children }: { className?: string; children: React.ReactNode }) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
