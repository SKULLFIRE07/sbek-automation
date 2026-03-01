"use client";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
}

export function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <div className="border-b border-[#2A2B28] pb-4 mb-6">
      <h1 className="text-lg font-medium tracking-tight" style={{ color: "#d4d3cc" }}>{title}</h1>
      {subtitle && (
        <p className="text-xs mt-1" style={{ color: "#7A7968" }}>{subtitle}</p>
      )}
    </div>
  );
}
