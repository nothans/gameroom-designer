/** The Gameroom Designer mark: a block on the room grid wearing a d-pad + two buttons.
    Same artwork as public/favicon.svg, inlined so the wordmark and About modal share it. */
export function BrandMark({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#1e293b" />
      <g stroke="#334155" strokeWidth="1.5" strokeLinecap="round">
        <path d="M16 12v40M32 12v40M48 12v40" />
        <path d="M12 16h40M12 32h40M12 48h40" />
      </g>
      <rect x="18" y="12" width="28" height="40" rx="5" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
      <g fill="#334155">
        <rect x="22" y="24" width="20" height="6" rx="2" />
        <rect x="29" y="17" width="6" height="20" rx="2" />
      </g>
      <circle cx="27" cy="44" r="3.5" fill="#3b82f6" />
      <circle cx="37" cy="44" r="3.5" fill="#f59e0b" />
    </svg>
  );
}
