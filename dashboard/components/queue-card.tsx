"use client";

import Link from "next/link";
import { StatusDot } from "./status-dot";
import type { QueueItem } from "@/lib/hooks";

/* Subtle monochrome palette — only failed gets color */
const STATUS_COLORS: Record<string, { bar: string; text: string; bg: string }> = {
  active:    { bar: "#1A1A1A", text: "#555555", bg: "rgba(0,0,0,0.05)" },
  failed:    { bar: "#C0392B", text: "#C0392B", bg: "rgba(192,57,43,0.07)" },
  completed: { bar: "#CCCCCC", text: "#999999", bg: "rgba(0,0,0,0.04)" },
  waiting:   { bar: "#999999", text: "#888888", bg: "rgba(0,0,0,0.04)" },
  delayed:   { bar: "#B0B0B0", text: "#999999", bg: "rgba(0,0,0,0.04)" },
};

const PILL_LABELS: Record<string, string> = {
  failed: "failed",
  active: "active",
  completed: "done",
  waiting: "waiting",
  delayed: "delayed",
};

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

  /* Segments in display order (most important first for the bar) */
  const segments = [
    { key: "active", count: active },
    { key: "failed", count: failed },
    { key: "waiting", count: waiting },
    { key: "delayed", count: delayed },
    { key: "completed", count: completed },
  ].filter((s) => s.count > 0);

  /* Pills — show non-zero, max 4 */
  const visiblePills = segments.slice(0, 4);

  return (
    <Link
      href={`/queues/${encodeURIComponent(name)}`}
      className="card block p-5"
    >
      {/* Header: queue name + status dot */}
      <div className="flex items-center justify-between mb-4">
        <span
          className="text-sm font-medium tracking-tight truncate"
          style={{ color: "var(--text-secondary)", maxWidth: "85%" }}
        >
          {name}
        </span>
        <StatusDot status={status} />
      </div>

      {/* Progress bar — 6px tall, color-coded segments */}
      <div
        className="flex w-full overflow-hidden mb-4"
        style={{
          height: 6,
          background: "var(--bg-hover)",
          borderRadius: 999,
          gap: 1,
        }}
      >
        {total > 0 &&
          segments.map((seg) => {
            const colors = STATUS_COLORS[seg.key];
            return (
              <div
                key={seg.key}
                style={{
                  background: colors.bar,
                  width: `${(seg.count / total) * 100}%`,
                  height: "100%",
                  borderRadius: 999,
                  transition: "width 400ms cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              />
            );
          })}
      </div>

      {/* Stat pills — each has a colored dot matching its bar segment */}
      <div className="flex items-center gap-2 flex-wrap">
        {visiblePills.length > 0 ? (
          visiblePills.map((pill) => {
            const colors = STATUS_COLORS[pill.key];
            return (
              <span
                key={pill.key}
                className="badge inline-flex items-center gap-1.5 text-[11px] font-medium"
                style={{ color: colors.text, background: colors.bg }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: colors.bar,
                    flexShrink: 0,
                  }}
                />
                {pill.count.toLocaleString()} {PILL_LABELS[pill.key]}
              </span>
            );
          })
        ) : (
          <span className="badge text-[11px]" style={{ color: "var(--text-disabled)" }}>
            idle
          </span>
        )}
      </div>
    </Link>
  );
}
