'use client';

import { ThemeProvider as NextThemeProvider } from 'next-themes';
import { MotionConfig } from 'motion/react';
import { Toaster } from 'sonner';
import type { ReactNode } from 'react';

export function ThemeProvider({
  children,
  nonce,
}: {
  children: ReactNode;
  nonce?: string | undefined;
}) {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="sd-theme"
      disableTransitionOnChange
      {...(nonce ? { nonce } : {})}
    >
      <MotionConfig reducedMotion="user">
        {children}
        <Toaster position="bottom-right" toastOptions={{ className: 'store-toast' }} />
      </MotionConfig>
    </NextThemeProvider>
  );
}
