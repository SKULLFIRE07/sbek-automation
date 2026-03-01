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
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes livePulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.3; }
}
.fade-in-section {
  animation: fadeInUp 0.5s ease-out both;
}
.fade-in-section-delay-1 { animation-delay: 0.08s; }
.fade-in-section-delay-2 { animation-delay: 0.16s; }
.fade-in-section-delay-3 { animation-delay: 0.24s; }
`;

/* ── Skeleton primitives ─────────────────────────────────────────────── */

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse ${className ?? ""}`}
      style={{ background: "#111" }}
    />
  );
}

function StatSkeleton() {
  return (
    <div
      className="px-6 py-8 border min-h-[160px] flex flex-col justify-between"
      style={{ background: "#0a0a0a", borderColor: "#222" }}
    >
      <Skeleton className="h-3 w-20 mb-3" />
      <div>
        <Skeleton className="h-12 w-32 mb-3" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

function QueueCardSkeleton() {
  return (
    <div
      className="p-4 border"
      style={{ background: "#0a0a0a", borderColor: "#222" }}
    >
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-1.5 w-1.5" />
      </div>
      <Skeleton className="h-1 w-full mb-3" />
      <Skeleton className="h-3 w-40" />
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <div className="p-4 space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex gap-4 items-center">
          <Skeleton className="h-3 w-14 shrink-0" />
          <Skeleton className="h-3 w-full" />
        </div>
      ))}
    </div>
  );
}

/* ── Empty states ────────────────────────────────────────────────────── */

function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="border py-12 text-center"
      style={{ background: "#0a0a0a", borderColor: "#222" }}
    >
      <p className="text-sm font-mono" style={{ color: "#666" }}>
        {message}
      </p>
    </div>
  );
}

/* ── Section heading ─────────────────────────────────────────────────── */

function SectionHeader({ label }: { label: string }) {
  return (
    <h2
      className="text-[11px] uppercase tracking-[0.15em] mb-3 font-medium"
      style={{ color: "#666", letterSpacing: "0.15em" }}
    >
      {label}
    </h2>
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
    dataTimestamp != null ? Math.max(0, Math.floor((now - dataTimestamp) / 1000)) : null;

  return (
    <div
      className="border-b pb-4 mb-6"
      style={{ borderColor: "#222" }}
    >
      <div className="flex items-center justify-between">
        {/* Left: title + live dot */}
        <div className="flex items-center gap-3">
          <h1
            className="text-lg font-medium tracking-tight"
            style={{ color: "#fff" }}
          >
            Dashboard
          </h1>
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{
              background: "#22c55e",
              animation: "livePulse 2s ease-in-out infinite",
            }}
            title="Live"
          />
        </div>

        {/* Right: last-updated ticker */}
        {secondsAgo != null && (
          <span
            className="text-[11px] font-mono"
            style={{ color: "#555" }}
          >
            Updated {secondsAgo === 0 ? "just now" : `${secondsAgo}s ago`}
          </span>
        )}
      </div>

      <p className="text-xs mt-1" style={{ color: "#555" }}>
        System overview
      </p>
    </div>
  );
}

/* ── Quick Stats bar ─────────────────────────────────────────────────── */

function QuickStatsBar({ stats, queues }: { stats: StatsData; queues: QueueItem[] | null }) {
  // Derive throughput-style metrics from available data
  const totalActive = stats.totalActive;
  const totalWaiting = stats.totalWaiting;
  const totalDelayed = stats.totalDelayed;
  const queueCount = queues?.length ?? stats.totalQueues;

  const items = [
    { label: "Throughput", value: `${formatNumber(totalActive)} active`, dot: "#22c55e" },
    { label: "Queued", value: `${formatNumber(totalWaiting)} waiting`, dot: "#f59e0b" },
    { label: "Delayed", value: formatNumber(totalDelayed), dot: totalDelayed > 0 ? "#f59e0b" : "#555" },
    { label: "Queues", value: `${queueCount} registered`, dot: null },
    { label: "Uptime", value: `${stats.successRate.toFixed(1)}%`, dot: stats.successRate >= 99 ? "#22c55e" : stats.successRate >= 95 ? "#f59e0b" : "#ef4444" },
  ];

  return (
    <div
      className="flex flex-wrap gap-x-6 gap-y-2 px-4 py-3 mb-8 border"
      style={{ background: "#0a0a0a", borderColor: "#1a1a1a" }}
    >
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          {item.dot && (
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ background: item.dot }}
            />
          )}
          <span className="text-[11px] font-mono" style={{ color: "#555" }}>
            {item.label}
          </span>
          <span className="text-[11px] font-mono font-medium" style={{ color: "#999" }}>
            {item.value}
          </span>
        </div>
      ))}
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

      {/* ── Quick Stats bar ────────────────────────────────────────── */}
      {hasStats && (
        <div className="fade-in-section">
          <QuickStatsBar stats={stats} queues={queues ?? null} />
        </div>
      )}

      {/* ── Stat cards (4-up row) ──────────────────────────────────── */}
      <div className="fade-in-section fade-in-section-delay-1">
        <div
          className="grid grid-cols-2 lg:grid-cols-4 gap-px mb-8"
          style={{ background: "#222" }}
        >
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
                label="Total Processed"
                value={formatNumber(stats.totalProcessed)}
                trend="up"
                trendLabel="+12% vs last week"
              />
              <StatCard
                label="Failed (24h)"
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
                label="Active Jobs"
                value={formatNumber(stats.totalActive)}
                trend="flat"
                trendLabel="right now"
              />
            </>
          )}
        </div>
      </div>

      {/* ── Queues section ─────────────────────────────────────────── */}
      <div className="mb-8 fade-in-section fade-in-section-delay-2">
        <SectionHeader label="Queues" />

        {queuesLoading ? (
          <div
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-px"
            style={{ background: "#222" }}
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <QueueCardSkeleton key={i} />
            ))}
          </div>
        ) : hasQueues && queues.length > 0 ? (
          <div
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-px"
            style={{ background: "#222" }}
          >
            {queues.map((q: QueueItem) => (
              <QueueCard key={q.name} {...q} />
            ))}
          </div>
        ) : (
          <EmptyState message="No queues registered yet" />
        )}
      </div>

      {/* ── Activity section with bottom fade gradient ─────────────── */}
      <div className="mb-8 fade-in-section fade-in-section-delay-3">
        <SectionHeader label="Recent Activity" />

        <div
          className="border relative"
          style={{
            borderColor: "#222",
            background: "#0a0a0a",
            minHeight: 340,
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
                  height: 64,
                  background:
                    "linear-gradient(to bottom, transparent, #0a0a0a)",
                }}
              />
            </>
          ) : (
            <div className="py-12 text-center">
              <p className="text-sm font-mono" style={{ color: "#666" }}>
                No activity yet
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
