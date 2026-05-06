interface ProgressRingProps {
  progress: number; // 0–100
  size?: number;
}

export function ProgressRing({ progress, size = 48 }: ProgressRingProps) {
  // r=15.9 → circumference ≈ 99.9 ≈ 100, convenient for % math
  const r   = 15.9;
  const circ = 2 * Math.PI * r;
  const filled = (progress / 100) * circ;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      className="-rotate-90"
      style={{ flexShrink: 0 }}
    >
      <circle
        cx="18" cy="18" r={r}
        fill="none" stroke="currentColor" strokeWidth="2.5"
        className="text-blue-100 dark:text-blue-500/20"
      />
      <circle
        cx="18" cy="18" r={r}
        fill="none" stroke="currentColor" strokeWidth="2.5"
        className="text-blue-500 transition-all duration-300"
        strokeDasharray={`${filled} ${circ}`}
        strokeLinecap="round"
      />
    </svg>
  );
}
