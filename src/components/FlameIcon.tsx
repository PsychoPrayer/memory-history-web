/** Streak flame: warm core over an ember outer flame. */
export function FlameIcon({ className = 'flame-icon' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 2.5c.6 3-1.4 4.6-2.8 6.3C7.6 10.7 6 12.6 6 15.4 6 19 8.7 21.5 12 21.5s6-2.5 6-6c0-2.4-1.2-4.2-2.3-5.6-.3 1.3-1 2.3-2 2.8.4-3.6-.4-7.6-1.7-10.2z"
        fill="#c2410c"
      />
      <path
        d="M12 11.5c.2 1.6-.8 2.4-1.5 3.3-.6.7-1 1.4-1 2.4 0 1.6 1.1 2.8 2.5 2.8s2.5-1.2 2.5-2.7c0-1.3-.7-2.1-1.3-2.8-.1.6-.4 1-.8 1.2.1-1.6-.1-3.1-.4-4.2z"
        fill="#fbbf24"
      />
    </svg>
  )
}
