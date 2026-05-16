import React from 'react';

// Flat "D" road merging into a forward arrow.
export default function Logo({ size = 36, className = '' }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      data-testid="driveall-logo"
      aria-label="DriveAll logo"
    >
      <defs>
        <linearGradient id="d-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22C55E" />
          <stop offset="100%" stopColor="#16A34A" />
        </linearGradient>
      </defs>
      <path
        d="M14 8 H30 C46 8 56 18 56 32 C56 46 46 56 30 56 H14 Z"
        fill="none"
        stroke="url(#d-grad)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M22 32 L36 32"
        stroke="url(#d-grad)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M36 24 L48 32 L36 40"
        fill="none"
        stroke="url(#d-grad)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
