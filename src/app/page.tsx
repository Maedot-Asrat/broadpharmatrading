"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import {
  MONTHS_LONG, SLOW_MOVING_DAYS, addDays, daysSinceSold, isSlowMoving, lastSoldMap, parseISO, fmtDate, int, isOverdue, money, money0, remainingOf, statusOf, stockStatus, todayISO,
} from "@/lib/format";
import { metrics, pctDelta, rangeFor, shiftAnchor } from "@/lib/analytics";
import { Card, StatCard, StatusBadge } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { SparkArea } from "@/components/Charts";
import { SaleFormModal } from "@/components/SaleForms";
import { ProductFormModal } from "@/components/ProductForms";

export default function Dashboard() {
  const { products, sales, stock } = useStore();
  const today = todayISO();
  const [saleOpen, setSaleOpen] = useState(false);
  const [prodOpen, setProdOpen] = useState(false);

  const month = useMemo(() => rangeFor("Month", today), [today]);
  const m = useMemo(() => metrics(sales, stock, month), [sales, stock, month]);
  const pm = useMemo(() => metrics(sales, stock, rangeFor("Month", shiftAnchor("Month", today, -1))), [sales, stock, today]);
  const todays = useMemo(() => metrics(sales, stock, { start: today, end: today }), [sales, stock, today]);

  const last30 = useMemo(() => {
    const out = [];
    for (let i = 29; i >= 0; i--) {
      const d = addDays(today, -i);
      const rev = sales.filter((s) => s.date === d).reduce((a, s) => a + s.total, 0);
      const dt = parseISO(d);
      out.push({ label: `${dt.getDate()} ${MONTHS_LONG[dt.getMonth()].slice(0, 3)}`, revenue: Math.round(rev) });
    }
    return out;
  }, [sales, today]);

  const stockValue = products.reduce((a, p) => a + p.quantity * p.unitCost, 0);
  const receivable = sales.reduce((a, s) => a + remainingOf(s), 0);
  const overdue = sales.filter((s) => isOverdue(s, today));
  const lowStock = products.filter((p) => stockStatus(p) !== "In stock").sort((a, b) => a.quantity / a.reorderLevel - b.quantity / b.reorderLevel);
  const lastSold = useMemo(() => lastSoldMap(sales), [sales]);
  const slow = products
    .filter((p) => isSlowMoving(p, lastSold, today))
    .sort((a, b) => b.quantity * b.unitCost - a.quantity * a.unitCost);
  const recent = [...sales].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.invoiceNo.localeCompare(a.invoiceNo))).slice(0, 7);

  return (
    <>
      <div className="mb-6 overflow-hidden rounded-2xl bg-brand-900 text-white">
        <div className="relative flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-700/50" />
          <div className="pointer-events-none absolute -bottom-24 right-40 h-48 w-48 rounded-full bg-lime-accent/10" />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-accent">BroadPharma Trading</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Good day 👋 Here&apos;s your equipment sales overview</h1>
            <p className="mt-1 text-sm text-brand-200">
              Today: <b className="num text-white">{money0(todays.revenue)}</b> from {todays.count} invoices · {month.label}:{" "}
              <b className="num text-white">{money0(m.revenue)}</b>
            </p>
          </div>
          <div className="relative flex gap-2">
            <button className="btn bg-lime-accent text-brand-950 hover:bg-[#bbe99a]" onClick={() => setSaleOpen(true)}><Icon name="cart" /> New sale</button>
            <button className="btn bg-brand-800 text-white hover:bg-brand-700" onClick={() => setProdOpen(true)}><Icon name="plus" /> Add product</button>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Sales this month" value={money0(m.revenue)} icon="receipt" delta={pctDelta(m.revenue, pm.revenue)} sub="vs last month" />
        <StatCard label="Gross profit (month)" value={money0(m.profit)} icon="trend" delta={pctDelta(m.profit, pm.profit)} sub="vs last month" />
        <StatCard label="Stock value (cost)" value={money0(stockValue)} icon="box" sub={`${products.length} products · ${int(products.reduce((a, p) => a + p.quantity, 0))} units`} />
        <StatCard label="Receivables" value={money0(receivable)} icon="wallet" tone={overdue.length ? "warn" : "default"} sub={`${overdue.length} invoices overdue`} />
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Sales — last 30 days" subtitle="Daily invoice value incl. VAT"
          action={<Link href="/analytics" className="text-xs font-medium text-brand-700 hover:underline">Full analytics →</Link>}>
          <SparkArea data={last30} height={240} />
        </Card>

        <Card title="Stock alerts" subtitle="At or below reorder level" bodyClass="p-0"
          action={<Link href="/products" className="text-xs font-medium text-brand-700 hover:underline">View stock →</Link>}>
          <ul className="max-h-[272px] divide-y divide-[var(--line)] overflow-y-auto">
            {lowStock.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-brand-950">{p.name}</p>
                  <p className="text-xs text-[var(--ink-3)]">{p.id} · reorder at {p.reorderLevel}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={`num text-sm font-semibold ${p.quantity <= 0 ? "text-red-600" : "text-amber-700"}`}>{int(p.quantity)} {p.unit}</p>
                  <StatusBadge status={stockStatus(p)} />
                </div>
              </li>
            ))}
            {!lowStock.length && <li className="px-4 py-8 text-center text-sm text-[var(--ink-3)]">All products are well stocked.</li>}
          </ul>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Recent sales" bodyClass="p-0"
          action={<Link href="/sales" className="text-xs font-medium text-brand-700 hover:underline">All sales →</Link>}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-brand-50/60">
                <tr><th className="th">Invoice</th><th className="th">Customer</th><th className="th">Product</th><th className="th text-right">Total</th><th className="th text-right">Remaining</th><th className="th">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {recent.map((s) => (
                  <tr key={s.id}>
                    <td className="td">
                      <span className="block font-mono text-xs font-semibold text-brand-700">{s.invoiceNo}</span>
                      <span className="text-xs text-[var(--ink-3)]">{fmtDate(s.date)}</span>
                    </td>
                    <td className="td font-medium">{s.customerName}</td>
                    <td className="td max-w-[200px] truncate text-[var(--ink-2)]">{s.quantity} × {s.productName}</td>
                    <td className="td num text-right font-semibold">{money(s.total)}</td>
                    <td className={`td num text-right ${remainingOf(s) > 0 ? "text-amber-700" : "text-[var(--ink-3)]"}`}>{remainingOf(s) > 0 ? money(remainingOf(s)) : "—"}</td>
                    <td className="td"><StatusBadge status={statusOf(s)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Slow-moving stock" subtitle={`In stock but not sold for ${SLOW_MOVING_DAYS}+ days · by tied-up value`} bodyClass="p-0">
          <ul className="max-h-[420px] divide-y divide-[var(--line)] overflow-y-auto">
            {slow.map((p) => {
              const d = daysSinceSold(p, lastSold, today);
              return (
                <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-brand-950">{p.name}</p>
                    <p className="text-xs text-[var(--ink-3)]">{p.model} · {int(p.quantity)} {p.unit} · {money0(p.quantity * p.unitCost)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-amber-700">{d == null ? "Never sold" : `${d} days`}</p>
                    <p className="text-xs text-[var(--ink-3)]">since last sale</p>
                  </div>
                </li>
              );
            })}
            {!slow.length && <li className="px-4 py-8 text-center text-sm text-[var(--ink-3)]">All stock is moving well.</li>}
          </ul>
        </Card>
      </div>

      <SaleFormModal open={saleOpen} onClose={() => setSaleOpen(false)} />
      <ProductFormModal open={prodOpen} onClose={() => setProdOpen(false)} />
    </>
  );
}
