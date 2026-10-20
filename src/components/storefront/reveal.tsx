'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const reduceMotion = useReducedMotion();
  // Keep content visible in server HTML and when scripting is disabled.
  return (
    <motion.div
      className={className}
      initial={false}
      whileInView={reduceMotion ? {} : { y: [10, 0] }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
