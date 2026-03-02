"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSettings } from "@/lib/hooks";
import { fetchApi, putApi, postApi } from "@/lib/api";
import { PageHeader } from "@/components/page-header";

/* ── Types ──────────────────────────────────────────────────────────── */

interface FieldDef {
  key: string;
  label: string;
  type: "text" | "password" | "textarea" | "select";
  hint?: string;
  howToGet?: string;
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
    title: "WooCommerce Store",
    icon: "\u2302",
    description:
      "Connect your WooCommerce store to sync products, orders, and customer data in real time.",
    testable: true,
    fields: [
      {
        key: "WOO_URL",
        label: "Store URL",
        type: "text",
        hint: "Full URL of your WooCommerce store",
        howToGet: "Your store's main URL, e.g. https://store.sbek.com",
        required: true,
      },
      {
        key: "WOO_CONSUMER_KEY",
        label: "Consumer Key",
        type: "password",
        hint: "Starts with ck_",
        howToGet: "WooCommerce → Settings → Advanced → REST API → Add Key → Read/Write",
        required: true,
      },
      {
        key: "WOO_CONSUMER_SECRET",
        label: "Consumer Secret",
        type: "password",
        hint: "Starts with cs_",
        howToGet: "Generated alongside the Consumer Key above",
        required: true,
      },
      {
        key: "WOO_WEBHOOK_SECRET",
        label: "Webhook Secret",
        type: "password",
        hint: "Secret for verifying webhook payloads",
        howToGet: "WooCommerce → Settings → Advanced → Webhooks → Add → copy the Secret",
        required: true,
      },
    ],
  },
  {
    id: "google-sheets",
    title: "Google Sheets & Drive",
    icon: "\u25A6",
    description:
      "Connect your Google account to sync order data to Sheets and upload creatives to Drive. Use OAuth (recommended) or service account credentials as fallback.",
    testable: true,
    fields: [
      {
        key: "GOOGLE_SHEET_ID",
        label: "Google Sheet ID",
        type: "text",
        hint: "The long ID string from your Google Sheet URL",
        howToGet: "Open your Sheet → copy the ID from the URL between /d/ and /edit",
        required: true,
      },
      {
        key: "GOOGLE_OAUTH_CLIENT_ID",
        label: "OAuth Client ID",
        type: "text",
        hint: "Required for 'Connect Google Account' button below",
        howToGet: "Google Cloud Console → APIs & Services → Credentials → Create OAuth Client ID (Web App type)",
      },
      {
        key: "GOOGLE_OAUTH_CLIENT_SECRET",
        label: "OAuth Client Secret",
        type: "password",
        hint: "Required for 'Connect Google Account' button below",
        howToGet: "Shown once when you create the OAuth Client ID above — copy it immediately",
      },
      {
        key: "GOOGLE_SERVICE_ACCOUNT_EMAIL",
        label: "Service Account Email (fallback)",
        type: "text",
        hint: "Only needed if NOT using OAuth above",
        howToGet: "Google Cloud Console → IAM & Admin → Service Accounts → Create → copy email (e.g. sbek-bot@project.iam.gserviceaccount.com)",
      },
      {
        key: "GOOGLE_PRIVATE_KEY",
        label: "Service Account Private Key (fallback)",
        type: "textarea",
        hint: "Only needed if NOT using OAuth above. PEM-encoded key.",
        howToGet: "Service Account → Keys → Add Key → JSON → copy the \"private_key\" field from the downloaded JSON",
      },
    ],
  },
  {
    id: "whatsapp-meta",
    title: "WhatsApp (Meta Cloud API)",
    icon: "\u2709",
    description:
      "Primary WhatsApp Business Cloud API for order confirmations, shipping updates, and review requests.",
    testable: true,
    fields: [
      {
        key: "WHATSAPP_PHONE_NUMBER_ID",
        label: "Phone Number ID",
        type: "text",
        hint: "Numeric ID, NOT your phone number",
        howToGet: "Meta Business Suite → WhatsApp → API Setup → Phone Number ID (e.g. 123456789012345)",
        required: true,
      },
      {
        key: "WHATSAPP_ACCESS_TOKEN",
        label: "Permanent Access Token",
        type: "password",
        hint: "Long-lived token for API access",
        howToGet: "Meta Business Suite → WhatsApp → API Setup → Generate Permanent Token",
        required: true,
      },
    ],
  },
  {
    id: "whatsapp-backup",
    title: "WhatsApp Backup (Wati / Interakt)",
    icon: "\u2709",
    description:
      "Backup WhatsApp providers. If Meta Cloud API fails, the system falls back to Wati first, then Interakt. Optional — skip if not needed.",
    fields: [
      {
        key: "WATI_API_KEY",
        label: "Wati API Key",
        type: "password",
        hint: "Optional backup provider",
        howToGet: "Wati Dashboard → Settings → API Keys → copy",
      },
      {
        key: "WATI_BASE_URL",
        label: "Wati Base URL",
        type: "text",
        hint: "e.g. https://live-mt-server.wati.io",
        howToGet: "Provided by Wati when you sign up",
      },
      {
        key: "INTERAKT_API_KEY",
        label: "Interakt API Key",
        type: "password",
        hint: "Optional 2nd fallback provider",
        howToGet: "Interakt Dashboard → Developers → API Keys → copy",
      },
    ],
  },
  {
    id: "email-smtp",
    title: "Email (SMTP)",
    icon: "\u2707",
    description:
      "Outbound email for order confirmations, shipping updates, and marketing. For Gmail, use an App Password (not your regular password).",
    testable: true,
    fields: [
      {
        key: "SMTP_HOST",
        label: "SMTP Host",
        type: "text",
        hint: "e.g. smtp.gmail.com",
        howToGet: "Gmail: smtp.gmail.com  |  Outlook: smtp.office365.com  |  Custom: check your email provider",
        required: true,
      },
      {
        key: "SMTP_PORT",
        label: "SMTP Port",
        type: "text",
        hint: "587 for TLS (recommended), 465 for SSL",
        howToGet: "Use 587 for Gmail/most providers",
        required: true,
      },
      {
        key: "SMTP_USER",
        label: "Email Address",
        type: "text",
        hint: "Your full email address used to send",
        howToGet: "e.g. orders@sbek.com or your Gmail address",
        required: true,
      },
      {
        key: "SMTP_PASS",
        label: "Email Password / App Password",
        type: "password",
        hint: "For Gmail: must be an App Password, not your regular password",
        howToGet: "Gmail: Google Account → Security → 2-Step Verification → App Passwords → Generate for 'Mail' → copy the 16-char password",
        required: true,
      },
      {
        key: "EMAIL_FROM",
        label: "From Display Name",
        type: "text",
        hint: "How emails appear to recipients",
        howToGet: 'Format: Brand Name <email@domain.com>  e.g. SBEK <orders@sbek.com>',
      },
    ],
  },
  {
    id: "ai",
    title: "AI — Text & Image Generation",
    icon: "\u2726",
    description:
      "OpenRouter for text generation (product descriptions, SEO, captions, competitor analysis). Gemini for product image generation. If no OpenRouter key, Gemini is used for both.",
    testable: true,
    fields: [
      {
        key: "OPENROUTER_API_KEY",
        label: "OpenRouter API Key",
        type: "password",
        hint: "Powers all text generation. Falls back to Gemini if not set.",
        howToGet: "openrouter.ai → Sign Up → Dashboard → API Keys → Create Key → copy",
        required: true,
      },
      {
        key: "GEMINI_API_KEY",
        label: "Gemini API Key",
        type: "password",
        hint: "Powers image generation. Also used as text fallback if OpenRouter is not set.",
        howToGet: "aistudio.google.com → Get API Key → Create → copy",
      },
    ],
  },
  {
    id: "social-media",
    title: "Social Media (Postiz)",
    icon: "\u269B",
    description:
      "Auto-publish to Instagram, Facebook, and Pinterest via Postiz scheduling.",
    testable: true,
    fields: [
      {
        key: "POSTIZ_API_KEY",
        label: "Postiz API Key",
        type: "password",
        hint: "For auto-scheduling social posts",
        howToGet: "app.postiz.com → Settings → API → Generate Key → copy",
        required: true,
      },
      {
        key: "POSTIZ_BASE_URL",
        label: "Postiz Base URL",
        type: "text",
        hint: "Default: https://app.postiz.com/api/v1 — change only if self-hosting",
      },
    ],
  },
  {
    id: "crawler",
    title: "Competitor Crawler",
    icon: "\u2318",
    description:
      "Web crawler for competitive intelligence and price monitoring.",
    testable: true,
    fields: [
      {
        key: "CRAWLER_BASE_URL",
        label: "Crawler Service URL",
        type: "text",
        hint: "Default: http://crawler:3001 (Docker) or http://localhost:3001 (dev)",
        howToGet: "Only change this if you've deployed the crawler separately",
      },
    ],
  },
  {
    id: "brand",
    title: "Brand Identity",
    icon: "\u2605",
    description:
      "Your brand details — used in emails, WhatsApp messages, AI-generated content, and social posts.",
    fields: [
      {
        key: "BRAND_NAME",
        label: "Brand Name",
        type: "text",
        hint: "e.g. SBEK",
        required: true,
      },
      {
        key: "BRAND_PRIMARY_COLOR",
        label: "Primary Color",
        type: "text",
        hint: "Hex code, e.g. #B8860B (used in email templates)",
      },
      {
        key: "BRAND_WEBSITE",
        label: "Website URL",
        type: "text",
        hint: "e.g. https://sbek.com",
      },
      {
        key: "BRAND_SUPPORT_PHONE",
        label: "Support Phone",
        type: "text",
        hint: "e.g. +91XXXXXXXXXX",
      },
      {
        key: "BRAND_SUPPORT_EMAIL",
        label: "Support Email",
        type: "text",
        hint: "e.g. support@sbek.com",
      },
      {
        key: "REVIEW_URL",
        label: "Review Link",
        type: "text",
        hint: "Where customers leave reviews (Google, Trustpilot, etc.)",
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
      style={{
        transition: "transform 300ms cubic-bezier(0.4, 0, 0.2, 1)",
        transform: open ? "rotate(0deg)" : "rotate(-90deg)",
        willChange: "transform",
      }}
    >
      <path d="M3 5l4 4 4-4" />
    </svg>
  );
}

function ValidationIcon({ filled }: { filled: boolean }) {
  if (filled) {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0">
        <circle cx="7" cy="7" r="6" stroke="var(--text-secondary)" strokeWidth="1.2" fill="none" />
        <path d="M4 7l2 2 4-4" stroke="var(--text-secondary)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0">
      <circle cx="7" cy="7" r="6" stroke="var(--border-strong)" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" className="flex-shrink-0">
      <circle cx="6" cy="6" r="5" />
      <path d="M6 5.5v3" />
      <circle cx="6" cy="3.8" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

/* ── Skeleton ───────────────────────────────────────────────────────── */

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse ${className ?? ""}`} style={{ background: "var(--bg-hover)" }} />
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="p-6"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
          }}
        >
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
      className="flex items-start gap-2 px-3 py-2 mt-2 text-[11px] font-mono leading-relaxed animate-enter-fade"
      style={{
        background: result.valid ? "#F0FAF0" : "#FFF0F0",
        border: `1px solid ${result.valid ? "#D5E8D5" : "#E8D5D5"}`,
        borderRadius: "var(--radius-sm)",
        color: result.valid ? "var(--text-secondary)" : "var(--error)",
      }}
    >
      <span className="flex-shrink-0 mt-0.5">{result.valid ? "\u2713" : "\u2717"}</span>
      <span className="flex-1">{result.message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="flex-shrink-0 ml-2 opacity-50 hover:opacity-100 transition-opacity"
        style={{ color: result.valid ? "var(--text-secondary)" : "var(--error)" }}
      >
        \u2715
      </button>
    </div>
  );
}

/* ── Google OAuth Connect Button ────────────────────────────────────── */

function GoogleOAuthButton({ values }: { values: Record<string, string> }) {
  const [status, setStatus] = useState<{ connected: boolean; email: string }>({ connected: false, email: "" });
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    fetchApi<{ connected: boolean; email: string }>("/auth/google/status")
      .then(setStatus)
      .catch(() => setStatus({ connected: false, email: "" }))
      .finally(() => setLoading(false));
  }, []);

  const handleConnect = () => {
    window.location.href = "/api/auth/google/authorize";
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await postApi("/auth/google/disconnect");
      setStatus({ connected: false, email: "" });
    } catch {
      // ignore
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return <div className="text-[11px] py-2" style={{ color: "var(--text-subtle)" }}>Checking Google connection...</div>;
  }

  if (status.connected) {
    return (
      <div
        className="flex items-center justify-between px-3 py-2.5 mb-4"
        style={{
          background: "#F0FAF0",
          border: "1px solid #D5E8D5",
          borderRadius: "var(--radius-sm)",
        }}
      >
        <span className="flex items-center gap-2 text-[11px]" style={{ color: "var(--text-secondary)" }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" />
            <path d="M4 7l2 2 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Connected as <strong>{status.email}</strong>
        </span>
        <button
          type="button"
          onClick={handleDisconnect}
          disabled={disconnecting}
          className="btn-ghost px-2 py-1 text-[10px] uppercase tracking-wider font-medium"
          style={{ color: "var(--error)", opacity: disconnecting ? 0.5 : 1 }}
        >
          {disconnecting ? "Disconnecting..." : "Disconnect"}
        </button>
      </div>
    );
  }

  // Check if OAuth client ID and secret are filled in
  const hasClientId = !!(values["GOOGLE_OAUTH_CLIENT_ID"]?.trim()) && !values["GOOGLE_OAUTH_CLIENT_ID"]?.includes("***");
  const hasClientSecret = !!(values["GOOGLE_OAUTH_CLIENT_SECRET"]?.trim()) && !values["GOOGLE_OAUTH_CLIENT_SECRET"]?.includes("***");
  // Also consider them "set" if the source is ENV/DB (masked values)
  const credsConfigured = (hasClientId && hasClientSecret) ||
    (values["GOOGLE_OAUTH_CLIENT_ID"]?.includes("***") && values["GOOGLE_OAUTH_CLIENT_SECRET"]?.includes("***"));

  if (!credsConfigured) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-2.5 mb-4 text-[11px]"
        style={{
          background: "#FFFBF0",
          border: "1px solid #E8DFC0",
          borderRadius: "var(--radius-sm)",
          color: "var(--text-muted)",
        }}
      >
        <InfoIcon />
        <span>
          Fill in <strong>OAuth Client ID</strong> and <strong>OAuth Client Secret</strong> below, save, then the Connect button will appear.
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleConnect}
      className="btn-ghost w-full px-4 py-2.5 mb-4 text-[11px] uppercase tracking-[0.08em] font-medium flex items-center justify-center gap-2"
      style={{
        background: "#F0F6FF",
        borderColor: "#D5E0F0",
        color: "var(--text-muted)",
      }}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
        <circle cx="7" cy="7" r="5.5" />
        <path d="M7 4v6M4 7h6" />
      </svg>
      Connect Google Account (Sheets + Drive)
    </button>
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
      className="btn-ghost px-3 py-1.5 text-[11px] uppercase tracking-[0.08em] font-medium"
      style={{
        opacity: testing ? 0.7 : 1,
        color: testing ? "var(--text-subtle)" : "var(--text-muted)",
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
      className="mb-6 p-4"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          <h3
            className="text-xs uppercase tracking-[0.15em] font-medium mb-1"
            style={{ color: "var(--text-muted)" }}
          >
            Demo Data
          </h3>
          <p className="text-[11px]" style={{ color: "var(--text-subtle)" }}>
            Seed sample data to test the dashboard, or erase it before going live.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSeed}
            disabled={seedStatus === "loading" || resetStatus === "loading"}
            className="btn-ghost px-4 py-2 text-[11px] uppercase tracking-[0.08em] font-medium"
            style={{
              background: seedStatus === "loading" ? "var(--bg-hover)" : "#F0FAF0",
              borderColor: "#D5E8D5",
              color: seedStatus === "loading" ? "var(--text-subtle)" : "var(--text-secondary)",
              opacity: seedStatus === "loading" ? 0.7 : 1,
            }}
          >
            {seedStatus === "loading" ? "Seeding..." : seedStatus === "success" ? "Seeded!" : "Seed Demo Data"}
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={seedStatus === "loading" || resetStatus === "loading"}
            className="btn-ghost px-4 py-2 text-[11px] uppercase tracking-[0.08em] font-medium"
            style={{
              background: confirmReset ? "#FFE8E8" : resetStatus === "loading" ? "var(--bg-hover)" : "#FFF0F0",
              borderColor: confirmReset ? "var(--error)" : "#E8D5D5",
              color: confirmReset ? "var(--error)" : resetStatus === "loading" ? "var(--text-subtle)" : "var(--error)",
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
          className="mt-3 px-3 py-2 text-[11px] font-mono animate-enter-fade"
          style={{
            background:
              seedStatus === "error" || resetStatus === "error" ? "#FFF0F0" : "#F0FAF0",
            border: `1px solid ${seedStatus === "error" || resetStatus === "error" ? "#E8D5D5" : "#D5E8D5"}`,
            borderRadius: "var(--radius-sm)",
            color:
              seedStatus === "error" || resetStatus === "error" ? "var(--error)" : "var(--text-secondary)",
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

  const inputClasses = "input w-full font-mono text-sm";

  const sourceBadge = source && source !== "none" && (
    <span
      className="badge text-[9px] font-mono uppercase tracking-wider"
      style={{
        color: source === "database" ? "var(--text-secondary)" : "var(--warning)",
        background: source === "database" ? "#F0FAF0" : "#FFFEF0",
      }}
    >
      {source === "database" ? "DB" : "ENV"}
    </span>
  );

  const labelRow = (
    <div className="flex items-center gap-2 mb-1.5">
      <ValidationIcon filled={hasFill} />
      <label
        className="text-xs"
        style={{
          color: "var(--text-muted)",
          fontWeight: field.required ? 600 : 400,
        }}
      >
        {field.label}
      </label>
      {field.required && (
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#CC3333" }}>
          Required
        </span>
      )}
      {sourceBadge}
    </div>
  );

  const hintBlock = (
    <>
      {field.hint && <p className="text-[11px] mt-1" style={{ color: "var(--text-subtle)" }}>{field.hint}</p>}
      {field.howToGet && (
        <p className="text-[10px] mt-0.5 flex items-start gap-1" style={{ color: "var(--text-disabled)" }}>
          <span className="flex-shrink-0 mt-px" style={{ fontSize: "9px" }}>&#9432;</span>
          <span>{field.howToGet}</span>
        </p>
      )}
    </>
  );

  if (isSelect) {
    return (
      <div className="mb-5">
        {labelRow}
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClasses}
          style={{ appearance: "none" }}
        >
          <option value="">-- select --</option>
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        {hintBlock}
      </div>
    );
  }

  if (isTextarea) {
    return (
      <div className="mb-5">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <ValidationIcon filled={hasFill} />
            <label
              className="text-xs"
              style={{
                color: "var(--text-muted)",
                fontWeight: field.required ? 600 : 400,
              }}
            >
              {field.label}
            </label>
            {field.required && (
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#CC3333" }}>
                Required
              </span>
            )}
            {sourceBadge}
          </div>
          <button
            type="button"
            onClick={() => setVisible(!visible)}
            className="p-1 transition-colors"
            style={{ color: "var(--text-subtle)" }}
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
          style={
            visible ? undefined : ({ WebkitTextSecurity: "disc" } as React.CSSProperties)
          }
          spellCheck={false}
        />
        {hintBlock}
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
          spellCheck={false}
          autoComplete="off"
        />
        {isSensitive && (
          <button
            type="button"
            onClick={() => setVisible(!visible)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 transition-colors"
            style={{ color: "var(--text-subtle)" }}
            title={visible ? "Hide value" : "Show value"}
          >
            {visible ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
      </div>
      {hintBlock}
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
    <div
      className="mb-4"
      style={{
        border: "1px solid var(--border)",
        background: "var(--bg-surface)",
        borderRadius: "var(--radius-md)",
      }}
    >
      <button
        type="button"
        onClick={toggleOpen}
        className="w-full flex items-center justify-between px-5 py-4 text-left row-hover"
        style={{ borderRadius: "var(--radius-md)" }}
      >
        <div className="flex items-center gap-3">
          <span className="text-base leading-none" style={{ color: "var(--text-subtle)" }}>{section.icon}</span>
          <h2 className="text-xs uppercase tracking-[0.15em] font-medium" style={{ color: "var(--text-muted)" }}>
            {section.title}
          </h2>
          <span
            className="text-[10px] font-mono"
            style={{ color: configuredCount === totalCount ? "var(--text-secondary)" : "var(--text-disabled)" }}
          >
            {configuredCount}/{totalCount}
          </span>
        </div>
        <span style={{ color: "var(--text-subtle)" }}>
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
          <div className="px-5 pb-5" style={{ borderTop: "1px solid var(--border)" }}>
            <p className="text-[11px] leading-relaxed pt-4 pb-3" style={{ color: "var(--text-subtle)" }}>
              {section.description}
            </p>
            {section.id === "google-sheets" && <GoogleOAuthButton values={values} />}
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
                className="pt-3 mt-1 flex items-center justify-between gap-3"
                style={{ borderTop: "1px solid var(--border)" }}
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
    <div className="animate-enter">
      <PageHeader title="Settings" />

      {isLoading ? (
        <SettingsSkeleton />
      ) : fetchError ? (
        <div
          className="p-6"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <p className="text-sm font-mono" style={{ color: "var(--error)" }}>
            Failed to load settings: {fetchError.message ?? "Unknown error"}
          </p>
        </div>
      ) : (
        <>
          <DataManagementBar />

          <div className="stagger">
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
          </div>

          {/* Save bar */}
          <div
            className="p-4 flex items-center justify-between sticky bottom-0 z-10"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-strong)",
              borderRadius: "var(--radius-md)",
              borderTopWidth: "2px",
              borderTopColor: hasChanges ? "var(--text-subtle)" : "var(--border-strong)",
              boxShadow: "0 -4px 12px rgba(0, 0, 0, 0.06)",
            }}
          >
            <div className="flex items-center gap-3">
              {saveStatus === "success" && (
                <span className="flex items-center gap-2 text-xs font-mono animate-enter-fade">
                  <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: "var(--success)" }} />
                  <span style={{ color: "var(--text-muted)" }}>Settings saved</span>
                </span>
              )}
              {saveStatus === "error" && (
                <span className="flex items-center gap-2 text-xs font-mono animate-enter-fade">
                  <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: "var(--error)" }} />
                  <span style={{ color: "var(--error)" }}>{saveError ?? "Save failed"}</span>
                </span>
              )}
              {hasChanges && saveStatus === "idle" && (
                <span className="text-xs font-mono" style={{ color: "var(--text-subtle)" }}>
                  {dirtyKeys.length} unsaved change{dirtyKeys.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={!hasChanges || saveStatus === "saving"}
              className={hasChanges ? "btn-solid px-6 py-2.5 text-xs uppercase tracking-[0.1em] font-medium" : "px-6 py-2.5 text-xs uppercase tracking-[0.1em] font-medium"}
              style={
                hasChanges
                  ? {
                      opacity: saveStatus === "saving" ? 0.6 : 1,
                      borderRadius: "var(--radius-sm)",
                    }
                  : {
                      background: "var(--bg-hover)",
                      color: "var(--text-disabled)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)",
                      cursor: "default",
                    }
              }
            >
              {saveStatus === "saving" ? "Saving..." : "Save All"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
