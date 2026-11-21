import type { Product, Sale, SaleStatus } from "./types";

export const money = (n: number) =>
  "ETB " + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const money0 = (n: number) => "ETB " + Math.round(n).toLocaleString("en-US");

export const compact = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 1 : 2).replace(/\.0+$/, "") + "M";
  if (a >= 1e3) return (n / 1e3).toFixed(a >= 1e4 ? 0 : 1).replace(/\.0$/, "") + "K";
  return Math.round(n).toString();
};

export const int = (n: number) => Math.round(n).toLocaleString("en-US");

export const round2 = (n: number) => Math.round(n * 100) / 100;

/* ---------- dates (stored as local YYYY-MM-DD) ---------- */

export const toISO = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const parseISO = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const todayISO = () => toISO(new Date());

export const addDays = (s: string, n: number) => {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
};

export const daysBetween = (a: string, b: string) =>
  Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);

export const fmtDate = (s: string) =>
  s ? parseISO(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Monday-based start of week */
export const startOfWeek = (s: string) => {
  const d = parseISO(s);
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return toISO(d);
};

/* ---------- sale helpers ---------- */

export const paidOf = (s: Sale) => round2(s.payments.reduce((a, p) => a + p.amount, 0));
export const remainingOf = (s: Sale) => Math.max(0, round2(s.total - paidOf(s)));
export const statusOf = (s: Sale): SaleStatus => {
  const paid = paidOf(s);
  if (paid >= s.total - 0.005) return "Paid";
  if (paid > 0) return "Partial";
  return "Unpaid";
};
export const isOverdue = (s: Sale, today = todayISO()) =>
  statusOf(s) !== "Paid" && !!s.dueDate && s.dueDate < today;

export const computeTotals = (qty: number, unitPrice: number, discount: number, vatRate: number) => {
  const subtotal = round2(Math.max(0, qty * unitPrice - discount));
  const vatAmount = round2((subtotal * vatRate) / 100);
  return { subtotal, vatAmount, total: round2(subtotal + vatAmount) };
};

/* ---------- product helpers ---------- */

export type StockStatus = "In stock" | "Low stock" | "Out of stock";
export const stockStatus = (p: Product): StockStatus =>
  p.quantity <= 0 ? "Out of stock" : p.quantity <= p.reorderLevel ? "Low stock" : "In stock";

export const SLOW_MOVING_DAYS = 90;

/** Map of productId → most recent sale date */
export const lastSoldMap = (sales: Sale[]) => {
  const m = new Map<string, string>();
  for (const s of sales) {
    const cur = m.get(s.productId);
    if (!cur || s.date > cur) m.set(s.productId, s.date);
  }
  return m;
};

/** In stock but not sold for SLOW_MOVING_DAYS (counting from the later of last sale / date added) */
export const isSlowMoving = (p: Product, lastSold: Map<string, string>, today = todayISO()) => {
  if (p.quantity <= 0) return false;
  const last = lastSold.get(p.id);
  const since = last && last > p.dateAdded ? last : p.dateAdded;
  return daysBetween(since, today) >= SLOW_MOVING_DAYS;
};

export const daysSinceSold = (p: Product, lastSold: Map<string, string>, today = todayISO()) => {
  const last = lastSold.get(p.id);
  return last ? daysBetween(last, today) : null;
};

export const warrantyLabel = (months: number) =>
  !months ? "No warranty" : months % 12 === 0 ? `${months / 12} yr${months > 12 ? "s" : ""}` : `${months} mo`;

export const downloadCSV = (filename: string, rows: (string | number)[][]) => {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
