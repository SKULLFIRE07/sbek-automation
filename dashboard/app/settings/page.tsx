"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSettings } from "@/lib/hooks";
import { putApi, postApi } from "@/lib/api";
import { PageHeader } from "@/components/page-header";

/* ── Types ──────────────────────────────────────────────────────────── */

interface FieldDef {
  key: string;
  label: string;
  type: "text" | "password" | "textarea" | "select";
  hint?: string;
  options?: string[];
  required?: boolean;
}

interface SectionDef {
  id: string;
  title: string;
  icon: string;
  description: string;
  fields: FieldDef[];
  testable?: boolean;
}

interface ValidationResult {
  valid: boolean;
  message: string;
}

/* ── Section definitions — keys match CONFIGURABLE_KEYS (UPPERCASE) ── */

const SECTIONS: SectionDef[] = [
  {
    id: "woocommerce",
    title: "WooCommerce",
    icon: "\u2302",
    description:
      "Connect your WooCommerce store to sync products, orders, and customer data in real time.",
    testable: true,
    fields: [
      {
        key: "WOO_URL",
        label: "Store URL",
        type: "text",
        hint: "Full URL of your WooCommerce store (e.g. https://store.sbek.com)",
        required: true,
      },
      {
        key: "WOO_CONSUMER_KEY",
        label: "Consumer Key",
        type: "password",
        hint: "WooCommerce REST API consumer key (starts with ck_)",
        required: true,
      },
      {
        key: "WOO_CONSUMER_SECRET",
        label: "Consumer Secret",
        type: "password",
        hint: "WooCommerce REST API consumer secret (starts with cs_)",
        required: true,
      },
      {
        key: "WOO_WEBHOOK_SECRET",
        label: "Webhook Secret",
        type: "password",
        hint: "Secret for verifying WooCommerce webhook payloads",
        required: true,
      },
    ],
  },
  {
    id: "google-sheets",
    title: "Google Sheets",
    icon: "\u25A6",
    description:
      "Link a Google Sheet as a data warehouse. Orders, production, QC, customers, creatives, and logs are synced to separate tabs.",
    testable: true,
    fields: [
      {
        key: "GOOGLE_SERVICE_ACCOUNT_EMAIL",
        label: "Service Account Email",
        type: "text",
        hint: "e.g. sbek-bot@your-project.iam.gserviceaccount.com",
        required: true,
      },
      {
        key: "GOOGLE_PRIVATE_KEY",
        label: "Private Key",
        type: "textarea",
        hint: "PEM-encoded private key (starts with -----BEGIN PRIVATE KEY-----)",
        required: true,
      },
      {
        key: "GOOGLE_SHEET_ID",
        label: "Sheet ID",
        type: "text",
        hint: "The ID from your Google Sheet URL (between /d/ and /edit)",
        required: true,
      },
    ],
  },
  {
    id: "whatsapp-meta",
    title: "WhatsApp (Meta)",
    icon: "\u2709",
    description:
      "Primary WhatsApp Business Cloud API for order confirmations, shipping updates, and review requests.",
    testable: true,
    fields: [
      {
        key: "WHATSAPP_PHONE_NUMBER_ID",
        label: "Phone Number ID",
        type: "text",
        hint: "Numeric ID from Meta Business Suite (e.g. 123456789012345)",
        required: true,
      },
      {
        key: "WHATSAPP_ACCESS_TOKEN",
        label: "Access Token",
        type: "password",
        hint: "Meta/Facebook access token for WhatsApp Cloud API",
        required: true,
      },
    ],
  },
  {
    id: "whatsapp-backup",
    title: "WhatsApp Backup (Wati / Interakt)",
    icon: "\u2709",
    description:
      "Backup WhatsApp providers. If Meta Cloud API fails, the system falls back to Wati first, then Interakt.",
    fields: [
      {
        key: "WATI_API_KEY",
        label: "Wati API Key",
        type: "password",
        hint: "API key from your Wati dashboard",
      },
      {
        key: "WATI_BASE_URL",
        label: "Wati Base URL",
        type: "text",
        hint: "e.g. https://live-mt-server.wati.io",
      },
      {
        key: "INTERAKT_API_KEY",
        label: "Interakt API Key",
        type: "password",
        hint: "API key from your Interakt dashboard (used as 2nd fallback)",
      },
    ],
  },
  {
    id: "email-smtp",
    title: "Email (SMTP)",
    icon: "\u2707",
    description:
      "Set up outbound email delivery via SMTP for order confirmations, shipping updates, and marketing emails.",
    testable: true,
    fields: [
      {
        key: "SMTP_HOST",
        label: "Host",
        type: "text",
        hint: "SMTP server hostname (e.g. smtp.gmail.com)",
        required: true,
      },
      {
        key: "SMTP_PORT",
        label: "Port",
        type: "text",
        hint: "SMTP server port (587 for TLS, 465 for SSL)",
        required: true,
      },
      {
        key: "SMTP_USER",
        label: "User",
        type: "text",
        hint: "SMTP authentication username / email",
        required: true,
      },
      {
        key: "SMTP_PASS",
        label: "Password",
        type: "password",
        hint: "SMTP password or app-specific password",
        required: true,
      },
      {
        key: "EMAIL_FROM",
        label: "From Address",
        type: "text",
        hint: 'Sender display (e.g. SBEK <orders@sbek.com>)',
      },
    ],
  },
  {
    id: "ai",
    title: "AI / Image Generation",
    icon: "\u2726",
    description:
      "OpenAI for text generation (descriptions, SEO, captions). Gemini Nano Banana for product image generation.",
    testable: true,
    fields: [
      {
        key: "OPENAI_API_KEY",
        label: "OpenAI API Key",
        type: "password",
        hint: "Used for text generation — product descriptions, SEO content, social captions",
        required: true,
      },
      {
        key: "GEMINI_API_KEY",
        label: "Gemini API Key (Nano Banana)",
        type: "password",
        hint: "Google Gemini key for image generation (gemini-2.0-flash-preview-image-generation)",
      },
    ],
  },
  {
    id: "social-media",
    title: "Social Media",
    icon: "\u269B",
    description:
      "Connect Postiz to schedule and auto-publish to Instagram, Facebook, and Pinterest.",
    testable: true,
    fields: [
      {
        key: "POSTIZ_API_KEY",
        label: "Postiz API Key",
        type: "password",
        hint: "API key from your Postiz dashboard",
        required: true,
      },
      {
        key: "POSTIZ_BASE_URL",
        label: "Postiz Base URL",
        type: "text",
        hint: "Default: https://app.postiz.com/api/v1",
      },
    ],
  },
  {
    id: "crawler",
    title: "Competitor Crawler",
    icon: "\u2318",
    description:
      "Configure the web crawler microservice used for competitive intelligence and price monitoring.",
    testable: true,
    fields: [
      {
        key: "CRAWLER_BASE_URL",
        label: "Crawler Service URL",
        type: "text",
        hint: "Default: http://crawler:3001 (Docker) or http://localhost:3001 (dev)",
      },
    ],
  },
  {
    id: "brand",
    title: "Brand",
    icon: "\u2605",
    description:
      "Define your brand identity. Used across generated content, emails, WhatsApp messages, and social posts.",
    fields: [
      {
        key: "BRAND_NAME",
        label: "Brand Name",
        type: "text",
        hint: "Your brand name (e.g. SBEK)",
        required: true,
      },
      {
        key: "BRAND_PRIMARY_COLOR",
        label: "Primary Color",
        type: "text",
        hint: "Hex color code (e.g. #B8860B)",
      },
      {
        key: "BRAND_WEBSITE",
        label: "Website URL",
        type: "text",
        hint: "Your brand website (used in email templates and AI headers)",
      },
      {
        key: "BRAND_SUPPORT_PHONE",
        label: "Support Phone",
        type: "text",
        hint: "Customer support phone number (e.g. +91XXXXXXXXXX)",
      },
      {
        key: "BRAND_SUPPORT_EMAIL",
        label: "Support Email",
        type: "text",
        hint: "Customer support email address",
      },
      {
        key: "REVIEW_URL",
        label: "Review URL",
        type: "text",
        hint: "URL where customers can leave a review (Google, Trustpilot, etc.)",
      },
    ],
  },
];

/* ── Icons ──────────────────────────────────────────────────────────── */

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" />
      <circle cx="8" cy="8" r="2" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" />
      <path d="M2 14L14 2" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="transition-transform duration-300 ease-in-out"
      style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
    >
      <path d="M3 5l4 4 4-4" />
    </svg>
  );
}

function ValidationIcon({ filled }: { filled: boolean }) {
  if (filled) {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0">
        <circle cx="7" cy="7" r="6" stroke="#C5A572" strokeWidth="1.2" fill="none" />
        <path d="M4 7l2 2 4-4" stroke="#C5A572" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0">
      <circle cx="7" cy="7" r="6" stroke="#3A3B37" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

/* ── Skeleton ───────────────────────────────────────────────────────── */

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse ${className ?? ""}`} style={{ background: "#1A1B19" }} />
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="border p-6" style={{ background: "#141513", borderColor: "#2A2B28" }}>
          <Skeleton className="h-4 w-32 mb-6" />
          <div className="space-y-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Inline Toast ──────────────────────────────────────────────────── */

function InlineToast({ result, onDismiss }: { result: ValidationResult; onDismiss: () => void }) {
  useEffect(() => {
    if (result.valid) {
      const t = setTimeout(onDismiss, 5000);
      return () => clearTimeout(t);
    }
  }, [result.valid, onDismiss]);

  return (
    <div
      className="flex items-start gap-2 px-3 py-2 mt-2 border text-[11px] font-mono leading-relaxed"
      style={{
        background: result.valid ? "#141A13" : "#1a0a0a",
        borderColor: result.valid ? "#2A3020" : "#3a1a1a",
        color: result.valid ? "#C5A572" : "#f87171",
      }}
    >
      <span className="flex-shrink-0 mt-0.5">{result.valid ? "\u2713" : "\u2717"}</span>
      <span className="flex-1">{result.message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="flex-shrink-0 ml-2 opacity-50 hover:opacity-100"
        style={{ color: result.valid ? "#C5A572" : "#f87171" }}
      >
        \u2715
      </button>
    </div>
  );
}

/* ── Test Connection Button ─────────────────────────────────────────── */

function TestConnectionButton({
  sectionId,
  values,
  onResult,
}: {
  sectionId: string;
  values: Record<string, string>;
  onResult: (result: ValidationResult) => void;
}) {
  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    try {
      const sectionFields = SECTIONS.find((s) => s.id === sectionId)?.fields ?? [];
      const sectionValues: Record<string, string> = {};
      for (const f of sectionFields) {
        const v = values[f.key];
        // Skip masked values (contain ***) — let the server resolve from real stored/env values
        if (v && !v.includes("***")) sectionValues[f.key] = v;
      }
      const result = await postApi<ValidationResult>("/dashboard/settings/validate", {
        section: sectionId,
        values: sectionValues,
      });
      onResult(result);
    } catch (err) {
      onResult({ valid: false, message: err instanceof Error ? err.message : "Test failed" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleTest}
      disabled={testing}
      className="px-3 py-1.5 text-[11px] uppercase tracking-[0.08em] font-medium border transition-all duration-200"
      style={{
        background: "#1A1B19",
        borderColor: "#3A3B37",
        color: testing ? "#656453" : "#9A9880",
        opacity: testing ? 0.7 : 1,
      }}
    >
      <span className="flex items-center gap-1.5">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
          <path d="M1 6h3m4 0h3" />
          <circle cx="6" cy="6" r="2.5" />
        </svg>
        {testing ? "Testing..." : "Test Connection"}
      </span>
    </button>
  );
}

/* ── Data Management Buttons ───────────────────────────────────────── */

function DataManagementBar() {
  const [seedStatus, setSeedStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [resetStatus, setResetStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (seedStatus === "success" || resetStatus === "success") {
      const t = setTimeout(() => {
        setSeedStatus("idle");
        setResetStatus("idle");
        setMessage(null);
      }, 4000);
      return () => clearTimeout(t);
    }
  }, [seedStatus, resetStatus]);

  const handleSeed = async () => {
    setSeedStatus("loading");
    setMessage(null);
    try {
      await postApi<{ success: boolean; output?: string }>("/dashboard/data/seed");
      setSeedStatus("success");
      setMessage("Demo data seeded successfully. Refresh the dashboard to see changes.");
    } catch (err) {
      setSeedStatus("error");
      setMessage(err instanceof Error ? err.message : "Seed failed");
    }
  };

  const handleReset = async () => {
    if (!confirmReset) {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 3000);
      return;
    }
    setResetStatus("loading");
    setConfirmReset(false);
    setMessage(null);
    try {
      await postApi<{ success: boolean }>("/dashboard/data/reset");
      setResetStatus("success");
      setMessage("All seeded data erased. Settings preserved.");
    } catch (err) {
      setResetStatus("error");
      setMessage(err instanceof Error ? err.message : "Reset failed");
    }
  };

  return (
    <div
      className="border mb-6 p-4"
      style={{ background: "#141513", borderColor: "#2A2B28" }}
    >
      <div className="flex items-center justify-between">
        <div>
          <h3
            className="text-xs uppercase tracking-[0.15em] font-medium mb-1"
            style={{ color: "#9A9880" }}
          >
            Demo Data
          </h3>
          <p className="text-[11px]" style={{ color: "#656453" }}>
            Seed sample data to test the dashboard, or erase it before going live.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSeed}
            disabled={seedStatus === "loading" || resetStatus === "loading"}
            className="px-4 py-2 text-[11px] uppercase tracking-[0.08em] font-medium border transition-all duration-200"
            style={{
              background: seedStatus === "loading" ? "#1A1B19" : "#141A13",
              borderColor: "#2A3020",
              color: seedStatus === "loading" ? "#656453" : "#C5A572",
              opacity: seedStatus === "loading" ? 0.7 : 1,
            }}
          >
            {seedStatus === "loading" ? "Seeding..." : seedStatus === "success" ? "Seeded!" : "Seed Demo Data"}
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={seedStatus === "loading" || resetStatus === "loading"}
            className="px-4 py-2 text-[11px] uppercase tracking-[0.08em] font-medium border transition-all duration-200"
            style={{
              background: confirmReset ? "#2a0a0a" : resetStatus === "loading" ? "#1A1B19" : "#1a0a0a",
              borderColor: confirmReset ? "#f87171" : "#3a1a1a",
              color: confirmReset ? "#f87171" : resetStatus === "loading" ? "#656453" : "#f87171",
              opacity: resetStatus === "loading" ? 0.7 : 1,
            }}
          >
            {resetStatus === "loading"
              ? "Erasing..."
              : resetStatus === "success"
                ? "Erased!"
                : confirmReset
                  ? "Click again to confirm"
                  : "Erase All Data"}
          </button>
        </div>
      </div>
      {message && (
        <div
          className="mt-3 px-3 py-2 border text-[11px] font-mono"
          style={{
            background:
              seedStatus === "error" || resetStatus === "error" ? "#1a0a0a" : "#141A13",
            borderColor:
              seedStatus === "error" || resetStatus === "error" ? "#3a1a1a" : "#2A3020",
            color:
              seedStatus === "error" || resetStatus === "error" ? "#f87171" : "#C5A572",
          }}
        >
          {message}
        </div>
      )}
    </div>
  );
}

/* ── Field component ────────────────────────────────────────────────── */

function SettingsField({
  field,
  value,
  source,
  onChange,
}: {
  field: FieldDef;
  value: string;
  source?: "database" | "env" | "none";
  onChange: (val: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const isSensitive = field.type === "password";
  const isTextarea = field.type === "textarea";
  const isSelect = field.type === "select";
  const hasFill = value.trim().length > 0;

  const inputStyle: React.CSSProperties = {
    background: "#0C0D0B",
    borderColor: "#2A2B28",
    color: "#d4d3cc",
  };

  const inputClasses =
    "w-full border px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#4A4B47] transition-colors";

  const sourceBadge = source && source !== "none" && (
    <span
      className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 border"
      style={{
        color: source === "database" ? "#C5A572" : "#f59e0b",
        borderColor: source === "database" ? "#2A3020" : "#3A2A0A",
        background: source === "database" ? "#141A13" : "#1a1500",
      }}
    >
      {source === "database" ? "DB" : "ENV"}
    </span>
  );

  const labelRow = (
    <div className="flex items-center gap-2 mb-1.5">
      <ValidationIcon filled={hasFill} />
      <label className="text-xs" style={{ color: "#9A9880" }}>
        {field.label}
      </label>
      {field.required && (
        <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "#b45050" }}>
          Required
        </span>
      )}
      {sourceBadge}
    </div>
  );

  if (isSelect) {
    return (
      <div className="mb-5">
        {labelRow}
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClasses}
          style={{ ...inputStyle, appearance: "none" }}
        >
          <option value="">-- select --</option>
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        {field.hint && <p className="text-[11px] mt-1" style={{ color: "#7A7968" }}>{field.hint}</p>}
      </div>
    );
  }

  if (isTextarea) {
    return (
      <div className="mb-5">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <ValidationIcon filled={hasFill} />
            <label className="text-xs" style={{ color: "#9A9880" }}>{field.label}</label>
            {field.required && (
              <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "#b45050" }}>
                Required
              </span>
            )}
            {sourceBadge}
          </div>
          <button
            type="button"
            onClick={() => setVisible(!visible)}
            className="p-1 transition-colors"
            style={{ color: "#7A7968" }}
            title={visible ? "Hide value" : "Show value"}
          >
            {visible ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className={`${inputClasses} resize-y`}
          style={{
            ...inputStyle,
            ...(visible ? {} : ({ WebkitTextSecurity: "disc" } as React.CSSProperties)),
          }}
          spellCheck={false}
        />
        {field.hint && <p className="text-[11px] mt-1" style={{ color: "#7A7968" }}>{field.hint}</p>}
      </div>
    );
  }

  return (
    <div className="mb-5">
      {labelRow}
      <div className="relative">
        <input
          type={isSensitive && !visible ? "password" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClasses}
          style={inputStyle}
          spellCheck={false}
          autoComplete="off"
        />
        {isSensitive && (
          <button
            type="button"
            onClick={() => setVisible(!visible)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 transition-colors"
            style={{ color: "#7A7968" }}
            title={visible ? "Hide value" : "Show value"}
          >
            {visible ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
      </div>
      {field.hint && <p className="text-[11px] mt-1" style={{ color: "#7A7968" }}>{field.hint}</p>}
    </div>
  );
}

/* ── Section component ──────────────────────────────────────────────── */

function SettingsSection({
  section,
  values,
  sources,
  onChange,
  validationResult,
  onValidationResult,
}: {
  section: SectionDef;
  values: Record<string, string>;
  sources: Record<string, "database" | "env" | "none">;
  onChange: (key: string, val: string) => void;
  validationResult?: ValidationResult | null;
  onValidationResult: (sectionId: string, result: ValidationResult | null) => void;
}) {
  const [open, setOpen] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | "auto">("auto");
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (contentRef.current) {
      const observer = new ResizeObserver(() => {
        if (contentRef.current && open) {
          setContentHeight(contentRef.current.scrollHeight);
        }
      });
      observer.observe(contentRef.current);
      return () => observer.disconnect();
    }
  }, [open]);

  const toggleOpen = useCallback(() => {
    if (open) {
      if (contentRef.current) {
        setContentHeight(contentRef.current.scrollHeight);
      }
      setIsAnimating(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setContentHeight(0);
        });
      });
      setTimeout(() => {
        setOpen(false);
        setIsAnimating(false);
      }, 300);
    } else {
      setOpen(true);
      setContentHeight(0);
      setIsAnimating(true);
      requestAnimationFrame(() => {
        if (contentRef.current) {
          setContentHeight(contentRef.current.scrollHeight);
        }
      });
      setTimeout(() => {
        setContentHeight("auto");
        setIsAnimating(false);
      }, 300);
    }
  }, [open]);

  const configuredCount = section.fields.filter(
    (f) => sources[f.key] !== "none" && sources[f.key] !== undefined
  ).length;
  const totalCount = section.fields.length;

  return (
    <div className="border mb-4" style={{ borderColor: "#2A2B28", background: "#141513" }}>
      <button
        type="button"
        onClick={toggleOpen}
        className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors hover:bg-[#181917]"
      >
        <div className="flex items-center gap-3">
          <span className="text-base leading-none" style={{ color: "#656453" }}>{section.icon}</span>
          <h2 className="text-xs uppercase tracking-[0.15em] font-medium" style={{ color: "#9A9880" }}>
            {section.title}
          </h2>
          <span
            className="text-[10px] font-mono"
            style={{ color: configuredCount === totalCount ? "#C5A572" : "#4A4B47" }}
          >
            {configuredCount}/{totalCount}
          </span>
        </div>
        <span style={{ color: "#7A7968" }}>
          <ChevronIcon open={open} />
        </span>
      </button>

      {(open || isAnimating) && (
        <div
          ref={contentRef}
          style={{
            maxHeight: contentHeight === "auto" ? "none" : `${contentHeight}px`,
            overflow: "hidden",
            transition: isAnimating ? "max-height 300ms cubic-bezier(0.4, 0, 0.2, 1)" : "none",
          }}
        >
          <div className="px-5 pb-5 border-t" style={{ borderColor: "#1A1B19" }}>
            <p className="text-[11px] leading-relaxed pt-4 pb-3" style={{ color: "#656453" }}>
              {section.description}
            </p>
            <div>
              {section.fields.map((field) => (
                <SettingsField
                  key={field.key}
                  field={field}
                  value={values[field.key] ?? ""}
                  source={sources[field.key]}
                  onChange={(val) => onChange(field.key, val)}
                />
              ))}
            </div>
            {section.testable && (
              <div
                className="pt-3 mt-1 border-t flex items-center justify-between gap-3"
                style={{ borderColor: "#1A1B19" }}
              >
                <div className="flex-1 min-w-0">
                  {validationResult && (
                    <InlineToast
                      result={validationResult}
                      onDismiss={() => onValidationResult(section.id, null)}
                    />
                  )}
                </div>
                <TestConnectionButton
                  sectionId={section.id}
                  values={values}
                  onResult={(result) => onValidationResult(section.id, result)}
                />
              </div>
            )}
            {!section.testable && validationResult && (
              <InlineToast
                result={validationResult}
                onDismiss={() => onValidationResult(section.id, null)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Save status types ──────────────────────────────────────────────── */

type SaveStatus = "idle" | "saving" | "success" | "error";

const pulseKeyframes = `
@keyframes saveGlow {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(197, 165, 114, 0);
  }
  50% {
    box-shadow: 0 0 12px 2px rgba(197, 165, 114, 0.15);
  }
}
`;

/* ── Main Settings page ─────────────────────────────────────────────── */

export default function SettingsPage() {
  const { data: remote, isLoading, error: fetchError } = useSettings();

  const [values, setValues] = useState<Record<string, string>>({});
  const [initialValues, setInitialValues] = useState<Record<string, string>>({});
  const [sources, setSources] = useState<Record<string, "database" | "env" | "none">>({});
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [validationResults, setValidationResults] = useState<Record<string, ValidationResult | null>>({});

  // Hydrate form from API response (handles both new and legacy format)
  useEffect(() => {
    if (remote && !hydrated) {
      const flat: Record<string, string> = {};
      const src: Record<string, "database" | "env" | "none"> = {};

      if (Array.isArray(remote.settings)) {
        for (const item of remote.settings) {
          flat[item.key] = item.maskedValue;
          src[item.key] = item.source;
        }
      } else {
        const raw = remote as unknown as Record<string, unknown>;
        for (const [k, v] of Object.entries(raw)) {
          if (k !== "settings" && k !== "configurableKeys") {
            flat[k.toUpperCase()] = v != null ? String(v) : "";
            src[k.toUpperCase()] = "database";
          }
        }
      }

      setValues(flat);
      setInitialValues(flat);
      setSources(src);
      setHydrated(true);
    }
  }, [remote, hydrated]);

  const handleChange = useCallback((key: string, val: string) => {
    setValues((prev) => ({ ...prev, [key]: val }));
    setSaveStatus("idle");
    setSaveError(null);
  }, []);

  const handleValidationResult = useCallback((sectionId: string, result: ValidationResult | null) => {
    setValidationResults((prev) => ({ ...prev, [sectionId]: result }));
  }, []);

  const allKeys = new Set([...Object.keys(values), ...Object.keys(initialValues)]);
  const dirtyKeys: string[] = [];
  allKeys.forEach((k) => {
    if ((values[k] ?? "") !== (initialValues[k] ?? "")) {
      dirtyKeys.push(k);
    }
  });
  const hasChanges = dirtyKeys.length > 0;

  // Find which sections have dirty keys
  const dirtySections = new Set<string>();
  for (const k of dirtyKeys) {
    for (const s of SECTIONS) {
      if (s.fields.some((f) => f.key === k)) {
        dirtySections.add(s.id);
      }
    }
  }

  const handleSave = async () => {
    if (!hasChanges) return;

    setSaveStatus("saving");
    setSaveError(null);
    setValidationResults({});

    const keys: Record<string, string | null> = {};
    for (const k of dirtyKeys) {
      const val = values[k]?.trim() ?? "";
      keys[k] = val === "" ? null : val;
    }

    try {
      await putApi("/dashboard/settings", { keys });
      setSaveStatus("success");
      setInitialValues({ ...values });

      setSources((prev) => {
        const next = { ...prev };
        for (const k of dirtyKeys) {
          next[k] = keys[k] ? "database" : "none";
        }
        return next;
      });

      // Auto-validate each dirty section that is testable
      for (const sectionId of dirtySections) {
        const section = SECTIONS.find((s) => s.id === sectionId);
        if (!section?.testable) continue;

        const sectionValues: Record<string, string> = {};
        for (const f of section.fields) {
          if (values[f.key]) sectionValues[f.key] = values[f.key];
        }

        postApi<ValidationResult>("/dashboard/settings/validate", {
          section: sectionId,
          values: sectionValues,
        })
          .then((result) => {
            setValidationResults((prev) => ({ ...prev, [sectionId]: result }));
          })
          .catch((err) => {
            setValidationResults((prev) => ({
              ...prev,
              [sectionId]: { valid: false, message: err instanceof Error ? err.message : "Validation failed" },
            }));
          });
      }

      setTimeout(() => {
        setSaveStatus((prev) => (prev === "success" ? "idle" : prev));
      }, 3000);
    } catch (err) {
      setSaveStatus("error");
      setSaveError(err instanceof Error ? err.message : "Failed to save settings");
    }
  };

  return (
    <>
      <style>{pulseKeyframes}</style>

      <PageHeader title="Settings" />

      {isLoading ? (
        <SettingsSkeleton />
      ) : fetchError ? (
        <div className="border p-6" style={{ background: "#141513", borderColor: "#2A2B28" }}>
          <p className="text-sm font-mono" style={{ color: "#f87171" }}>
            Failed to load settings: {fetchError.message ?? "Unknown error"}
          </p>
        </div>
      ) : (
        <>
          <DataManagementBar />

          {SECTIONS.map((section) => (
            <SettingsSection
              key={section.id}
              section={section}
              values={values}
              sources={sources}
              onChange={handleChange}
              validationResult={validationResults[section.id]}
              onValidationResult={handleValidationResult}
            />
          ))}

          {/* Save bar */}
          <div
            className="border p-4 flex items-center justify-between sticky bottom-0 z-10"
            style={{
              background: "#1A1B19",
              borderColor: "#3A3B37",
              borderTopWidth: "2px",
              borderTopColor: hasChanges ? "#656453" : "#3A3B37",
              boxShadow: "0 -8px 24px rgba(0, 0, 0, 0.6)",
            }}
          >
            <div className="flex items-center gap-3">
              {saveStatus === "success" && (
                <span className="flex items-center gap-2 text-xs font-mono">
                  <span className="inline-block w-1.5 h-1.5" style={{ background: "#C5A572", borderRadius: "50%" }} />
                  <span style={{ color: "#9A9880" }}>Settings saved</span>
                </span>
              )}
              {saveStatus === "error" && (
                <span className="flex items-center gap-2 text-xs font-mono">
                  <span className="inline-block w-1.5 h-1.5" style={{ background: "#f87171", borderRadius: "50%" }} />
                  <span style={{ color: "#f87171" }}>{saveError ?? "Save failed"}</span>
                </span>
              )}
              {hasChanges && saveStatus === "idle" && (
                <span className="text-xs font-mono" style={{ color: "#7A7968" }}>
                  {dirtyKeys.length} unsaved change{dirtyKeys.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={!hasChanges || saveStatus === "saving"}
              className="px-6 py-2.5 text-xs uppercase tracking-[0.1em] font-medium border transition-all duration-200"
              style={{
                background: hasChanges ? "#C5A572" : "#1A1B19",
                color: hasChanges ? "#0C0D0B" : "#4A4B47",
                borderColor: hasChanges ? "#C5A572" : "#2A2B28",
                cursor: hasChanges ? "pointer" : "default",
                opacity: saveStatus === "saving" ? 0.6 : 1,
                animation: hasChanges ? "saveGlow 2s ease-in-out infinite" : "none",
              }}
            >
              {saveStatus === "saving" ? "Saving..." : "Save All"}
            </button>
          </div>
        </>
      )}
    </>
  );
}
