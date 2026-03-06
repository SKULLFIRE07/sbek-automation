"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/page-header";
import { fetchApi, postApi } from "@/lib/api";

interface EmailTemplate {
  name: string;
  displayName: string;
  category: "customer" | "internal";
  variables: string[];
  htmlLength: number;
}

export default function EmailsPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [testMsg, setTestMsg] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchApi<{ templates: EmailTemplate[] }>("/dashboard/email-templates")
      .then((d) => setTemplates(d.templates))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }, []);

  async function handlePreview(name: string) {
    if (selectedTemplate === name) {
      setSelectedTemplate(null);
      setPreviewHtml("");
      return;
    }
    setSelectedTemplate(name);
    setPreviewLoading(true);
    try {
      const res = await fetch(
        `/api/dashboard/email-templates/${name}/preview`
      );
      if (res.ok) {
        setPreviewHtml(await res.text());
      } else {
        setPreviewHtml(
          "<p style='padding:20px;color:#999'>Failed to load preview</p>"
        );
      }
    } catch {
      setPreviewHtml(
        "<p style='padding:20px;color:#999'>Failed to load preview</p>"
      );
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleSendTest(name: string) {
    setSending(true);
    setTestMsg("");
    try {
      const res = await postApi<{ sent: boolean; to: string }>(
        `/dashboard/email-templates/${name}/test`
      );
      setTestMsg(`Test email sent to ${res.to}`);
      setTimeout(() => setTestMsg(""), 5000);
    } catch {
      setTestMsg("Failed to send — check email settings");
      setTimeout(() => setTestMsg(""), 5000);
    } finally {
      setSending(false);
    }
  }

  const customerTemplates = templates.filter((t) => t.category === "customer");
  const internalTemplates = templates.filter((t) => t.category === "internal");

  return (
    <div className="animate-enter">
      <div className="flex items-center justify-between mb-2">
        <PageHeader title="Email Templates" />
        {testMsg && (
          <span
            className="text-xs"
            style={{
              color: testMsg.includes("Failed")
                ? "var(--error)"
                : "var(--text-subtle)",
            }}
          >
            {testMsg}
          </span>
        )}
      </div>

      {loading ? (
        <div
          className="p-10 text-center text-sm"
          style={{ color: "var(--text-subtle)" }}
        >
          Loading templates...
        </div>
      ) : templates.length === 0 ? (
        <div
          className="p-10 text-center text-sm"
          style={{ color: "var(--text-subtle)" }}
        >
          No email templates found.
        </div>
      ) : (
        <>
          {/* Customer Templates */}
          <section className="mb-10">
            <h2
              className="text-[11px] uppercase tracking-widest mb-4 font-medium"
              style={{ color: "var(--text-subtle)" }}
            >
              Customer Emails ({customerTemplates.length})
            </h2>
            <p
              className="text-xs mb-5 leading-relaxed"
              style={{ color: "var(--text-subtle)" }}
            >
              Sent automatically to customers at each stage of their order
              journey.
            </p>
            <div className="space-y-3 stagger">
              {customerTemplates.map((t) => (
                <TemplateCard
                  key={t.name}
                  template={t}
                  isSelected={selectedTemplate === t.name}
                  previewHtml={
                    selectedTemplate === t.name ? previewHtml : ""
                  }
                  previewLoading={
                    selectedTemplate === t.name && previewLoading
                  }
                  sending={sending}
                  onPreview={() => handlePreview(t.name)}
                  onSendTest={() => handleSendTest(t.name)}
                />
              ))}
            </div>
          </section>

          {/* Internal Templates */}
          <section className="mb-10">
            <h2
              className="text-[11px] uppercase tracking-widest mb-4 font-medium"
              style={{ color: "var(--text-subtle)" }}
            >
              Internal Alerts ({internalTemplates.length})
            </h2>
            <p
              className="text-xs mb-5 leading-relaxed"
              style={{ color: "var(--text-subtle)" }}
            >
              Sent to your team for production briefs, QC failures, and
              competitor intelligence.
            </p>
            <div className="space-y-3 stagger">
              {internalTemplates.map((t) => (
                <TemplateCard
                  key={t.name}
                  template={t}
                  isSelected={selectedTemplate === t.name}
                  previewHtml={
                    selectedTemplate === t.name ? previewHtml : ""
                  }
                  previewLoading={
                    selectedTemplate === t.name && previewLoading
                  }
                  sending={sending}
                  onPreview={() => handlePreview(t.name)}
                  onSendTest={() => handleSendTest(t.name)}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function TemplateCard({
  template,
  isSelected,
  previewHtml,
  previewLoading,
  sending,
  onPreview,
  onSendTest,
}: {
  template: EmailTemplate;
  isSelected: boolean;
  previewHtml: string;
  previewLoading: boolean;
  sending: boolean;
  onPreview: () => void;
  onSendTest: () => void;
}) {
  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div className="flex items-center justify-between px-5 py-4">
        <div>
          <h3
            className="text-sm font-semibold mb-1"
            style={{ color: "var(--text-secondary)" }}
          >
            {template.displayName}
          </h3>
          <div className="flex items-center gap-2">
            {template.variables.slice(0, 5).map((v) => (
              <span
                key={v}
                className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                style={{
                  background: "var(--bg-elevated)",
                  color: "var(--text-subtle)",
                }}
              >
                {`{{${v}}}`}
              </span>
            ))}
            {template.variables.length > 5 && (
              <span
                className="text-[9px]"
                style={{ color: "var(--text-subtle)" }}
              >
                +{template.variables.length - 5} more
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onSendTest}
            disabled={sending}
            className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider"
            style={{
              background: "var(--bg-elevated)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md, 6px)",
              cursor: sending ? "not-allowed" : "pointer",
              opacity: sending ? 0.6 : 1,
            }}
          >
            Send Test
          </button>
          <button
            onClick={onPreview}
            className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider"
            style={{
              background: isSelected ? "#1A1A1A" : "var(--bg-elevated)",
              color: isSelected ? "#fff" : "var(--text-secondary)",
              border: isSelected ? "none" : "1px solid var(--border)",
              borderRadius: "var(--radius-md, 6px)",
              cursor: "pointer",
            }}
          >
            {isSelected ? "Hide" : "Preview"}
          </button>
        </div>
      </div>

      {isSelected && (
        <div style={{ borderTop: "1px solid var(--border)" }}>
          {previewLoading ? (
            <div
              className="p-10 text-center text-xs"
              style={{ color: "var(--text-subtle)" }}
            >
              Loading preview...
            </div>
          ) : (
            <div
              style={{
                background: "#f5f5f5",
                padding: "16px",
                maxHeight: 600,
                overflow: "auto",
              }}
            >
              <div
                style={{
                  maxWidth: 600,
                  margin: "0 auto",
                  background: "#fff",
                  borderRadius: 8,
                  overflow: "hidden",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                }}
              >
                <iframe
                  srcDoc={previewHtml}
                  style={{
                    width: "100%",
                    height: 500,
                    border: "none",
                  }}
                  title={`Preview: ${template.displayName}`}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
