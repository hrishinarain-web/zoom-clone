"use client";

export default function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className={`logo ${light ? "logo-light" : ""}`}>
      <svg viewBox="0 0 28 28" width="28" height="28" aria-hidden>
        <rect width="28" height="28" rx="8" fill="#0E72ED" />
        <rect x="4.5" y="8.5" width="12" height="11" rx="2" fill="white" />
        <path d="M16.5 12.2 L23.5 8.8 V19.2 L16.5 15.8 Z" fill="white" />
      </svg>
      <span className="wordmark">zoom</span>
    </span>
  );
}
