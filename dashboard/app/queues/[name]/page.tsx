"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQueueDetail } from "@/lib/hooks";
import { postApi } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { QueueTable } from "@/components/queue-table";
import { StatusDot } from "@/components/status-dot";
import { formatNumber } from "@/lib/utils";

type JobStatus = "completed" | "failed" | "active" | "waiting" | "delayed";

const STATUSES: JobStatus[] = ["completed", "failed", "active", "waiting", "delayed"];

function Skeleton({ className }: { className?: string }) {
  return <div className={`skeleton ${className || ""}`} />;
}

export default function QueueDetailPage() {
  const params = useParams();
  const name = decodeURIComponent(params.name as string);
  const [activeStatus, setActiveStatus] = useState<JobStatus>("completed");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const { data: detail, isLoading, mutate } = useQueueDetail(name);

  async function handleAction(action: "retry-all" | "clean") {
    setActionLoading(action);
    setActionResult(null);
    try {
      await postApi(`/dashboard/queues/${encodeURIComponent(name)}/${action}`);
      setActionResult({ type: "success", msg: action === "retry-all" ? "Failed jobs retried" : "Queue cleaned" });
      mutate();
    } catch {
      setActionResult({ type: "error", msg: `${action} failed` });
    } finally {
      setActionLoading(null);
      setTimeout(() => setActionResult(null), 3000);
    }
  }

  const counts = detail?.counts;
  const total = counts
    ? (counts.waiting ?? 0) + (counts.active ?? 0) + (counts.completed ?? 0) + (counts.failed ?? 0) + (counts.delayed ?? 0)
    : 0;

  const queueStatus = counts
    ? counts.failed > 0 ? "error" : counts.active > 0 ? "ok" : total === 0 ? "unknown" : "ok"
    : "unknown";

  const statusLabels: Record<string, string> = {
    ok: "Healthy", error: "Has failures", warn: "Degraded", unknown: "Idle",
  };

  /* Progress bar segment data — colors match queue-card & queues page */
  const progressSegments = [
    { key: "active" as const, shade: "#1A1A1A" },
    { key: "failed" as const, shade: "#C0392B" },
    { key: "waiting" as const, shade: "#999999" },
    { key: "delayed" as const, shade: "#B0B0B0" },
    { key: "completed" as const, shade: "#22C55E" },
  ];

  /* Calculate cumulative scaleX offset for each segment */
  const segmentWidths = counts
    ? progressSegments.map(({ key }) => (counts[key] ?? 0) / (total || 1))
    : [];

  return (
    <div className="animate-enter">
      {/* Breadcrumb */}
      <nav
        className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-widest mb-4"
        style={{ color: "var(--text-subtle)" }}
      >
        <Link
          href="/queues"
          className="transition-colors hover:text-[#1A1A1A]"
          style={{ color: "var(--text-subtle)" }}
        >
          Queues
        </Link>
        <span style={{ color: "var(--border-strong)" }}>/</span>
        <span style={{ color: "var(--text-muted)" }}>{name}</span>
      </nav>

      {/* Header bar */}
      <div
        className="flex items-center justify-between pb-4 mb-6"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div>
          <h1
            className="text-lg font-medium tracking-tight font-mono"
            style={{ color: "var(--text-secondary)" }}
          >
            {name}
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="badge text-[10px] font-mono uppercase tracking-wider">
              <StatusDot status={queueStatus as "ok" | "error" | "warn" | "unknown"} />
              {statusLabels[queueStatus]}
            </span>
            {counts && (
              <span className="text-[10px] font-mono" style={{ color: "var(--text-subtle)" }}>
                {formatNumber(total)} total jobs
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {actionResult && (
            <span
              className="text-[10px] font-mono mr-2 flex items-center gap-1"
              style={{ color: actionResult.type === "success" ? "var(--success)" : "var(--error)" }}
            >
              <StatusDot status={actionResult.type === "success" ? "ok" : "error"} />
              {actionResult.msg}
            </span>
          )}
          <button
            onClick={() => handleAction("retry-all")}
            disabled={actionLoading !== null}
            className="btn-ghost px-4 py-2 text-[11px] font-mono uppercase tracking-wider"
            style={{
              color: actionLoading === "retry-all" ? "var(--text-subtle)" : "var(--text-secondary)",
              background: actionLoading === "retry-all" ? "var(--bg-hover)" : "transparent",
            }}
          >
            {actionLoading === "retry-all" ? "Retrying..." : "Retry Failed"}
          </button>
          <button
            onClick={() => handleAction("clean")}
            disabled={actionLoading !== null}
            className="btn-ghost px-4 py-2 text-[11px] font-mono uppercase tracking-wider"
            style={{
              color: actionLoading === "clean" ? "var(--text-subtle)" : "var(--text-secondary)",
              background: actionLoading === "clean" ? "var(--bg-hover)" : "transparent",
            }}
          >
            {actionLoading === "clean" ? "Cleaning..." : "Clean"}
          </button>
        </div>
      </div>

      {/* Stats strip - individual rounded cards */}
      <div className="grid grid-cols-5 gap-3 mb-8">
        {isLoading || !counts ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="px-5 py-5"
              style={{
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
              }}
            >
              <Skeleton className="h-3 w-14 mb-2" />
              <Skeleton className="h-8 w-16" />
            </div>
          ))
        ) : (
          STATUSES.map((s) => {
            const val = counts[s] ?? 0;
            const isActive = activeStatus === s;
            return (
              <button
                key={s}
                onClick={() => setActiveStatus(s)}
                className={`tab text-left px-5 py-5 ${isActive ? "tab-active" : ""}`}
                style={{
                  border: isActive ? "1px solid var(--border-strong)" : "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                }}
              >
                <p
                  className="text-[10px] uppercase tracking-widest font-mono mb-1"
                  style={{ color: isActive ? "var(--text-muted)" : "var(--text-subtle)" }}
                >
                  {s}
                </p>
                <p
                  className="text-2xl font-mono font-bold"
                  style={{
                    color: s === "failed" && val > 0
                      ? "var(--error)"
                      : isActive ? "var(--text-secondary)" : "var(--text-subtle)",
                  }}
                >
                  {formatNumber(val)}
                </p>
              </button>
            );
          })
        )}
      </div>

      {/* Progress bar - scaleX for 60fps */}
      {counts && total > 0 && (
        <div className="mb-8">
          <div
            className="flex h-2 w-full overflow-hidden"
            style={{ background: "var(--bg-hover)", borderRadius: 999 }}
          >
            {progressSegments.map(({ key, shade }) => {
              const val = counts[key] ?? 0;
              const fraction = val / total;
              return fraction > 0 ? (
                <div
                  key={key}
                  className="h-full"
                  style={{
                    flex: `0 0 ${fraction * 100}%`,
                    background: shade,
                    transformOrigin: "left",
                    transform: "scaleX(1)",
                    transition: "transform 500ms cubic-bezier(0.16, 1, 0.3, 1)",
                    borderRadius: 999,
                  }}
                />
              ) : null;
            })}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[9px] font-mono" style={{ color: "var(--text-subtle)" }}>0</span>
            <span className="text-[9px] font-mono" style={{ color: "var(--text-subtle)" }}>{formatNumber(total)}</span>
          </div>
        </div>
      )}

      {/* Jobs table */}
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          background: "var(--bg)",
          overflow: "hidden",
        }}
      >
        <div
          className="px-5 py-3 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <span className="text-[10px] uppercase tracking-widest font-mono" style={{ color: "var(--text-subtle)" }}>
            {activeStatus} jobs
          </span>
          <span className="text-[10px] font-mono" style={{ color: "var(--text-subtle)" }}>
            showing up to 20 recent
          </span>
        </div>
        {isLoading || !detail ? (
          <div className="p-5 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        ) : (
          <QueueTable
            jobs={detail.recentJobs[activeStatus] || []}
            status={activeStatus}
          />
        )}
      </div>
    </div>
  );
}
