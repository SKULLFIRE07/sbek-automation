"use client";

import { useState, useEffect, useRef } from "react";
import {
  useSystemHealth,
  useCronRuns,
  useLogs,
  type ServiceHealth,
  type CronRun,
  type LogEntry,
} from "@/lib/hooks";
import { PageHeader } from "@/components/page-header";
import { HealthGrid } from "@/components/health-grid";
import { CronTable } from "@/components/cron-table";
import { StatusDot } from "@/components/status-dot";
import { timeAgo, truncate } from "@/lib/utils";

/* ── Skeleton ─────────────────────────────────────────────────── */
function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse ${className || ""}`}
      style={{ background: "#111" }}
    />
  );
}

/* ── Section Divider ──────────────────────────────────────────── */
function SectionHeading({
  children,
  count,
}: {
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <div className="section-divider mb-4 mt-2">
      <h2
        className="text-xs uppercase tracking-widest font-medium shrink-0"
        style={{ color: "#666" }}
      >
        {children}
      </h2>
      {count !== undefined && (
        <span
          className="text-[10px] font-mono shrink-0"
          style={{ color: "#555" }}
        >
          {count}
        </span>
      )}
    </div>
  );
}

/* ── Uptime Counter ───────────────────────────────────────────── */
function UptimeCounter() {
  const mountedAt = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const tick = () => setElapsed(Date.now() - mountedAt.current);
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const totalSec = Math.floor(elapsed / 1000);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 rounded"
      style={{ background: "#0a0a0a", border: "1px solid #1a1a1a" }}
    >
      <span className="text-[10px] uppercase tracking-widest" style={{ color: "#555" }}>
        Session Uptime
      </span>
      <span className="font-mono text-sm" style={{ color: "#e5e5e5" }}>
        {pad(hrs)}:{pad(mins)}:{pad(secs)}
      </span>
    </div>
  );
}

/* ── Last Checked Indicator ───────────────────────────────────── */
function LastChecked({ refreshIntervalMs }: { refreshIntervalMs: number }) {
  const [secondsAgo, setSecondsAgo] = useState(0);
  const lastRefresh = useRef(Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastRefresh.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Reset when the interval fires
  useEffect(() => {
    const id = setInterval(() => {
      lastRefresh.current = Date.now();
      setSecondsAgo(0);
    }, refreshIntervalMs);
    return () => clearInterval(id);
  }, [refreshIntervalMs]);

  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-block w-1.5 h-1.5 rounded-full live-dot"
        style={{ background: "#22c55e" }}
      />
      <span className="text-[10px] font-mono" style={{ color: "#555" }}>
        checked {secondsAgo}s ago
      </span>
    </div>
  );
}

/* ── Log Status Mapping ───────────────────────────────────────── */
function mapLogStatus(status: string): "ok" | "error" | "warn" | "unknown" {
  switch (status.toLowerCase()) {
    case "completed":
    case "success":
      return "ok";
    case "failed":
    case "error":
      return "error";
    case "active":
    case "running":
      return "warn";
    default:
      return "unknown";
  }
}

/* ── Main Page ────────────────────────────────────────────────── */
export default function SystemPage() {
  const { data: health, isLoading: healthLoading } = useSystemHealth();
  const { data: cronRuns, isLoading: cronLoading } = useCronRuns();
  const { data: logs, isLoading: logsLoading } = useLogs();

  return (
    <>
      <PageHeader title="System" subtitle="Health, cron, and logs" />

      {/* Top bar: uptime + last checked */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <UptimeCounter />
        <LastChecked refreshIntervalMs={10_000} />
      </div>

      {/* ── Health Grid ─────────────────────────────────────────── */}
      <div className="mb-10">
        <SectionHeading>Service Health</SectionHeading>

        {healthLoading || !health ? (
          <div
            className="grid grid-cols-1 md:grid-cols-3 gap-px"
            style={{ background: "#222" }}
          >
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-5" style={{ background: "#0a0a0a" }}>
                <Skeleton className="h-3 w-20 mb-3" />
                <Skeleton className="h-6 w-16 mb-2" />
                <Skeleton className="h-1 w-full" />
              </div>
            ))}
          </div>
        ) : (
          <HealthGrid services={health} />
        )}
      </div>

      {/* ── Cron Schedule ───────────────────────────────────────── */}
      <div className="mb-10">
        <SectionHeading count={cronRuns?.length}>
          Cron Schedule
        </SectionHeading>

        <div
          className="border rounded"
          style={{ borderColor: "#1a1a1a", background: "#0a0a0a" }}
        >
          {cronLoading || !cronRuns ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : (
            <CronTable runs={cronRuns} />
          )}
        </div>
      </div>

      {/* ── Recent Logs ─────────────────────────────────────────── */}
      <div className="mb-4">
        <SectionHeading count={logs?.length}>Recent Logs</SectionHeading>

        <div
          className="border rounded"
          style={{ borderColor: "#1a1a1a", background: "#0a0a0a" }}
        >
          {logsLoading || !logs ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <p
              className="p-6 text-center text-xs"
              style={{ color: "#666" }}
            >
              No log entries yet
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Queue</th>
                    <th>Job ID</th>
                    <th>Status</th>
                    <th>Error</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.slice(0, 50).map((log) => (
                    <tr key={log.id} className="hoverable-row">
                      <td className="font-mono" style={{ color: "#e5e5e5" }}>
                        {log.queueName}
                      </td>
                      <td className="font-mono" style={{ color: "#999" }}>
                        {log.jobId}
                      </td>
                      <td>
                        <span className="flex items-center gap-1.5">
                          <StatusDot status={mapLogStatus(log.status)} pulse />
                          <span
                            className="text-xs font-mono"
                            style={{ color: "#999" }}
                          >
                            {log.status}
                          </span>
                        </span>
                      </td>
                      <td
                        className="font-mono text-xs"
                        style={{ color: log.error ? "#f87171" : "#666" }}
                      >
                        {log.error ? truncate(log.error, 60) : "\u2014"}
                      </td>
                      <td className="text-xs" style={{ color: "#666" }}>
                        {timeAgo(log.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
