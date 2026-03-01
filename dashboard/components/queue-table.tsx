"use client";

import { useState, useCallback } from "react";
import { timeAgo, truncate } from "@/lib/utils";
import { StatusDot } from "./status-dot";

interface Job {
  id: string | number;
  name: string;
  data: unknown;
  timestamp: number | string;
  processedOn?: number | string | null;
  finishedOn?: number | string | null;
  attempts: number;
  failedReason?: string | null;
  returnvalue?: unknown;
}

interface QueueTableProps {
  jobs: Job[];
  status: "completed" | "failed" | "active" | "waiting" | "delayed";
}

function jobStatusDot(
  status: QueueTableProps["status"]
): "ok" | "error" | "warn" | "unknown" {
  switch (status) {
    case "completed":
      return "ok";
    case "failed":
      return "error";
    case "active":
      return "ok";
    case "waiting":
    case "delayed":
      return "unknown";
    default:
      return "unknown";
  }
}

function computeDuration(
  processedOn?: number | string | null,
  finishedOn?: number | string | null
): string {
  if (!processedOn || !finishedOn) return "--";
  const start =
    typeof processedOn === "string"
      ? new Date(processedOn).getTime()
      : processedOn;
  const end =
    typeof finishedOn === "string"
      ? new Date(finishedOn).getTime()
      : finishedOn;
  const ms = end - start;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function safeStringify(data: unknown): string {
  try {
    return typeof data === "string" ? data : JSON.stringify(data);
  } catch {
    return String(data);
  }
}

/** Tiny copy-to-clipboard icon button */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback: silent fail
    }
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center justify-center w-5 h-5 rounded opacity-0 group-hover/row:opacity-60 hover:!opacity-100 transition-opacity duration-150 text-[#656453] hover:text-[#d4d3cc]"
      title="Copy job ID"
      aria-label={`Copy job ID ${text}`}
    >
      {copied ? (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2.5 6.5L5 9l4.5-6" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3.5" y="3.5" width="6" height="6" rx="1" />
          <path d="M8.5 3.5V2.5a1 1 0 00-1-1h-5a1 1 0 00-1 1v5a1 1 0 001 1h1" />
        </svg>
      )}
    </button>
  );
}

const TH =
  "text-left text-[10px] uppercase tracking-widest text-[#7A7968] font-normal pb-2 pr-4";
const TD = "py-2 pr-4 text-sm text-[#d4d3cc] font-mono whitespace-nowrap";

export function QueueTable({ jobs, status }: QueueTableProps) {
  if (jobs.length === 0) {
    return (
      <p className="text-sm text-[#7A7968] py-8 text-center">
        No jobs in this state.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-[#2A2B28]">
            <th className={TH}>ID</th>
            <th className={TH}>Status</th>
            <th className={TH}>Data</th>
            <th className={TH}>Created</th>
            <th className={TH}>Duration</th>
            <th className={TH}>Attempts</th>
            <th className={TH}>Error</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job, index) => {
            const isEven = index % 2 === 0;
            return (
              <tr
                key={job.id}
                className="group/row border-b border-[#1A1B19] transition-colors duration-150 hover:!bg-[#1A1B19]"
                style={{ backgroundColor: isEven ? "#141513" : "#181917" }}
              >
                <td className={TD}>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-xs font-mono text-[#9A9880]">
                      {job.id}
                    </span>
                    <CopyButton text={String(job.id)} />
                  </span>
                </td>
                <td className={`${TD} flex items-center gap-2`}>
                  <StatusDot status={jobStatusDot(status)} />
                  <span className="text-xs text-[#7A7968]">{status}</span>
                </td>
                <td className={TD}>
                  <span title={safeStringify(job.data)}>
                    {truncate(safeStringify(job.data), 48)}
                  </span>
                </td>
                <td className={TD}>{timeAgo(job.timestamp)}</td>
                <td className={TD}>
                  {computeDuration(job.processedOn, job.finishedOn)}
                </td>
                <td className={TD}>{job.attempts}</td>
                <td className={TD}>
                  {job.failedReason ? (
                    <span
                      className="text-[#9A9880]"
                      title={job.failedReason}
                    >
                      {truncate(job.failedReason, 40)}
                    </span>
                  ) : (
                    <span className="text-[#656453]">--</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
