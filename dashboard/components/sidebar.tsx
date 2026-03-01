"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  {
    label: "Dashboard",
    href: "/",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          x="1.5"
          y="1.5"
          width="7"
          height="7"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect
          x="11.5"
          y="1.5"
          width="7"
          height="7"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect
          x="1.5"
          y="11.5"
          width="7"
          height="7"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect
          x="11.5"
          y="11.5"
          width="7"
          height="7"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: "Queues",
    href: "/queues",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M3 5h14"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <path
          d="M5 10h10"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <path
          d="M4 15h12"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    label: "System",
    href: "/system",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="10"
          cy="10"
          r="3"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <path
          d="M10 1.5v2M10 16.5v2M18.5 10h-2M3.5 10h-2M15.95 4.05l-1.41 1.41M5.46 14.54l-1.41 1.41M15.95 15.95l-1.41-1.41M5.46 5.46L4.05 4.05"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    label: "Activity",
    href: "/activity",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M1.5 10h3.5l2.5-6 4 12 2.5-6h4.5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: "Settings",
    href: "/settings",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <line
          x1="3"
          y1="4"
          x2="17"
          y2="4"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <circle cx="7" cy="4" r="1.5" fill="currentColor" />
        <line
          x1="3"
          y1="10"
          x2="17"
          y2="10"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <circle cx="13" cy="10" r="1.5" fill="currentColor" />
        <line
          x1="3"
          y1="16"
          x2="17"
          y2="16"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <circle cx="9" cy="16" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <aside
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        bottom: 0,
        width: 260,
        background: "#0C0D0B",
        borderRight: "1px solid #2A2B28",
        display: "flex",
        flexDirection: "column",
        zIndex: 50,
      }}
    >
      {/* Brand */}
      <div
        style={{
          padding: "24px 24px 20px",
          position: "relative",
        }}
      >
        <img src="/sbek-logo.svg" alt="SBEK" style={{ height: 22 }} />
        {/* Gold gradient underline */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 24,
            right: 24,
            height: 1,
            background:
              "linear-gradient(90deg, #C5A572 0%, rgba(197, 165, 114, 0.3) 60%, transparent 100%)",
          }}
        />
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, paddingTop: 12, paddingBottom: 16 }}>
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "12px 24px",
                fontSize: 13,
                fontWeight: active ? 500 : 400,
                color: active ? "#C5A572" : "#7A7968",
                textDecoration: "none",
                borderLeft: active
                  ? "2px solid #C5A572"
                  : "2px solid transparent",
                background: active
                  ? "rgba(197, 165, 114, 0.10)"
                  : "transparent",
                borderRadius: "0 8px 8px 0",
                marginRight: 12,
                transition:
                  "color 0.2s ease, background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease",
                letterSpacing: "0.01em",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.color = "#d4d3cc";
                  e.currentTarget.style.background =
                    "rgba(197, 165, 114, 0.05)";
                  e.currentTarget.style.boxShadow =
                    "inset 0 0 20px rgba(197, 165, 114, 0.03)";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.color = "#7A7968";
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.boxShadow = "none";
                }
              }}
            >
              <span
                style={{
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: active ? 1 : 0.65,
                  transition: "opacity 0.2s ease",
                }}
              >
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
