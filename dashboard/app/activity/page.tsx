"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  useWebhooks,
  useLogs,
  type WebhookEvent,
  type LogEntry,
} from "@/lib/hooks";
import { PageHeader } from "@/components/page-header";
import { StatusDot } from "@/components/status-dot";
import { timeAgo, truncate } from "@/lib/utils";

/* ── Skeleton ─────────────────────────────────────────────────── */
function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded ${className || ""}`}
      style={{ background: "var(--bg-hover)" }}
    />
  );
}

/* ── Live Indicator ───────────────────────────────────────────── */
function LiveIndicator({ intervalMs }: { intervalMs: number }) {
  const [secondsAgo, setSecondsAgo] = useState(0);
  const lastRefresh = useRef(Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastRefresh.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      lastRefresh.current = Date.now();
      setSecondsAgo(0);
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full live-dot"
      style={{ background: "var(--success)", boxShadow: "0 0 6px rgba(34,197,94,0.4)" }}
      title={secondsAgo > 0 ? `Updated ${secondsAgo}s ago` : "Live"}
    />
  );
}

/* ── Section Heading ──────────────────────────────────────────── */
function SectionHeading({
  children,
  count,
  right,
}: {
  children: React.ReactNode;
  count?: number;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-3 mt-1">
      <div className="flex items-center gap-3">
        <h2
          className="text-[13px] font-medium tracking-wide"
          style={{ color: "var(--text-secondary)" }}
        >
          {children}
        </h2>
        {count !== undefined && (
          <span
            className="text-[11px] font-normal tabular-nums"
            style={{ color: "var(--text-subtle)" }}
          >
            {count}
          </span>
        )}
      </div>
      {right && <div className="shrink-0 ml-4">{right}</div>}
    </div>
  );
}

/* ── Filter Tabs ──────────────────────────────────────────────── */
function FilterTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: string[];
  active: string;
  onChange: (tab: string) => void;
}) {
  return (
    <div className="flex gap-1.5 p-2 flex-wrap">
      {tabs.map((t) => {
        const isActive = active === t;
        return (
          <button
            key={t}
            onClick={() => onChange(t)}
            className={`tab text-[11px] font-medium whitespace-nowrap${isActive ? " tab-active" : ""}`}
          >
            {t}
          </button>
        );
      })}
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
export default function ActivityPage() {
  const { data: webhooks, isLoading: webhooksLoading } = useWebhooks();
  const { data: logs, isLoading: logsLoading } = useLogs();

  const [sourceFilter, setSourceFilter] = useState("All");

  // Derive unique sources for filter tabs
  const sourceOptions = useMemo(() => {
    if (!webhooks) return ["All"];
    const sources = Array.from(new Set(webhooks.map((w) => w.source)));
    sources.sort();
    return ["All", ...sources];
  }, [webhooks]);

  // Filtered webhooks
  const filteredWebhooks = useMemo(() => {
    if (!webhooks) return [];
    if (sourceFilter === "All") return webhooks;
    return webhooks.filter((w) => w.source === sourceFilter);
  }, [webhooks, sourceFilter]);

  // Stats
  const processedCount = filteredWebhooks.filter((w) => w.processed).length;
  const unprocessedCount = filteredWebhooks.length - processedCount;

  return (
    <div className="animate-enter">
      <PageHeader title="Activity" />

      {/* Top bar: subtle summary + live dot */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-8">
        <div className="flex items-center gap-3">
          {webhooks && (
            <div className="flex items-center gap-2">
              <span className="badge">
                {processedCount} processed
              </span>
              {unprocessedCount > 0 && (
                <span
                  className="badge"
                  style={{
                    color: "var(--warning)",
                    background: "rgba(245,158,11,0.06)",
                  }}
                >
                  {unprocessedCount} pending
                </span>
              )}
            </div>
          )}
        </div>
        <LiveIndicator intervalMs={10_000} />
      </div>

      {/* ── Events ─────────────────────────────────────────────── */}
      <div className="mb-10">
        <SectionHeading count={filteredWebhooks.length}>
          Events
        </SectionHeading>

        <div
          className="overflow-hidden"
          style={{
            border: "1px solid var(--border)",
            background: "var(--bg-surface)",
            borderRadius: "var(--radius-md)",
          }}
        >
          {/* Filter tabs */}
          {webhooks && webhooks.length > 0 && (
            <div style={{ borderBottom: "1px solid var(--border)" }}>
              <FilterTabs
                tabs={sourceOptions}
                active={sourceFilter}
                onChange={setSourceFilter}
              />
            </div>
          )}

          {webhooksLoading || !webhooks ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full rounded" />
              ))}
            </div>
          ) : filteredWebhooks.length === 0 ? (
            <p
              className="py-12 text-center text-xs"
              style={{ color: "var(--text-subtle)" }}
            >
              {sourceFilter === "All"
                ? "No events yet"
                : `No events from ${sourceFilter}`}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <div className="stagger">
                {filteredWebhooks.map((wh, idx) => {
                  const isProcessed = wh.processed;
                  return (
                    <div
                      key={wh.id}
                      className="row-hover flex items-center gap-5 px-5 py-4"
                      style={{
                        borderBottom:
                          idx < filteredWebhooks.length - 1
                            ? "1px solid var(--border-subtle)"
                            : "none",
                      }}
                    >
                      {/* ID */}
                      <span
                        className="font-mono text-xs shrink-0 w-14"
                        style={{ color: "var(--text-subtle)" }}
                      >
                        {typeof wh.id === "number"
                          ? `#${wh.id}`
                          : `#${String(wh.id).slice(0, 6)}`}
                      </span>

                      {/* Source badge */}
                      <span className="badge text-[10px] tracking-wide shrink-0">
                        {wh.source}
                      </span>

                      {/* Event name */}
                      <span
                        className="text-sm truncate min-w-0 flex-1"
                        style={{ color: isProcessed ? "var(--text-muted)" : "var(--text-secondary)" }}
                      >
                        {wh.event}
                      </span>

                      {/* Processed indicator */}
                      <span className="flex items-center gap-2 shrink-0">
                        <StatusDot
                          status={isProcessed ? "ok" : "warn"}
                          pulse={!isProcessed}
                        />
                        <span
                          className="text-[10px] font-medium"
                          style={{
                            color: isProcessed ? "var(--text-subtle)" : "var(--warning)",
                          }}
                        >
                          {isProcessed ? "done" : "pending"}
                        </span>
                      </span>

                      {/* Timestamp */}
                      <span
                        className="text-[11px] shrink-0"
                        style={{ color: "var(--text-subtle)" }}
                      >
                        {timeAgo(wh.createdAt)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Logs ───────────────────────────────────────────────── */}
      <div className="mb-6">
        <SectionHeading count={logs?.length}>Logs</SectionHeading>

        <div
          className="overflow-hidden"
          style={{
            border: "1px solid var(--border)",
            background: "var(--bg-surface)",
            borderRadius: "var(--radius-md)",
          }}
        >
          {logsLoading || !logs ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full rounded" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <p
              className="py-12 text-center text-xs"
              style={{ color: "var(--text-subtle)" }}
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
                  {logs.map((log) => (
                    <tr key={log.id} className="hoverable-row">
                      <td className="font-mono" style={{ color: "var(--text-secondary)" }}>
                        {log.queueName}
                      </td>
                      <td className="font-mono" style={{ color: "var(--text-muted)" }}>
                        {log.jobId}
                      </td>
                      <td>
                        <span className="flex items-center gap-2">
                          <StatusDot
                            status={mapLogStatus(log.status)}
                            pulse
                          />
                          <span
                            className="text-xs font-medium"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {log.status}
                          </span>
                        </span>
                      </td>
                      <td
                        className="font-mono text-xs"
                        style={{ color: log.error ? "var(--error)" : "var(--text-subtle)" }}
                      >
                        {log.error ? truncate(log.error, 60) : "\u2014"}
                      </td>
                      <td className="text-xs" style={{ color: "var(--text-subtle)" }}>
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
    </div>
  );
}
