import React from 'react';

// Wraps content into a mobile-first frame, centered on desktop.
export default function MobileFrame({ children }) {
  return (
    <div className="min-h-[100dvh] w-full bg-ink-100 dark:bg-ink-950 flex justify-center">
      <div
        className="relative w-full max-w-md min-h-[100dvh] bg-ink-50 dark:bg-ink-950 overflow-hidden shadow-floating dark:shadow-floating-dark"
        data-testid="app-frame"
      >
        {children}
      </div>
    </div>
  );
}
