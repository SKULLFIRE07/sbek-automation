"use client";

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: "up" | "down" | "flat";
  trendLabel?: string;
}

/** Tiny inline SVG arrows for trend direction (monochrome) */
function TrendIndicator({
  trend,
  label,
}: {
  trend: "up" | "down" | "flat";
  label?: string;
}) {
  const arrow =
    trend === "up" ? (
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M5 8V2M5 2L2 5M5 2l3 3" />
      </svg>
    ) : trend === "down" ? (
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M5 2v6M5 8L2 5M5 8l3-3" />
      </svg>
    ) : (
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M2 5h6" />
      </svg>
    );

  return (
    <span
      className="inline-flex items-center gap-1 text-[11px]"
      style={{ color: "#656453" }}
    >
      {arrow}
      {label && <span>{label}</span>}
    </span>
  );
}

export function StatCard({
  label,
  value,
  subtitle,
  trend,
  trendLabel,
}: StatCardProps) {
  return (
    <div
      className="px-6 py-8 rounded-lg flex flex-col justify-between min-h-[170px]"
      style={{
        background: "#141513",
        border: "1px solid #1E1F1C",
        transition: "background 0.25s ease, border-color 0.25s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "#1A1B19";
        e.currentTarget.style.borderColor = "#2A2B28";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "#141513";
        e.currentTarget.style.borderColor = "#1E1F1C";
      }}
    >
      <p
        className="text-[11px] uppercase tracking-[0.15em] mb-4 font-medium"
        style={{ color: "#7A7968" }}
      >
        {label}
      </p>
      <div>
        <p
          className="font-semibold leading-none"
          style={{
            color: "#d4d3cc",
            fontSize: "2.75rem",
            lineHeight: 1,
            letterSpacing: "-0.03em",
          }}
        >
          {value}
        </p>
        <div className="flex items-center gap-3 mt-4 min-h-[18px]">
          {trend && <TrendIndicator trend={trend} label={trendLabel} />}
          {subtitle && (
            <span className="text-[11px]" style={{ color: "#656453" }}>
              {subtitle}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
