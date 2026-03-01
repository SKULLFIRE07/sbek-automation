"use client";

import Link from "next/link";
import { useQueues, useStats } from "@/lib/hooks";
import type { QueueItem } from "@/lib/hooks";
import { PageHeader } from "@/components/page-header";
import { StatusDot } from "@/components/status-dot";
import { formatNumber } from "@/lib/utils";

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse ${className || ""}`}
      style={{ background: "#1A1B19" }}
    />
  );
}

function deriveStatus(q: QueueItem): "ok" | "error" | "warn" | "unknown" {
  if (q.failed > 0) return "error";
  if (q.active > 0) return "ok";
  const total = q.waiting + q.active + q.completed + q.failed + q.delayed;
  if (total === 0) return "unknown";
  return "ok";
}

function StatusBadge({ status }: { status: "ok" | "error" | "warn" | "unknown" }) {
  const labels: Record<string, string> = {
    ok: "Healthy",
    error: "Failing",
    warn: "Degraded",
    unknown: "Idle",
  };
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider"
      style={{ color: "#9A9880" }}>
      <StatusDot status={status} />
      {labels[status]}
    </span>
  );
}

function ProgressBar({ segments, total }: { segments: { label: string; value: number; shade: string }[]; total: number }) {
  if (total === 0) return (
    <div className="h-1.5 w-full" style={{ background: "#1A1B19" }} />
  );
  return (
    <div className="flex h-1.5 w-full overflow-hidden" style={{ background: "#1A1B19" }}>
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

export default function QueuesPage() {
  const { data: queues, isLoading } = useQueues();
  const { data: stats } = useStats();

  const totalJobs = queues?.reduce((sum, q) => sum + q.waiting + q.active + q.completed + q.failed + q.delayed, 0) ?? 0;
  const totalFailed = queues?.reduce((sum, q) => sum + q.failed, 0) ?? 0;
  const totalActive = queues?.reduce((sum, q) => sum + q.active, 0) ?? 0;
  const totalWaiting = queues?.reduce((sum, q) => sum + q.waiting, 0) ?? 0;

  return (
    <>
      <PageHeader title="Queues" subtitle={`${queues?.length ?? "..."} queues registered`} />

      {/* Summary strip */}
      <div className="grid grid-cols-4 gap-px mb-8" style={{ background: "#2A2B28" }}>
        {[
          { label: "Total Jobs", value: formatNumber(totalJobs) },
          { label: "Active", value: formatNumber(totalActive) },
          { label: "Waiting", value: formatNumber(totalWaiting) },
          { label: "Failed", value: formatNumber(totalFailed), highlight: totalFailed > 0 },
        ].map((item) => (
          <div key={item.label} className="px-5 py-4" style={{ background: "#141513" }}>
            <p className="text-[10px] uppercase tracking-widest font-mono mb-1" style={{ color: "#7A7968" }}>
              {item.label}
            </p>
            <p className="text-xl font-mono font-bold"
              style={{ color: item.highlight ? "#f87171" : "#d4d3cc" }}>
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {/* Queue cards grid */}
      {isLoading || !queues ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px" style={{ background: "#2A2B28" }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-6" style={{ background: "#141513" }}>
              <Skeleton className="h-4 w-32 mb-4" />
              <Skeleton className="h-1.5 w-full mb-4" />
              <div className="flex gap-6">
                <Skeleton className="h-12 w-16" />
                <Skeleton className="h-12 w-16" />
                <Skeleton className="h-12 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px" style={{ background: "#2A2B28" }}>
          {queues.map((q) => {
            const total = q.waiting + q.active + q.completed + q.failed + q.delayed;
            const status = deriveStatus(q);
            const segments = [
              { label: "Completed", value: q.completed, shade: "#4A4B47" },
              { label: "Active", value: q.active, shade: "#C5A572" },
              { label: "Waiting", value: q.waiting, shade: "#656453" },
              { label: "Failed", value: q.failed, shade: "#7A7968" },
              { label: "Delayed", value: q.delayed, shade: "#656453" },
            ];

            return (
              <Link
                key={q.name}
                href={`/queues/${encodeURIComponent(q.name)}`}
                className="block p-6 transition-colors group"
                style={{ background: "#141513" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#1A1B19"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#141513"; }}
              >
                {/* Header row */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm group-hover:underline" style={{ color: "#d4d3cc" }}>
                      {q.name}
                    </span>
                  </div>
                  <StatusBadge status={status} />
                </div>

                {/* Progress bar */}
                <ProgressBar segments={segments} total={total} />

                {/* Stats grid */}
                <div className="grid grid-cols-5 gap-2 mt-4">
                  {[
                    { label: "WAIT", value: q.waiting },
                    { label: "ACTV", value: q.active },
                    { label: "DONE", value: q.completed },
                    { label: "FAIL", value: q.failed, danger: q.failed > 0 },
                    { label: "DELY", value: q.delayed },
                  ].map((col) => (
                    <div key={col.label}>
                      <p className="text-[9px] font-mono uppercase tracking-widest mb-0.5"
                        style={{ color: "#656453" }}>
                        {col.label}
                      </p>
                      <p className="text-lg font-mono font-bold"
                        style={{ color: col.danger ? "#f87171" : "#d4d3cc" }}>
                        {col.value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Total footer */}
                <div className="mt-3 pt-3 flex items-center justify-between"
                  style={{ borderTop: "1px solid #1A1B19" }}>
                  <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "#656453" }}>
                    Total
                  </span>
                  <span className="text-sm font-mono font-bold" style={{ color: "#9A9880" }}>
                    {formatNumber(total)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="mt-6 flex items-center gap-6 text-[10px] font-mono" style={{ color: "#656453" }}>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-1.5" style={{ background: "#4A4B47" }} /> Completed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-1.5" style={{ background: "#C5A572" }} /> Active
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-1.5" style={{ background: "#656453" }} /> Waiting
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-1.5" style={{ background: "#7A7968" }} /> Failed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-1.5" style={{ background: "#656453" }} /> Delayed
        </span>
      </div>
    </>
  );
}
