"use client";

import Link from "next/link";
import { StatusDot } from "./status-dot";
import type { QueueItem } from "@/lib/hooks";

export function QueueCard({ name, active, completed, delayed, failed, paused, waiting }: QueueItem) {
  const total = waiting + active + completed + failed + delayed;

  const status: "ok" | "error" | "warn" | "unknown" =
    failed > 0 ? "error" : active > 0 ? "ok" : total === 0 ? "unknown" : "ok";

  const segments = [
    { key: "waiting", count: waiting, color: "#656453" },
    { key: "active", count: active, color: "#C5A572" },
    { key: "completed", count: completed, color: "#3A3B37" },
    { key: "failed", count: failed, color: "#4A4B47" },
    { key: "delayed", count: delayed, color: "#4A4B47" },
  ];

  return (
    <Link
      href={`/queues/${encodeURIComponent(name)}`}
      className="block p-4"
      style={{
        background: "#141513",
        borderColor: "#2A2B28",
        transition: "transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "scale(1.02)";
        e.currentTarget.style.boxShadow = "0 0 0 1px #3A3B37, 0 4px 20px rgba(0,0,0,0.4)";
        e.currentTarget.style.background = "#1A1B19";
        e.currentTarget.style.zIndex = "10";
        e.currentTarget.style.position = "relative";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.background = "#141513";
        e.currentTarget.style.zIndex = "auto";
        e.currentTarget.style.position = "relative";
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-sm" style={{ color: "#d4d3cc" }}>
          {name}
        </span>
        <StatusDot status={status} />
      </div>

      {/* Mini horizontal bar */}
      <div
        className="flex h-1 w-full overflow-hidden mb-3"
        style={{ background: "#1A1B19" }}
      >
        {total > 0 &&
          segments.map((seg) =>
            seg.count > 0 ? (
              <div
                key={seg.key}
                style={{
                  background: seg.color,
                  width: `${(seg.count / total) * 100}%`,
                  height: "100%",
                }}
              />
            ) : null
          )}
      </div>

      {/* Counts row */}
      <div className="flex gap-4 text-[10px] font-mono" style={{ color: "#656453" }}>
        <span>W {waiting}</span>
        <span>A {active}</span>
        <span>C {completed}</span>
        <span>F {failed}</span>
        <span>D {delayed}</span>
      </div>
    </Link>
  );
}
