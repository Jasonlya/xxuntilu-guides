export function Ring({ percent, size = 20, stroke = 2.5 }: { percent: number; size?: number; stroke?: number }) {
  const radius = size / 2 - stroke / 2 - 0.5;
  const circumference = 2 * Math.PI * radius;
  const filled = Math.max(0, Math.min(1, percent)) * circumference;
  return (
    <span className="ring" style={{ ['--size' as string]: `${size}px` }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} />
        <circle
          className="ring-value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
        />
      </svg>
    </span>
  );
}
