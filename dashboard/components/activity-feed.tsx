"use client";

import { timeAgo } from "@/lib/utils";
import { StatusDot } from "./status-dot";

interface ActivityItem {
  id: string | number;
  source: string;
  event: string;
  createdAt: number | string;
  processed: boolean;
}

interface ActivityFeedProps {
  items: ActivityItem[];
}

export function ActivityFeed({ items }: ActivityFeedProps) {
  if (items.length === 0) {
    return (
      <p className="text-sm py-8 text-center" style={{ color: "var(--text-subtle)" }}>
        No recent activity.
      </p>
    );
  }

  return (
    <div className="max-h-[480px] overflow-y-auto pb-8">
      {items.map((item, i) => {
        const isProcessed = item.processed;
        return (
          <div
            key={item.id}
            className={`timeline-item ${
              isProcessed ? "timeline-processed" : ""
            } row-hover flex gap-4 py-2.5 px-4`}
            style={{
              borderBottom:
                i < items.length - 1 ? "1px solid var(--border-subtle)" : "none",
              background: isProcessed ? "transparent" : "var(--bg-surface)",
            }}
          >
            {/* Timestamp */}
            <span
              className="font-mono text-xs shrink-0 w-16"
              style={{ color: "var(--text-subtle)" }}
            >
              {timeAgo(item.createdAt)}
            </span>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <p
                className="text-sm truncate"
                style={{ color: isProcessed ? "var(--text-muted)" : "var(--text-secondary)" }}
              >
                <span className="badge text-[10px] font-mono uppercase tracking-wider mr-2">
                  {item.source}
                </span>
                {item.event}
              </p>
            </div>

            {/* Status indicator */}
            <span className="ml-auto shrink-0 flex items-center gap-1.5 self-center">
              <StatusDot
                status={isProcessed ? "ok" : "warn"}
                pulse={!isProcessed}
                size="sm"
              />
              <span
                className="text-[10px] font-mono"
                style={{ color: isProcessed ? "var(--text-subtle)" : "var(--warning)" }}
              >
                {isProcessed ? "done" : "pending"}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
