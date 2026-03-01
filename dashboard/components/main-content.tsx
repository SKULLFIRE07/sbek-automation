"use client";

import { useSidebar } from "./sidebar-context";

export function MainContent({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();
  const marginLeft = collapsed ? 56 : 220;

  return (
    <main
      className="flex-1 overflow-y-auto min-h-screen page-transition"
      style={{
        marginLeft,
        transition: "margin-left 0.2s ease",
      }}
    >
      <div className="px-5 py-5 h-full">{children}</div>
    </main>
  );
}
