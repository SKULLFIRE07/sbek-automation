"use client";

interface BarChartProps {
  values: number[];
  max?: number;
}

export function BarChart({ values, max: maxOverride }: BarChartProps) {
  if (values.length === 0) return null;

  const max = maxOverride ?? Math.max(...values, 1);
  const barWidth = 3;
  const gap = 1;
  const height = 16;
  const width = values.length * (barWidth + gap) - gap;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="inline-block"
    >
      {values.map((v, i) => {
        const barHeight = max > 0 ? (v / max) * height : 0;
        return (
          <rect
            key={i}
            x={i * (barWidth + gap)}
            y={height - barHeight}
            width={barWidth}
            height={barHeight}
            fill="#fff"
          />
        );
      })}
    </svg>
  );
}
