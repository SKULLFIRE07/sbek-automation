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
      <p className="text-sm py-8 text-center" style={{ color: "#555" }}>
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
            } flex gap-4 py-2.5 px-4`}
            style={{
              borderBottom:
                i < items.length - 1 ? "1px solid #111" : "none",
              transition: "background 0.15s ease",
              background: isProcessed ? "transparent" : "#0a0a0a",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#111";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isProcessed
                ? "transparent"
                : "#0a0a0a";
            }}
          >
            {/* Timestamp */}
            <span
              className="font-mono text-xs shrink-0 w-16"
              style={{ color: "#555" }}
            >
              {timeAgo(item.createdAt)}
            </span>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <p
                className="text-sm truncate"
                style={{ color: isProcessed ? "#999" : "#e5e5e5" }}
              >
                <span
                  className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded mr-2"
                  style={{
                    color: "#999",
                    background: "#1a1a1a",
                    border: "1px solid #222",
                  }}
                >
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
                style={{ color: isProcessed ? "#555" : "#f59e0b" }}
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
