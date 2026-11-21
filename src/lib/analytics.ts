import type { Product, Sale, StockEntry } from "./types";
import { MONTHS, MONTHS_LONG, addDays, fmtDate, paidOf, parseISO, startOfWeek, toISO } from "./format";

export type PeriodType = "Year" | "Month" | "Week";

export type Bucket = { key: string; label: string; start: string; end: string };
export type Range = { start: string; end: string; label: string; buckets: Bucket[] };

export function rangeFor(type: PeriodType, anchor: string): Range {
  const d = parseISO(anchor);
  if (type === "Year") {
    const y = d.getFullYear();
    const buckets = MONTHS.map((m, i) => {
      const start = toISO(new Date(y, i, 1));
      const end = toISO(new Date(y, i + 1, 0));
      return { key: start, label: m, start, end };
    });
    return { start: `${y}-01-01`, end: `${y}-12-31`, label: String(y), buckets };
  }
  if (type === "Month") {
    const y = d.getFullYear(), m = d.getMonth();
    const days = new Date(y, m + 1, 0).getDate();
    const buckets = Array.from({ length: days }, (_, i) => {
      const s = toISO(new Date(y, m, i + 1));
      return { key: s, label: String(i + 1), start: s, end: s };
    });
    return { start: buckets[0].start, end: buckets[days - 1].end, label: `${MONTHS_LONG[m]} ${y}`, buckets };
  }
  const start = startOfWeek(anchor);
  const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const buckets = names.map((n, i) => {
    const s = addDays(start, i);
    return { key: s, label: `${n} ${parseISO(s).getDate()}`, start: s, end: s };
  });
  const end = addDays(start, 6);
  return { start, end, label: `${fmtDate(start)} – ${fmtDate(end)}`, buckets };
}

export function shiftAnchor(type: PeriodType, anchor: string, dir: number) {
  const d = parseISO(anchor);
  if (type === "Year") return toISO(new Date(d.getFullYear() + dir, d.getMonth(), 1));
  if (type === "Month") return toISO(new Date(d.getFullYear(), d.getMonth() + dir, 1));
  return addDays(anchor, 7 * dir);
}

const inRange = (date: string, r: { start: string; end: string }) => date >= r.start && date <= r.end;

export function metrics(sales: Sale[], stock: StockEntry[], r: { start: string; end: string }) {
  const list = sales.filter((s) => inRange(s.date, r));
  const revenue = list.reduce((a, s) => a + s.total, 0);
  const net = list.reduce((a, s) => a + s.subtotal, 0);
  const vat = list.reduce((a, s) => a + s.vatAmount, 0);
  const cogs = list.reduce((a, s) => a + s.quantity * s.unitCost, 0);
  const collected = list.reduce((a, s) => a + Math.min(paidOf(s), s.total), 0);
  const units = list.reduce((a, s) => a + s.quantity, 0);
  const received = stock.filter((e) => inRange(e.date, r));
  const unitsIn = received.reduce((a, e) => a + e.quantity, 0);
  const valueIn = received.reduce((a, e) => a + e.quantity * e.unitCost, 0);
  return {
    list,
    count: list.length,
    revenue,
    net,
    vat,
    cogs,
    profit: net - cogs,
    collected,
    outstanding: revenue - collected,
    units,
    unitsIn,
    valueIn,
    restocks: received.length,
  };
}

export function series(sales: Sale[], stock: StockEntry[], r: Range) {
  return r.buckets.map((b) => {
    const m = metrics(sales, stock, b);
    return {
      label: b.label,
      start: b.start,
      collected: Math.round(m.collected),
      outstanding: Math.round(m.outstanding),
      revenue: Math.round(m.revenue),
      profit: Math.round(m.profit),
      sold: m.units,
      received: m.unitsIn,
      invoices: m.count,
    };
  });
}

export function topBy(list: Sale[], key: (s: Sale) => string) {
  const m = new Map<string, { name: string; revenue: number; units: number; count: number; profit: number }>();
  list.forEach((s) => {
    const k = key(s);
    const e = m.get(k) ?? { name: k, revenue: 0, units: 0, count: 0, profit: 0 };
    e.revenue += s.subtotal;
    e.units += s.quantity;
    e.count++;
    e.profit += s.subtotal - s.quantity * s.unitCost;
    m.set(k, e);
  });
  return [...m.values()].sort((a, b) => b.revenue - a.revenue);
}

export function stockByCategory(products: Product[]) {
  const m = new Map<string, { name: string; value: number; units: number; skus: number; retail: number; low: number }>();
  products.forEach((p) => {
    const e = m.get(p.category) ?? { name: p.category, value: 0, units: 0, skus: 0, retail: 0, low: 0 };
    e.value += p.quantity * p.unitCost;
    e.retail += p.quantity * p.sellingPrice;
    e.units += p.quantity;
    e.skus++;
    if (p.quantity <= p.reorderLevel) e.low++;
    m.set(p.category, e);
  });
  return [...m.values()].sort((a, b) => b.value - a.value);
}

export const pctDelta = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : null);
