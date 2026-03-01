"use client";

interface PageHeaderProps {
  title: string;
}

export function PageHeader({ title }: PageHeaderProps) {
  return (
    <div className="mb-8">
      <h1
        className="text-xl font-semibold tracking-tight"
        style={{ color: "#E8E6DF" }}
      >
        {title}
      </h1>
      <div
        style={{
          width: 40,
          height: 2,
          background: "linear-gradient(90deg, #C4A35A, #A68B3E)",
          marginTop: 10,
          borderRadius: 1,
        }}
      />
    </div>
  );
}
