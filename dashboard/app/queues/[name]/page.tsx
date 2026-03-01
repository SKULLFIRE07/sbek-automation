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
  return (
    <div
      className={`animate-pulse ${className || ""}`}
      style={{ background: "#111" }}
    />
  );
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

  return (
    <>
      {/* Breadcrumb + header */}
      <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest mb-4"
        style={{ color: "#555" }}>
        <Link href="/queues" className="hover:text-white transition-colors">Queues</Link>
        <span>/</span>
        <span style={{ color: "#999" }}>{name}</span>
      </div>

      <div className="flex items-center justify-between border-b pb-4 mb-6" style={{ borderColor: "#222" }}>
        <div>
          <h1 className="text-lg font-medium text-white tracking-tight font-mono">{name}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider"
              style={{ color: "#999" }}>
              <StatusDot status={queueStatus as "ok" | "error" | "warn" | "unknown"} />
              {statusLabels[queueStatus]}
            </span>
            {counts && (
              <span className="text-[10px] font-mono" style={{ color: "#555" }}>
                {formatNumber(total)} total jobs
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {actionResult && (
            <span className="text-[10px] font-mono mr-2 flex items-center gap-1"
              style={{ color: actionResult.type === "success" ? "#4ade80" : "#f87171" }}>
              <StatusDot status={actionResult.type === "success" ? "ok" : "error"} />
              {actionResult.msg}
            </span>
          )}
          <button
            onClick={() => handleAction("retry-all")}
            disabled={actionLoading !== null}
            className="px-4 py-2 text-[11px] font-mono uppercase tracking-wider border transition-all"
            style={{
              borderColor: "#333",
              color: actionLoading === "retry-all" ? "#555" : "#e5e5e5",
              background: actionLoading === "retry-all" ? "#111" : "transparent",
            }}
            onMouseEnter={(e) => { if (!actionLoading) e.currentTarget.style.background = "#1a1a1a"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = actionLoading ? "#111" : "transparent"; }}
          >
            {actionLoading === "retry-all" ? "Retrying..." : "Retry Failed"}
          </button>
          <button
            onClick={() => handleAction("clean")}
            disabled={actionLoading !== null}
            className="px-4 py-2 text-[11px] font-mono uppercase tracking-wider border transition-all"
            style={{
              borderColor: "#333",
              color: actionLoading === "clean" ? "#555" : "#e5e5e5",
              background: actionLoading === "clean" ? "#111" : "transparent",
            }}
            onMouseEnter={(e) => { if (!actionLoading) e.currentTarget.style.background = "#1a1a1a"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = actionLoading ? "#111" : "transparent"; }}
          >
            {actionLoading === "clean" ? "Cleaning..." : "Clean"}
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-5 gap-px mb-8" style={{ background: "#222" }}>
        {isLoading || !counts ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-5 py-5" style={{ background: "#0a0a0a" }}>
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
                className="text-left px-5 py-5 transition-all"
                style={{
                  background: isActive ? "#111" : "#0a0a0a",
                  borderBottom: isActive ? "2px solid #fff" : "2px solid transparent",
                }}
              >
                <p className="text-[10px] uppercase tracking-widest font-mono mb-1"
                  style={{ color: isActive ? "#999" : "#555" }}>
                  {s}
                </p>
                <p className="text-2xl font-mono font-bold"
                  style={{
                    color: s === "failed" && val > 0
                      ? "#f87171"
                      : isActive ? "#fff" : "#666",
                  }}>
                  {formatNumber(val)}
                </p>
              </button>
            );
          })
        )}
      </div>

      {/* Progress bar */}
      {counts && total > 0 && (
        <div className="mb-8">
          <div className="flex h-2 w-full overflow-hidden" style={{ background: "#1a1a1a" }}>
            {[
              { key: "completed", shade: "#444" },
              { key: "active", shade: "#fff" },
              { key: "waiting", shade: "#666" },
              { key: "failed", shade: "#888" },
              { key: "delayed", shade: "#555" },
            ].map(({ key, shade }) => {
              const val = counts[key] ?? 0;
              return val > 0 ? (
                <div
                  key={key}
                  className="h-full transition-all duration-500"
                  style={{ width: `${(val / total) * 100}%`, background: shade }}
                />
              ) : null;
            })}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[9px] font-mono" style={{ color: "#444" }}>0</span>
            <span className="text-[9px] font-mono" style={{ color: "#444" }}>{formatNumber(total)}</span>
          </div>
        </div>
      )}

      {/* Jobs table */}
      <div className="border" style={{ borderColor: "#222", background: "#0a0a0a" }}>
        <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid #222" }}>
          <span className="text-[10px] uppercase tracking-widest font-mono" style={{ color: "#555" }}>
            {activeStatus} jobs
          </span>
          <span className="text-[10px] font-mono" style={{ color: "#444" }}>
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
    </>
  );
}
