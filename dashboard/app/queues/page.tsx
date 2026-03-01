"use client";

import Link from "next/link";
import { useQueues, useStats } from "@/lib/hooks";
import type { QueueItem } from "@/lib/hooks";
import { PageHeader } from "@/components/page-header";
import { StatusDot } from "@/components/status-dot";
import { formatNumber } from "@/lib/utils";

/* ── Brand palette ──────────────────────────────────────────────── */
const color = {
  gold: "#C5A572",
  surface: "#141513",
  elevated: "#1A1B19",
  muted: "#7A7968",
  primary: "#d4d3cc",
  border: "#2A2B28",
  completed: "#3A3B37",
  active: "#C5A572",
  failed: "#ef4444",
  failedText: "#f87171",
  waiting: "#656453",
  delayed: "#f59e0b",
  subtleMuted: "#656453",
};

/* ── Skeleton loader ────────────────────────────────────────────── */
function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded ${className || ""}`}
      style={{ background: color.elevated }}
    />
  );
}

/* ── Derive queue health status ─────────────────────────────────── */
function deriveStatus(q: QueueItem): "ok" | "error" | "warn" | "unknown" {
  if (q.failed > 0) return "error";
  if (q.active > 0) return "ok";
  const total = q.waiting + q.active + q.completed + q.failed + q.delayed;
  if (total === 0) return "unknown";
  return "ok";
}

/* ── StatusBadge (kept as-is) ───────────────────────────────────── */
function StatusBadge({ status }: { status: "ok" | "error" | "warn" | "unknown" }) {
  const labels: Record<string, string> = {
    ok: "Healthy",
    error: "Failing",
    warn: "Degraded",
    unknown: "Idle",
  };
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider"
      style={{ color: "#9A9880" }}
    >
      <StatusDot status={status} />
      {labels[status]}
    </span>
  );
}

/* ── Segmented progress bar ─────────────────────────────────────── */
function ProgressBar({
  segments,
  total,
}: {
  segments: { label: string; value: number; shade: string }[];
  total: number;
}) {
  if (total === 0) {
    return (
      <div className="h-1.5 w-full rounded-full" style={{ background: color.elevated }} />
    );
  }
  return (
    <div
      className="flex h-1.5 w-full overflow-hidden rounded-full"
      style={{ background: color.elevated }}
    >
      {segments.map((seg) =>
        seg.value > 0 ? (
          <div
            key={seg.label}
            className="h-full transition-all duration-500"
            style={{ width: `${(seg.value / total) * 100}%`, background: seg.shade }}
            title={`${seg.label}: ${seg.value}`}
          />
        ) : null
      )}
    </div>
  );
}

/* ── Legend item ─────────────────────────────────────────────────── */
function LegendItem({ shade, label }: { shade: string; label: string }) {
  return (
    <span className="flex items-center gap-2 text-xs" style={{ color: color.muted }}>
      <span
        className="inline-block w-3 h-1.5 rounded-full"
        style={{ background: shade }}
      />
      {label}
    </span>
  );
}

/* ── Page ────────────────────────────────────────────────────────── */
export default function QueuesPage() {
  const { data: queues, isLoading } = useQueues();
  const { data: stats } = useStats();

  const totalJobs =
    queues?.reduce(
      (sum, q) => sum + q.waiting + q.active + q.completed + q.failed + q.delayed,
      0
    ) ?? 0;
  const totalFailed = queues?.reduce((sum, q) => sum + q.failed, 0) ?? 0;
  const totalActive = queues?.reduce((sum, q) => sum + q.active, 0) ?? 0;
  const totalWaiting = queues?.reduce((sum, q) => sum + q.waiting, 0) ?? 0;

  return (
    <>
      {/* ── Page header (title only, no subtitle) ──────────────── */}
      <PageHeader title="Queues" />

      {/* ── Summary strip ──────────────────────────────────────── */}
      <div
        className="grid grid-cols-2 sm:grid-cols-4 gap-px mb-10 rounded-lg overflow-hidden"
        style={{ background: color.border }}
      >
        {[
          { label: "Total Jobs", value: formatNumber(totalJobs) },
          { label: "Active", value: formatNumber(totalActive) },
          { label: "Waiting", value: formatNumber(totalWaiting) },
          { label: "Failed", value: formatNumber(totalFailed), highlight: totalFailed > 0 },
        ].map((item) => (
          <div key={item.label} className="px-6 py-5" style={{ background: color.surface }}>
            <p
              className="text-[11px] uppercase tracking-widest mb-1.5"
              style={{ color: color.muted, fontFamily: "inherit" }}
            >
              {item.label}
            </p>
            <p
              className="text-2xl font-semibold tabular-nums"
              style={{ color: item.highlight ? color.failedText : color.primary }}
            >
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Queue cards grid ───────────────────────────────────── */}
      {isLoading || !queues ? (
        <div
          className="grid grid-cols-1 md:grid-cols-2 gap-px rounded-lg overflow-hidden"
          style={{ background: color.border }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-7" style={{ background: color.surface }}>
              <Skeleton className="h-4 w-36 mb-5" />
              <Skeleton className="h-1.5 w-full mb-5" />
              <div className="flex gap-8">
                <Skeleton className="h-14 w-20" />
                <Skeleton className="h-14 w-20" />
                <Skeleton className="h-14 w-20" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          className="grid grid-cols-1 md:grid-cols-2 gap-px rounded-lg overflow-hidden"
          style={{ background: color.border }}
        >
          {queues.map((q) => {
            const total = q.waiting + q.active + q.completed + q.failed + q.delayed;
            const status = deriveStatus(q);
            const segments = [
              { label: "Completed", value: q.completed, shade: color.completed },
              { label: "Active", value: q.active, shade: color.active },
              { label: "Waiting", value: q.waiting, shade: color.waiting },
              { label: "Failed", value: q.failed, shade: color.failed },
              { label: "Delayed", value: q.delayed, shade: color.delayed },
            ];

            return (
              <Link
                key={q.name}
                href={`/queues/${encodeURIComponent(q.name)}`}
                className="block p-7 transition-colors duration-200 group"
                style={{ background: color.surface }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = color.elevated;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = color.surface;
                }}
              >
                {/* Header row */}
                <div className="flex items-center justify-between mb-5">
                  <span
                    className="text-sm font-medium tracking-wide group-hover:underline underline-offset-4"
                    style={{ color: color.primary }}
                  >
                    {q.name}
                  </span>
                  <StatusBadge status={status} />
                </div>

                {/* Progress bar */}
                <ProgressBar segments={segments} total={total} />

                {/* Stats grid - full word labels, sans-serif */}
                <div className="grid grid-cols-5 gap-3 mt-5">
                  {[
                    { label: "Waiting", value: q.waiting },
                    { label: "Active", value: q.active },
                    { label: "Completed", value: q.completed },
                    { label: "Failed", value: q.failed, danger: q.failed > 0 },
                    { label: "Delayed", value: q.delayed },
                  ].map((col) => (
                    <div key={col.label}>
                      <p
                        className="text-[10px] uppercase tracking-widest mb-1"
                        style={{ color: color.subtleMuted, fontFamily: "inherit" }}
                      >
                        {col.label}
                      </p>
                      <p
                        className="text-lg font-semibold tabular-nums"
                        style={{ color: col.danger ? color.failedText : color.primary }}
                      >
                        {col.value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Total footer */}
                <div
                  className="mt-4 pt-4 flex items-center justify-between"
                  style={{ borderTop: `1px solid ${color.border}` }}
                >
                  <span
                    className="text-[10px] uppercase tracking-widest"
                    style={{ color: color.subtleMuted, fontFamily: "inherit" }}
                  >
                    Total
                  </span>
                  <span
                    className="text-sm font-semibold tabular-nums"
                    style={{ color: color.muted }}
                  >
                    {formatNumber(total)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* ── Legend ──────────────────────────────────────────────── */}
      <div className="mt-8 flex flex-wrap items-center gap-6">
        <LegendItem shade={color.completed} label="Completed" />
        <LegendItem shade={color.active} label="Active" />
        <LegendItem shade={color.waiting} label="Waiting" />
        <LegendItem shade={color.failed} label="Failed" />
        <LegendItem shade={color.delayed} label="Delayed" />
      </div>
    </>
  );
}
