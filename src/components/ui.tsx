"use client";

import { useEffect } from "react";
import { Icon } from "./Icon";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-brand-950">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-[var(--ink-2)]">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = "default",
  delta,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  icon?: string;
  tone?: "default" | "dark" | "warn";
  delta?: number | null;
}) {
  const dark = tone === "dark";
  return (
    <div
      className={`rounded-xl border p-4 ${
        dark
          ? "border-brand-800 bg-brand-800 text-white"
          : tone === "warn"
          ? "border-amber-200 bg-amber-50"
          : "border-[var(--line)] bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={`text-xs font-medium uppercase tracking-wide ${dark ? "text-brand-200" : "text-[var(--ink-3)]"}`}>
          {label}
        </p>
        {icon && (
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-lg ${
              dark ? "bg-brand-700 text-lime-accent" : tone === "warn" ? "bg-amber-100 text-amber-700" : "bg-brand-100 text-brand-700"
            }`}
          >
            <Icon name={icon} />
          </span>
        )}
      </div>
      <p className={`num mt-1 text-2xl font-semibold tracking-tight ${dark ? "text-white" : "text-brand-950"}`}>{value}</p>
      <div className={`mt-1 flex items-center gap-2 text-xs ${dark ? "text-brand-200" : "text-[var(--ink-2)]"}`}>
        {delta != null && Number.isFinite(delta) && (
          <span
            className={`num rounded px-1.5 py-0.5 font-semibold ${
              delta >= 0
                ? dark
                  ? "bg-brand-700 text-lime-accent"
                  : "bg-brand-100 text-brand-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
          </span>
        )}
        {sub}
      </div>
    </div>
  );
}

const BADGE: Record<string, string> = {
  green: "bg-brand-100 text-brand-800",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-700",
  gray: "bg-gray-100 text-gray-700",
  blue: "bg-sky-100 text-sky-800",
};

export function Badge({ tone = "gray", children }: { tone?: keyof typeof BADGE; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${BADGE[tone]}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [keyof typeof BADGE, string]> = {
    Paid: ["green", "✓"],
    Partial: ["amber", "◐"],
    Unpaid: ["red", "○"],
    "In stock": ["green", "●"],
    "Low stock": ["amber", "▲"],
    "Out of stock": ["red", "✕"],
    "Slow moving": ["amber", "◷"],
    Overdue: ["red", "!"],
  };
  const [tone, glyph] = map[status] ?? ["gray", "•"];
  return (
    <Badge tone={tone}>
      <span aria-hidden>{glyph}</span>
      {status}
    </Badge>
  );
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-950/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
      <div className="absolute inset-0" onClick={onClose} />
      <div
        className={`relative flex max-h-[94vh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl ${
          wide ? "sm:max-w-4xl" : "sm:max-w-xl"
        }`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-brand-950">{title}</h2>
            {subtitle && <p className="text-sm text-[var(--ink-2)]">{subtitle}</p>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--line)] bg-brand-50/50 px-6 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
  error,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  error?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-red-600">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-[var(--ink-3)]">{hint}</span>
      ) : null}
    </label>
  );
}

export function Section({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <fieldset className={`mb-5 ${className}`}>
      <legend className="mb-3 text-xs font-semibold uppercase tracking-wider text-brand-700">{title}</legend>
      {children}
    </fieldset>
  );
}

export function Card({
  title,
  subtitle,
  action,
  children,
  className = "",
  bodyClass = "p-4",
}: {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClass?: string;
}) {
  return (
    <div className={`card ${className}`}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
          <div>
            {title && <h3 className="text-sm font-semibold text-brand-950">{title}</h3>}
            {subtitle && <p className="text-xs text-[var(--ink-3)]">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={bodyClass}>{children}</div>
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-[var(--line)] bg-white p-0.5">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            value === o ? "bg-brand-700 text-white" : "text-[var(--ink-2)] hover:text-brand-800"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return <div className="px-4 py-10 text-center text-sm text-[var(--ink-3)]">{text}</div>;
}

export function Loading() {
  return (
    <div className="flex h-64 items-center justify-center text-sm text-[var(--ink-3)]">
      <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand-300 border-t-brand-700" />
      Loading BroadPharma data…
    </div>
  );
}
