"use client";

interface StatusDotProps {
  status: "ok" | "error" | "warn" | "unknown";
  pulse?: boolean;
  size?: "sm" | "md";
}

const colorMap = {
  ok: { bg: "#22C55E", class: "bg-[#22C55E]" },
  error: { bg: "#ef4444", class: "bg-red-500" },
  warn: { bg: "#f59e0b", class: "bg-amber-500" },
  unknown: { bg: "#CCCCCC", class: "bg-[#CCCCCC]" },
};

export function StatusDot({ status, pulse, size = "md" }: StatusDotProps) {
  const color = colorMap[status] || colorMap.unknown;
  const dim = size === "md" ? "w-2 h-2" : "w-1.5 h-1.5";

  // Determine animation class:
  // - error/warn always pulse to draw attention
  // - ok pulses only when pulse prop is true
  const animClass =
    status === "error"
      ? "status-dot-error"
      : status === "warn"
      ? "status-dot-warn"
      : pulse && status === "ok"
      ? "status-dot-pulse"
      : "";

  return (
    <span
      className={`inline-block ${dim} rounded-full ${color.class} ${animClass}`}
      style={animClass === "status-dot-pulse" ? { color: color.bg } : undefined}
    />
  );
}
