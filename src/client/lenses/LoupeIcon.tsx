/**
 * Loupe icon — two layered rounded rectangles.
 *
 * Outer: 3 corners at 50% radius, top-right at 24% (the "point").
 * Inner: all corners at 50% (circle).
 *
 * Usage:
 *   <LoupeIcon size={44} color="#dc2626" icon="D" />
 *   <LoupeIcon size={24} color="#16a34a" icon="E" />
 */

interface LoupeIconProps {
  size: number;
  color: string;
  icon: string;
  glow?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function LoupeIcon({ size, color, icon, glow, className, style }: LoupeIconProps) {
  const inner = size * 0.8;
  const offset = (size - inner) / 2;
  const fontSize = size * 0.35;

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: size,
        height: size,
        ...style,
      }}
    >
      {/* Outer shape — point at top-right */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: `${size * 0.5}px ${size * 0.24}px ${size * 0.5}px ${size * 0.5}px`,
          background: `${color}66`,
        }}
      />
      {/* Inner shape — circle with dark base for contrast */}
      <div
        style={{
          position: "absolute",
          top: offset,
          left: offset,
          width: inner,
          height: inner,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${color}80, ${color}59)`,
          boxShadow: glow
            ? `0 0 ${size * 0.5}px ${color}30, inset 0 0 ${size * 0.3}px rgba(0,0,0,0.2)`
            : `inset 0 0 ${size * 0.3}px rgba(0,0,0,0.2)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize,
          fontWeight: 600,
          color: "#ffffffcc",
        }}
      >
        {icon}
      </div>
    </div>
  );
}
