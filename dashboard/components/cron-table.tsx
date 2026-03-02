"use client";

import { timeAgo } from "@/lib/utils";
import { StatusDot } from "./status-dot";

interface CronRun {
  jobName: string;
  startedAt: number | string;
  completedAt?: number | string | null;
  itemsProcessed?: number;
  error?: string | null;
}

interface CronTableProps {
  runs: CronRun[];
}

function deriveStatus(run: CronRun): {
  dot: "ok" | "error" | "warn" | "unknown";
  label: string;
} {
  if (run.error) return { dot: "error", label: "failed" };
  if (run.completedAt) return { dot: "ok", label: "completed" };
  return { dot: "warn", label: "running" };
}

const TH =
  "text-left text-[10px] uppercase tracking-widest font-normal pb-2 pr-4";
const TD = "py-2 pr-4 text-sm font-mono whitespace-nowrap";

export function CronTable({ runs }: CronTableProps) {
  if (runs.length === 0) {
    return (
      <p
        className="text-sm py-8 text-center"
        style={{ color: "var(--text-subtle)" }}
      >
        No cron runs recorded.
      </p>
    );
  }

  return (
    <div
      className="overflow-x-auto"
      style={{ borderRadius: "var(--radius-md)", overflow: "hidden" }}
    >
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th className={TH} style={{ color: "var(--text-subtle)" }}>
              Job Name
            </th>
            <th className={TH} style={{ color: "var(--text-subtle)" }}>
              Started
            </th>
            <th className={TH} style={{ color: "var(--text-subtle)" }}>
              Completed
            </th>
            <th className={TH} style={{ color: "var(--text-subtle)" }}>
              Items Processed
            </th>
            <th className={TH} style={{ color: "var(--text-subtle)" }}>
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run, i) => {
            const st = deriveStatus(run);
            return (
              <tr
                key={`${run.jobName}-${i}`}
                className="hoverable-row"
              >
                <td className={TD} style={{ color: "var(--text-secondary)" }}>
                  {run.jobName}
                </td>
                <td className={TD} style={{ color: "var(--text-muted)" }}>
                  {timeAgo(run.startedAt)}
                </td>
                <td className={TD} style={{ color: "var(--text-muted)" }}>
                  {run.completedAt ? timeAgo(run.completedAt) : "--"}
                </td>
                <td className={TD} style={{ color: "var(--text-muted)" }}>
                  {run.itemsProcessed !== undefined
                    ? run.itemsProcessed
                    : "--"}
                </td>
                <td className={`${TD} flex items-center gap-2`}>
                  <StatusDot status={st.dot} pulse />
                  <span className="text-xs" style={{ color: "var(--text-subtle)" }}>
                    {st.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
