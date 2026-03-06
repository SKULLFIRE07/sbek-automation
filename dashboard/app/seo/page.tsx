"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/page-header";
import { fetchApi } from "@/lib/api";

interface SchemaTemplate {
  name: string;
  content: Record<string, unknown>;
}

interface Prompt {
  name: string;
  content: string;
}

interface ContentType {
  type: string;
  label: string;
  description: string;
}

interface SeoData {
  schemas: SchemaTemplate[];
  prompts: Prompt[];
  contentTypes: ContentType[];
}

export default function SeoPage() {
  const [data, setData] = useState<SeoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSchema, setExpandedSchema] = useState<string | null>(null);
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);

  useEffect(() => {
    fetchApi<SeoData>("/dashboard/seo")
      .then(setData)
      .catch(() => setData({ schemas: [], prompts: [], contentTypes: [] }))
      .finally(() => setLoading(false));
  }, []);

  const formatName = (name: string) =>
    name
      .split(/[_-]/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

  return (
    <div className="animate-enter">
      <PageHeader title="SEO & AEO" />

      {loading ? (
        <div
          className="p-10 text-center text-sm"
          style={{ color: "var(--text-subtle)" }}
        >
          Loading SEO configuration...
        </div>
      ) : (
        <>
          {/* Content Pipeline Types */}
          <section className="mb-10">
            <h2
              className="text-[11px] uppercase tracking-widest mb-4 font-medium"
              style={{ color: "var(--text-subtle)" }}
            >
              AI Content Pipeline
            </h2>
            <p
              className="text-xs mb-5 leading-relaxed"
              style={{ color: "var(--text-subtle)" }}
            >
              Automated content generation triggered by new products or
              scheduled cron jobs. Each type is pushed directly to your
              WooCommerce store.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
              {data?.contentTypes.map((ct) => (
                <div key={ct.type} className="card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="inline-flex items-center px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full"
                      style={{
                        background: "rgba(34, 197, 94, 0.12)",
                        color: "#22C55E",
                        border: "1px solid rgba(34, 197, 94, 0.25)",
                      }}
                    >
                      Active
                    </span>
                    <span
                      className="text-[10px] font-mono"
                      style={{ color: "var(--text-subtle)" }}
                    >
                      {ct.type}
                    </span>
                  </div>
                  <h3
                    className="text-sm font-semibold mb-1.5"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {ct.label}
                  </h3>
                  <p
                    className="text-xs leading-relaxed"
                    style={{ color: "var(--text-subtle)" }}
                  >
                    {ct.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Schema Templates */}
          <section className="mb-10">
            <h2
              className="text-[11px] uppercase tracking-widest mb-4 font-medium"
              style={{ color: "var(--text-subtle)" }}
            >
              Schema.org Templates ({data?.schemas.length ?? 0})
            </h2>
            <p
              className="text-xs mb-5 leading-relaxed"
              style={{ color: "var(--text-subtle)" }}
            >
              JSON-LD structured data templates injected into product pages for
              rich search results and AI engine visibility.
            </p>
            <div className="space-y-3">
              {data?.schemas.map((schema) => (
                <div
                  key={schema.name}
                  className="card"
                  style={{ overflow: "hidden" }}
                >
                  <button
                    onClick={() =>
                      setExpandedSchema(
                        expandedSchema === schema.name ? null : schema.name
                      )
                    }
                    className="w-full flex items-center justify-between px-5 py-4"
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="text-sm font-semibold"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {formatName(schema.name)}
                      </span>
                      <span
                        className="text-[10px] font-mono px-2 py-0.5 rounded"
                        style={{
                          background: "var(--bg-elevated)",
                          color: "var(--text-subtle)",
                        }}
                      >
                        @type:{" "}
                        {(schema.content as Record<string, string>)["@type"] ??
                          "Unknown"}
                      </span>
                    </div>
                    <span
                      className="text-xs"
                      style={{ color: "var(--text-subtle)" }}
                    >
                      {expandedSchema === schema.name ? "▲" : "▼"}
                    </span>
                  </button>
                  {expandedSchema === schema.name && (
                    <div
                      className="px-5 pb-4"
                      style={{ borderTop: "1px solid var(--border)" }}
                    >
                      <pre
                        className="text-[11px] leading-relaxed mt-3 p-4 rounded overflow-auto"
                        style={{
                          background: "var(--bg)",
                          color: "var(--text-subtle)",
                          maxHeight: 400,
                          fontFamily: "monospace",
                        }}
                      >
                        {JSON.stringify(schema.content, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* AI Prompts */}
          <section className="mb-10">
            <h2
              className="text-[11px] uppercase tracking-widest mb-4 font-medium"
              style={{ color: "var(--text-subtle)" }}
            >
              AI Prompts ({data?.prompts.length ?? 0})
            </h2>
            <p
              className="text-xs mb-5 leading-relaxed"
              style={{ color: "var(--text-subtle)" }}
            >
              System prompts used by the AI content pipeline to generate SEO
              metadata, FAQs, and AEO knowledge base content.
            </p>
            <div className="space-y-3">
              {data?.prompts.map((prompt) => (
                <div
                  key={prompt.name}
                  className="card"
                  style={{ overflow: "hidden" }}
                >
                  <button
                    onClick={() =>
                      setExpandedPrompt(
                        expandedPrompt === prompt.name ? null : prompt.name
                      )
                    }
                    className="w-full flex items-center justify-between px-5 py-4"
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span
                      className="text-sm font-semibold"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {formatName(prompt.name)}
                    </span>
                    <span
                      className="text-xs"
                      style={{ color: "var(--text-subtle)" }}
                    >
                      {expandedPrompt === prompt.name ? "▲" : "▼"}
                    </span>
                  </button>
                  {expandedPrompt === prompt.name && (
                    <div
                      className="px-5 pb-4"
                      style={{ borderTop: "1px solid var(--border)" }}
                    >
                      <pre
                        className="text-[11px] leading-relaxed mt-3 p-4 rounded overflow-auto whitespace-pre-wrap"
                        style={{
                          background: "var(--bg)",
                          color: "var(--text-subtle)",
                          maxHeight: 400,
                          fontFamily: "monospace",
                        }}
                      >
                        {prompt.content}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
