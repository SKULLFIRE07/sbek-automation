"use client";

import { StatusDot } from "./status-dot";

interface ServiceHealth {
  status: string;
  latency?: number;
}

interface HealthGridProps {
  services: {
    redis?: ServiceHealth;
    postgres?: ServiceHealth;
    crawler?: ServiceHealth;
    [key: string]: ServiceHealth | undefined;
  };
}

const SERVICE_LABELS: Record<string, string> = {
  redis: "Redis",
  postgres: "PostgreSQL",
  crawler: "Crawler",
};

/** Max acceptable latency in ms -- anything above renders a full bar */
const MAX_LATENCY = 500;

function mapStatus(status: string): "ok" | "error" | "warn" | "unknown" {
  switch (status.toLowerCase()) {
    case "ok":
    case "healthy":
    case "connected":
      return "ok";
    case "error":
    case "down":
    case "disconnected":
      return "error";
    case "degraded":
    case "warning":
      return "warn";
    default:
      return "unknown";
  }
}

function latencyColor(latency: number): string {
  if (latency < 50) return "#C5A572";   // gold -- fast
  if (latency < 200) return "#f59e0b";  // amber -- moderate
  return "#ef4444";                      // red -- slow
}

function LatencyBar({ latency }: { latency: number }) {
  const pct = Math.min((latency / MAX_LATENCY) * 100, 100);
  const color = latencyColor(latency);

  return (
    <div className="mt-2">
      <div
        className="w-full h-1 rounded-full overflow-hidden"
        style={{ background: "#1A1B19" }}
      >
        <div
          className="h-full rounded-full latency-bar-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[9px] font-mono" style={{ color: "#656453" }}>
          0ms
        </span>
        <span className="text-[9px] font-mono" style={{ color: "#656453" }}>
          {MAX_LATENCY}ms
        </span>
      </div>
    </div>
  );
}

export function HealthGrid({ services }: HealthGridProps) {
  const keys = Object.keys(services).filter(
    (k) => services[k] !== undefined
  );

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-3 gap-px"
      style={{ background: "#2A2B28" }}
    >
      {keys.map((key) => {
        const svc = services[key]!;
        const label = SERVICE_LABELS[key] || key;
        const status = mapStatus(svc.status);

        return (
          <div
            key={key}
            className="p-5 transition-colors duration-150"
            style={{ background: "#141513" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "#1A1B19")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "#141513")
            }
          >
            <div className="flex items-center gap-2 mb-3">
              <StatusDot status={status} pulse size="md" />
              <span
                className="text-xs uppercase tracking-widest font-medium"
                style={{ color: "#7A7968" }}
              >
                {label}
              </span>
            </div>

            <p className="font-mono text-xl" style={{ color: "#d4d3cc" }}>
              {svc.latency !== undefined ? `${svc.latency}ms` : "--"}
            </p>

            <p className="text-[10px] mt-1" style={{ color: "#656453" }}>
              {svc.status}
            </p>

            {svc.latency !== undefined && <LatencyBar latency={svc.latency} />}
          </div>
        );
      })}
    </div>
  );
}
