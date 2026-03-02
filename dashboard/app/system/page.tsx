"use client";

import { useSystemHealth, useCronRuns, useLogs } from "@/lib/hooks";
import { PageHeader } from "@/components/page-header";
import { HealthGrid } from "@/components/health-grid";
import { CronTable } from "@/components/cron-table";
import { StatusDot } from "@/components/status-dot";
import { timeAgo, truncate } from "@/lib/utils";

/* ── Skeleton ─────────────────────────────────────────────────── */
function Skeleton({ className }: { className?: string }) {
  return <div className={`skeleton ${className || ""}`} />;
}

/* ── Section Heading ──────────────────────────────────────────── */
function SectionHeading({
  children,
  count,
}: {
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div
        className="w-[3px] h-4 rounded-full"
        style={{ background: "var(--text-secondary)" }}
      />
      <h2
        className="text-sm font-medium tracking-wide"
        style={{ color: "var(--text-secondary)" }}
      >
        {children}
      </h2>
      {count !== undefined && (
        <span
          className="text-[11px] font-medium px-2 py-0.5 rounded-full"
          style={{ color: "var(--text-subtle)", background: "var(--bg-hover)" }}
        >
          {count}
        </span>
      )}
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
    <div className="animate-enter">
      {/* Header with live indicator */}
      <div className="flex items-center gap-3 mb-10">
        <PageHeader title="System" />
        <span
          className="inline-block w-2 h-2 rounded-full live-dot"
          style={{ background: "var(--success)" }}
        />
      </div>

      {/* ── Services ─────────────────────────────────────────────── */}
      <div className="mb-12">
        <SectionHeading>Services</SectionHeading>

        {healthLoading || !health ? (
          <div
            className="grid grid-cols-1 md:grid-cols-3 gap-px overflow-hidden"
            style={{
              background: "var(--border)",
              borderRadius: "var(--radius-md)",
            }}
          >
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="p-6"
                style={{ background: "var(--bg-surface)" }}
              >
                <Skeleton className="h-3 w-20 mb-3 rounded" />
                <Skeleton className="h-6 w-16 mb-2 rounded" />
                <Skeleton className="h-1 w-full rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div
            className="overflow-hidden stagger"
            style={{ borderRadius: "var(--radius-md)" }}
          >
            <HealthGrid services={health} />
          </div>
        )}
      </div>

      {/* ── Scheduled Tasks ──────────────────────────────────────── */}
      <div className="mb-12">
        <SectionHeading count={cronRuns?.length}>
          Scheduled Tasks
        </SectionHeading>

        <div
          className="overflow-hidden"
          style={{
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            background: "var(--bg-surface)",
          }}
        >
          {cronLoading || !cronRuns ? (
            <div className="p-5 space-y-3 stagger">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full rounded" />
              ))}
            </div>
          ) : (
            <CronTable runs={cronRuns} />
          )}
        </div>
      </div>

      {/* ── Recent Activity ──────────────────────────────────────── */}
      <div className="mb-6">
        <SectionHeading count={logs?.length}>Recent Activity</SectionHeading>

        <div
          className="overflow-hidden"
          style={{
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            background: "var(--bg-surface)",
          }}
        >
          {logsLoading || !logs ? (
            <div className="p-5 space-y-3 stagger">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full rounded" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <p
              className="p-8 text-center text-xs"
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
                  {logs.slice(0, 50).map((log) => (
                    <tr key={log.id} className="hoverable-row">
                      <td
                        className="font-mono"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {log.queueName}
                      </td>
                      <td
                        className="font-mono"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {log.jobId}
                      </td>
                      <td>
                        <span className="flex items-center gap-1.5">
                          <StatusDot status={mapLogStatus(log.status)} pulse />
                          <span
                            className="text-xs font-mono"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {log.status}
                          </span>
                        </span>
                      </td>
                      <td
                        className="font-mono text-xs"
                        style={{
                          color: log.error
                            ? "var(--error)"
                            : "var(--text-subtle)",
                        }}
                      >
                        {log.error ? truncate(log.error, 60) : "\u2014"}
                      </td>
                      <td
                        className="text-xs"
                        style={{ color: "var(--text-subtle)" }}
                      >
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
