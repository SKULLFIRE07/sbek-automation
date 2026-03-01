"use client";

import Link from "next/link";
import { StatusDot } from "./status-dot";
import type { QueueItem } from "@/lib/hooks";

export function QueueCard({
  name,
  active,
  completed,
  delayed,
  failed,
  paused,
  waiting,
}: QueueItem) {
  const total = waiting + active + completed + failed + delayed;

  const status: "ok" | "error" | "warn" | "unknown" =
    failed > 0 ? "error" : active > 0 ? "ok" : total === 0 ? "unknown" : "ok";

  // Build stat pills -- only show non-zero counts, prioritized by importance
  const pills: { label: string; count: number; color: string; bg: string }[] =
    [];

  if (failed > 0) {
    pills.push({
      label: "failed",
      count: failed,
      color: "#ef4444",
      bg: "rgba(239,68,68,0.10)",
    });
  }
  if (active > 0) {
    pills.push({
      label: "active",
      count: active,
      color: "#C5A572",
      bg: "rgba(197,165,114,0.10)",
    });
  }
  if (completed > 0) {
    pills.push({
      label: "done",
      count: completed,
      color: "#7A7968",
      bg: "rgba(122,121,104,0.08)",
    });
  }
  if (delayed > 0) {
    pills.push({
      label: "delayed",
      count: delayed,
      color: "#f59e0b",
      bg: "rgba(245,158,11,0.10)",
    });
  }
  if (waiting > 0) {
    pills.push({
      label: "waiting",
      count: waiting,
      color: "#656453",
      bg: "rgba(101,100,83,0.08)",
    });
  }

  // Show at most 3 pills
  const visiblePills = pills.slice(0, 3);

  const segments = [
    { key: "completed", count: completed, color: "#3A3B37" },
    { key: "active", count: active, color: "#C5A572" },
    { key: "failed", count: failed, color: "#ef4444" },
    { key: "waiting", count: waiting, color: "#656453" },
    { key: "delayed", count: delayed, color: "#f59e0b" },
  ];

  return (
    <Link
      href={`/queues/${encodeURIComponent(name)}`}
      className="block rounded-lg"
      style={{
        background: "#141513",
        border: "1px solid #2A2B28",
        padding: "16px",
        transition:
          "box-shadow 0.25s ease, border-color 0.25s ease, background 0.25s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(197,165,114,0.35)";
        e.currentTarget.style.boxShadow =
          "0 0 0 1px rgba(197,165,114,0.08), 0 4px 24px rgba(0,0,0,0.35)";
        e.currentTarget.style.background = "#1A1B19";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "#2A2B28";
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.background = "#141513";
      }}
    >
      {/* Header: queue name + status dot */}
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-sm font-medium tracking-tight truncate"
          style={{ color: "#d4d3cc", maxWidth: "85%" }}
        >
          {name}
        </span>
        <StatusDot status={status} />
      </div>

      {/* Progress bar -- 2px tall */}
      <div
        className="flex w-full overflow-hidden rounded-full mb-3"
        style={{ height: "2px", background: "#1A1B19" }}
      >
        {total > 0 &&
          segments.map((seg) =>
            seg.count > 0 ? (
              <div
                key={seg.key}
                style={{
                  background: seg.color,
                  width: `${(seg.count / total) * 100}%`,
                  height: "100%",
                }}
              />
            ) : null,
          )}
      </div>

      {/* Stat pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {visiblePills.length > 0 ? (
          visiblePills.map((pill) => (
            <span
              key={pill.label}
              className="inline-flex items-center gap-1 text-[11px] font-medium rounded-full"
              style={{
                color: pill.color,
                background: pill.bg,
                padding: "2px 8px",
                letterSpacing: "0.01em",
              }}
            >
              {pill.count.toLocaleString()}
              <span style={{ opacity: 0.7 }}>{pill.label}</span>
            </span>
          ))
        ) : (
          <span
            className="text-[11px]"
            style={{ color: "#656453", letterSpacing: "0.01em" }}
          >
            idle
          </span>
        )}
      </div>
    </Link>
  );
}
