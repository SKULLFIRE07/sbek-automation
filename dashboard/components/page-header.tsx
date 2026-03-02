"use client";

interface PageHeaderProps {
  title: string;
}

export function PageHeader({ title }: PageHeaderProps) {
  return (
    <div className="mb-8">
      <h1
        className="text-xl font-semibold tracking-tight"
        style={{ color: "#111111" }}
      >
        {title}
      </h1>
      <div
        style={{
          width: 40,
          height: 2,
          background: "#1A1A1A",
          marginTop: 10,
          borderRadius: 1,
        }}
      />
    </div>
  );
}
