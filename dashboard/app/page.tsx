"use client";

import { useState, useEffect } from "react";
import { useStats, useQueues, useWebhooks } from "@/lib/hooks";
import type { StatsData, QueueItem } from "@/lib/hooks";
import { StatCard } from "@/components/stat-card";
import { QueueCard } from "@/components/queue-card";
import { ActivityFeed } from "@/components/activity-feed";
import { formatNumber } from "@/lib/utils";

/* ── Keyframe styles (injected once) ──────────────────────────────────── */

const GLOBAL_STYLES = `
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(18px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes fadeInScale {
  from { opacity: 0; transform: scale(0.97) translateY(10px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes livePulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.25; }
}
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes gentleFadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
.fade-in-section {
  animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.fade-in-section-delay-1 { animation-delay: 0.12s; }
.fade-in-section-delay-2 { animation-delay: 0.28s; }
.fade-in-section-delay-3 { animation-delay: 0.44s; }
.fade-in-section-delay-4 { animation-delay: 0.60s; }
`;

/* ── Skeleton primitives ─────────────────────────────────────────────── */

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`rounded ${className ?? ""}`}
      style={{
        background:
          "linear-gradient(90deg, #1A1B19 25%, #222320 50%, #1A1B19 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.8s ease-in-out infinite",
      }}
    />
  );
}

function StatSkeleton() {
  return (
    <div
      className="px-6 py-8 rounded-lg min-h-[170px] flex flex-col justify-between"
      style={{ background: "#141513", border: "1px solid #1E1F1C" }}
    >
      <Skeleton className="h-3 w-24 mb-3 rounded-full" />
      <div>
        <Skeleton className="h-12 w-32 mb-3 rounded" />
        <Skeleton className="h-3 w-20 rounded-full" />
      </div>
    </div>
  );
}

function QueueCardSkeleton() {
  return (
    <div
      className="p-5 rounded-lg"
      style={{ background: "#141513", border: "1px solid #1E1F1C" }}
    >
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-4 w-32 rounded-full" />
        <Skeleton className="h-2 w-2 rounded-full" />
      </div>
      <Skeleton className="h-1 w-full mb-4 rounded-full" />
      <Skeleton className="h-3 w-36 rounded-full" />
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <div className="p-5 space-y-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex gap-4 items-center"
          style={{
            animation: `gentleFadeIn 0.4s ease-out ${i * 0.06}s both`,
          }}
        >
          <Skeleton className="h-3 w-14 shrink-0 rounded-full" />
          <Skeleton className="h-3 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}

/* ── Empty states ────────────────────────────────────────────────────── */

function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="rounded-lg py-16 text-center"
      style={{ background: "#141513", border: "1px solid #1E1F1C" }}
    >
      <p className="text-sm" style={{ color: "#7A7968" }}>
        {message}
      </p>
    </div>
  );
}

/* ── Section heading ─────────────────────────────────────────────────── */

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4 mb-5">
      <h2
        className="text-sm font-medium tracking-wide whitespace-nowrap"
        style={{ color: "#9A9880" }}
      >
        {label}
      </h2>
      <div
        className="flex-1 h-px"
        style={{ background: "linear-gradient(to right, #2A2B28, transparent)" }}
      />
    </div>
  );
}

/* ── Live header with pulsing dot + ticking "last updated" ───────────── */

function LiveHeader({
  dataTimestamp,
}: {
  dataTimestamp: number | null;
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  const secondsAgo =
    dataTimestamp != null
      ? Math.max(0, Math.floor((now - dataTimestamp) / 1000))
      : null;

  return (
    <div
      className="pb-6 mb-8"
      style={{ borderBottom: "1px solid #1E1F1C" }}
    >
      <div className="flex items-center justify-between">
        {/* Left: title + live dot */}
        <div className="flex items-center gap-3">
          <h1
            className="text-xl font-semibold tracking-tight"
            style={{ color: "#d4d3cc" }}
          >
            Dashboard
          </h1>
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{
              background: "#C5A572",
              boxShadow: "0 0 8px rgba(197, 165, 114, 0.4)",
              animation: "livePulse 2.4s ease-in-out infinite",
            }}
            title="Live"
          />
        </div>

        {/* Right: last-updated ticker */}
        {secondsAgo != null && (
          <span
            className="text-xs"
            style={{ color: "#656453" }}
          >
            Updated {secondsAgo === 0 ? "just now" : `${secondsAgo}s ago`}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Dashboard page ──────────────────────────────────────────────────── */

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useStats();
  const { data: queues, isLoading: queuesLoading } = useQueues();
  const { data: webhooks, isLoading: webhooksLoading } = useWebhooks();

  const hasStats = !statsLoading && stats != null;
  const hasQueues = !queuesLoading && queues != null;
  const hasWebhooks = !webhooksLoading && webhooks != null;

  // Track the last time data was refreshed
  const [dataTimestamp, setDataTimestamp] = useState<number | null>(null);
  useEffect(() => {
    if (hasStats) setDataTimestamp(Date.now());
  }, [stats, hasStats]);

  // Inject keyframe styles once
  useEffect(() => {
    const id = "sbek-dashboard-styles";
    if (typeof document !== "undefined" && !document.getElementById(id)) {
      const style = document.createElement("style");
      style.id = id;
      style.textContent = GLOBAL_STYLES;
      document.head.appendChild(style);
    }
  }, []);

  return (
    <>
      {/* ── Header with live dot + last-updated ticker ─────────────── */}
      <LiveHeader dataTimestamp={dataTimestamp} />

      {/* ── Stat cards (4-up row) ──────────────────────────────────── */}
      <div className="fade-in-section fade-in-section-delay-1">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
          {statsLoading || !hasStats ? (
            <>
              <StatSkeleton />
              <StatSkeleton />
              <StatSkeleton />
              <StatSkeleton />
            </>
          ) : (
            <>
              <StatCard
                label="Orders Processed"
                value={formatNumber(stats.totalProcessed)}
                trend="up"
                trendLabel="+12% vs last week"
              />
              <StatCard
                label="Failed Today"
                value={formatNumber(stats.totalFailed)}
                trend={stats.totalFailed > 0 ? "down" : "flat"}
                trendLabel="last 24h"
                subtitle={
                  stats.totalFailed > 0 ? "requires attention" : undefined
                }
              />
              <StatCard
                label="Success Rate"
                value={`${stats.successRate.toFixed(1)}%`}
                trend="up"
                trendLabel="+0.3% vs yesterday"
              />
              <StatCard
                label="In Progress"
                value={formatNumber(stats.totalActive)}
                trend="flat"
                trendLabel="right now"
              />
            </>
          )}
        </div>
      </div>

      {/* ── Queue Status section ───────────────────────────────────── */}
      <div className="mb-10 fade-in-section fade-in-section-delay-2">
        <SectionHeader label="Queue Status" />

        {queuesLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <QueueCardSkeleton key={i} />
            ))}
          </div>
        ) : hasQueues && queues.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {queues.map((q: QueueItem) => (
              <QueueCard key={q.name} {...q} />
            ))}
          </div>
        ) : (
          <EmptyState message="No queues registered yet" />
        )}
      </div>

      {/* ── Recent Activity section ────────────────────────────────── */}
      <div className="mb-10 fade-in-section fade-in-section-delay-3">
        <SectionHeader label="Recent Activity" />

        <div
          className="rounded-lg relative overflow-hidden"
          style={{
            border: "1px solid #1E1F1C",
            background: "#141513",
            minHeight: 400,
          }}
        >
          {webhooksLoading ? (
            <ActivitySkeleton />
          ) : hasWebhooks && webhooks.length > 0 ? (
            <>
              <ActivityFeed items={webhooks} />
              {/* Fade-out gradient at the bottom of the activity feed */}
              <div
                className="pointer-events-none absolute bottom-0 left-0 right-0"
                style={{
                  height: 80,
                  background:
                    "linear-gradient(to bottom, transparent, #141513)",
                }}
              />
            </>
          ) : (
            <div className="py-16 text-center">
              <p className="text-sm" style={{ color: "#7A7968" }}>
                No activity yet
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
