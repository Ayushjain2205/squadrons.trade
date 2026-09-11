"use client";

/** Simple wallet glyph for the rail — not an identity mark. */
export function WalletIcon({
  size = 18,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M3.5 8.5h14.2a2.3 2.3 0 0 1 2.3 2.3v7.4a2.3 2.3 0 0 1-2.3 2.3H5.8A2.3 2.3 0 0 1 3.5 18.2V8.5Z" />
      <path d="M3.5 8.5V7a2.5 2.5 0 0 1 2.5-2.5h10.2" />
      <circle cx="16.2" cy="14.2" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}
