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
      className={`animate-pulse ${className || ""}`}
      style={{ background: "#1A1B19" }}
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
    <div className="flex items-center gap-2">
      <span
        className="inline-block w-1.5 h-1.5 rounded-full live-dot"
        style={{ background: "#C5A572" }}
      />
      <span className="text-[10px] font-mono" style={{ color: "#656453" }}>
        live {secondsAgo > 0 ? `\u00b7 ${secondsAgo}s ago` : ""}
      </span>
    </div>
  );
}

/* ── Section Divider ──────────────────────────────────────────── */
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
    <div className="flex items-center justify-between mb-4 mt-2">
      <div className="section-divider flex-1">
        <h2
          className="text-xs uppercase tracking-widest font-medium shrink-0"
          style={{ color: "#7A7968" }}
        >
          {children}
        </h2>
        {count !== undefined && (
          <span
            className="text-[10px] font-mono shrink-0"
            style={{ color: "#656453" }}
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
    <div
      className="flex gap-0 overflow-x-auto"
      style={{ borderBottom: "1px solid #1A1B19" }}
    >
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={`filter-tab px-3 py-2 text-[11px] uppercase tracking-wider font-medium whitespace-nowrap ${
            active === tab ? "filter-tab-active" : ""
          }`}
          style={{ color: active === tab ? "#C5A572" : "#656453" }}
        >
          {tab}
        </button>
      ))}
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
    <>
      <PageHeader title="Activity" subtitle="Recent webhooks and job events" />

      {/* Top bar with live indicator */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-4">
          {webhooks && (
            <>
              <span className="text-[10px] font-mono" style={{ color: "#656453" }}>
                <span style={{ color: "#C5A572" }}>{processedCount}</span>
                {" processed"}
              </span>
              <span className="text-[10px] font-mono" style={{ color: "#656453" }}>
                <span style={{ color: "#f59e0b" }}>{unprocessedCount}</span>
                {" pending"}
              </span>
            </>
          )}
        </div>
        <LiveIndicator intervalMs={10_000} />
      </div>

      {/* ── Webhook Events ──────────────────────────────────────── */}
      <div className="mb-10">
        <SectionHeading count={filteredWebhooks.length}>
          Webhook Events
        </SectionHeading>

        <div
          className="border rounded overflow-hidden"
          style={{ borderColor: "#1A1B19", background: "#141513" }}
        >
          {/* Filter tabs */}
          {webhooks && webhooks.length > 0 && (
            <FilterTabs
              tabs={sourceOptions}
              active={sourceFilter}
              onChange={setSourceFilter}
            />
          )}

          {webhooksLoading || !webhooks ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : filteredWebhooks.length === 0 ? (
            <p
              className="p-6 text-center text-xs"
              style={{ color: "#7A7968" }}
            >
              {sourceFilter === "All"
                ? "No webhook events yet"
                : `No events from ${sourceFilter}`}
            </p>
          ) : (
            <div className="overflow-x-auto">
              {/* Timeline-style list */}
              <div>
                {filteredWebhooks.map((wh, idx) => {
                  const isProcessed = wh.processed;
                  return (
                    <div
                      key={wh.id}
                      className={`timeline-item ${
                        isProcessed ? "timeline-processed" : ""
                      } flex items-center gap-4 px-4 py-3 transition-colors duration-150`}
                      style={{
                        borderBottom:
                          idx < filteredWebhooks.length - 1
                            ? "1px solid #1A1B19"
                            : "none",
                        paddingLeft: "16px",
                        marginLeft: "0",
                        background: isProcessed ? "transparent" : "#141513",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "#1A1B19")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = isProcessed
                          ? "transparent"
                          : "#141513")
                      }
                    >
                      {/* ID */}
                      <span
                        className="font-mono text-xs shrink-0 w-12"
                        style={{ color: "#656453" }}
                      >
                        {typeof wh.id === "number"
                          ? `#${wh.id}`
                          : `#${String(wh.id).slice(0, 6)}`}
                      </span>

                      {/* Source badge */}
                      <span
                        className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded shrink-0"
                        style={{
                          color: "#9A9880",
                          background: "#1A1B19",
                          border: "1px solid #2A2B28",
                        }}
                      >
                        {wh.source}
                      </span>

                      {/* Event name */}
                      <span
                        className="text-sm truncate min-w-0 flex-1"
                        style={{ color: isProcessed ? "#9A9880" : "#d4d3cc" }}
                      >
                        {wh.event}
                      </span>

                      {/* Processed indicator */}
                      <span className="flex items-center gap-1.5 shrink-0">
                        <StatusDot
                          status={isProcessed ? "ok" : "warn"}
                          pulse={!isProcessed}
                        />
                        <span
                          className="text-[10px] font-mono"
                          style={{
                            color: isProcessed ? "#656453" : "#f59e0b",
                          }}
                        >
                          {isProcessed ? "done" : "pending"}
                        </span>
                      </span>

                      {/* Timestamp */}
                      <span
                        className="text-[11px] font-mono shrink-0"
                        style={{ color: "#656453" }}
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

      {/* ── Recent Logs ─────────────────────────────────────────── */}
      <div className="mb-4">
        <SectionHeading count={logs?.length}>Recent Logs</SectionHeading>

        <div
          className="border rounded"
          style={{ borderColor: "#1A1B19", background: "#141513" }}
        >
          {logsLoading || !logs ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <p
              className="p-6 text-center text-xs"
              style={{ color: "#7A7968" }}
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
                      <td className="font-mono" style={{ color: "#d4d3cc" }}>
                        {log.queueName}
                      </td>
                      <td className="font-mono" style={{ color: "#9A9880" }}>
                        {log.jobId}
                      </td>
                      <td>
                        <span className="flex items-center gap-1.5">
                          <StatusDot
                            status={mapLogStatus(log.status)}
                            pulse
                          />
                          <span
                            className="text-xs font-mono"
                            style={{ color: "#9A9880" }}
                          >
                            {log.status}
                          </span>
                        </span>
                      </td>
                      <td
                        className="font-mono text-xs"
                        style={{ color: log.error ? "#f87171" : "#7A7968" }}
                      >
                        {log.error ? truncate(log.error, 60) : "\u2014"}
                      </td>
                      <td className="text-xs" style={{ color: "#7A7968" }}>
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
