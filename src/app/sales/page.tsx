"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import type { Sale } from "@/lib/types";
import {
  MONTHS_LONG, downloadCSV, fmtDate, int, isOverdue, money, money0, paidOf, remainingOf, statusOf, todayISO,
} from "@/lib/format";
import { Card, Empty, PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { PaymentModal, SaleDetailModal, SaleFormModal } from "@/components/SaleForms";

const TABS = ["All", "Paid", "Partial", "Unpaid", "Overdue"] as const;
const PAGE = 25;

export default function SalesPage() {
  const { sales } = useStore();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<(typeof TABS)[number]>("All");
  const today = todayISO();
  const [month, setMonth] = useState(today.slice(0, 7)); // "" = all time
  const [page, setPage] = useState(0);
  const [newOpen, setNewOpen] = useState(false);
  const [detail, setDetail] = useState<Sale | null>(null);
  const [paying, setPaying] = useState<Sale | null>(null);

  const months = useMemo(() => {
    const set = new Set(sales.map((s) => s.date.slice(0, 7)));
    return [...set].sort().reverse();
  }, [sales]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return sales
      .filter((x) => !month || x.date.startsWith(month))
      .filter((x) => (tab === "All" ? true : tab === "Overdue" ? isOverdue(x, today) : statusOf(x) === tab))
      .filter(
        (x) =>
          !s ||
          [x.invoiceNo, x.vatReceiptNo, x.customerName, x.productName, x.productId, x.customerTin].some((v) => v.toLowerCase().includes(s))
      )
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.invoiceNo.localeCompare(a.invoiceNo)));
  }, [sales, q, tab, month, today]);

  useEffect(() => setPage(0), [q, tab, month]);

  const sum = useMemo(() => {
    const total = rows.reduce((a, s) => a + s.total, 0);
    const paid = rows.reduce((a, s) => a + paidOf(s), 0);
    const vat = rows.reduce((a, s) => a + s.vatAmount, 0);
    const units = rows.reduce((a, s) => a + s.quantity, 0);
    return { total, paid, vat, units, rem: total - paid };
  }, [rows]);

  const pageRows = rows.slice(page * PAGE, page * PAGE + PAGE);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const label = month ? `${MONTHS_LONG[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}` : "All time";

  const exportCSV = () =>
    downloadCSV(`broadpharma-sales-${month || "all"}.csv`, [
      ["Invoice", "VAT receipt / ref", "Date", "Customer", "TIN", "Product ID", "Product", "Qty", "Unit price", "Discount", "Subtotal", "VAT", "Total", "Paid", "Remaining", "Status", "Due date", "Sales person"],
      ...rows.map((s) => [s.invoiceNo, s.vatReceiptNo, s.date, s.customerName, s.customerTin, s.productId, s.productName, s.quantity, s.unitPrice, s.discount, s.subtotal, s.vatAmount, s.total, paidOf(s), remainingOf(s), statusOf(s), s.dueDate, s.salesPerson]),
    ]);

  // keep the detail modal in sync after a payment
  const liveDetail = detail ? sales.find((s) => s.id === detail.id) ?? null : null;

  return (
    <>
      <PageHeader
        title="Sales"
        subtitle={`${label} · ${rows.length} invoices`}
        actions={
          <>
            <button className="btn-ghost" onClick={exportCSV}><Icon name="download" /> Export CSV</button>
            <button className="btn-primary" onClick={() => setNewOpen(true)}><Icon name="plus" /> New sale</button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Invoiced (incl. VAT)" value={money0(sum.total)} icon="receipt" tone="dark" sub={`${int(sum.units)} units sold`} />
        <StatCard label="Collected" value={money0(sum.paid)} icon="cash" sub={sum.total ? `${((sum.paid / sum.total) * 100).toFixed(1)}% of invoiced` : undefined} />
        <StatCard label="Outstanding" value={money0(sum.rem)} icon="wallet" tone={sum.rem > 0 ? "warn" : "default"} sub="Remaining to collect" />
        <StatCard label="VAT collected" value={money0(sum.vat)} icon="chart" sub="Output VAT on invoices" />
      </div>

      <Card bodyClass="p-0">
        <div className="flex flex-col gap-3 border-b border-[var(--line)] p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-3)]" />
            <input className="input pl-9" placeholder="Search invoice, VAT ref, customer, product…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="input lg:w-48" value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="">All time</option>
            {months.map((m) => (
              <option key={m} value={m}>{MONTHS_LONG[Number(m.slice(5)) - 1]} {m.slice(0, 4)}</option>
            ))}
          </select>
          <div className="flex flex-wrap gap-1">
            {TABS.map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${tab === t ? "bg-brand-700 text-white" : "bg-brand-50 text-brand-800 hover:bg-brand-100"}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-brand-50/60">
              <tr>
                <th className="th">Invoice</th>
                <th className="th">Date</th>
                <th className="th">Customer</th>
                <th className="th">Product</th>
                <th className="th text-right">Qty</th>
                <th className="th text-right">Sold price</th>
                <th className="th text-right">Total</th>
                <th className="th text-right">Paid</th>
                <th className="th text-right">Remaining</th>
                <th className="th">Status</th>
                <th className="th">VAT ref.</th>
                <th className="th text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {pageRows.map((s) => {
                const rem = remainingOf(s);
                const overdue = isOverdue(s, today);
                return (
                  <tr key={s.id} className="cursor-pointer hover:bg-brand-50/40" onClick={() => setDetail(s)}>
                    <td className="td font-mono text-xs font-semibold text-brand-700">{s.invoiceNo}</td>
                    <td className="td text-[var(--ink-2)]">{fmtDate(s.date)}</td>
                    <td className="td font-medium">{s.customerName}</td>
                    <td className="td max-w-[220px] truncate text-[var(--ink-2)]" title={s.productName}>{s.productName}</td>
                    <td className="td num text-right">{int(s.quantity)}</td>
                    <td className="td num text-right">{money(s.unitPrice)}</td>
                    <td className="td num text-right font-semibold">{money(s.total)}</td>
                    <td className="td num text-right text-[var(--ink-2)]">{money(paidOf(s))}</td>
                    <td className={`td num text-right font-medium ${rem > 0 ? "text-amber-700" : "text-[var(--ink-3)]"}`}>{rem > 0 ? money(rem) : "—"}</td>
                    <td className="td">
                      <div className="flex gap-1">
                        <StatusBadge status={statusOf(s)} />
                        {overdue && <StatusBadge status="Overdue" />}
                      </div>
                    </td>
                    <td className="td font-mono text-xs text-[var(--ink-2)]">{s.vatReceiptNo}</td>
                    <td className="td text-right" onClick={(e) => e.stopPropagation()}>
                      {rem > 0 ? (
                        <button className="btn-light px-2.5 py-1 text-xs" onClick={() => setPaying(s)}>
                          <Icon name="cash" className="h-3.5 w-3.5" /> Pay
                        </button>
                      ) : (
                        <button className="icon-btn" onClick={() => setDetail(s)} title="View"><Icon name="eye" /></button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && <Empty text="No sales match your filters." />}
        </div>
        <div className="flex items-center justify-between border-t border-[var(--line)] px-4 py-3 text-xs text-[var(--ink-3)]">
          <span>
            {rows.length ? `${page * PAGE + 1}–${Math.min(rows.length, (page + 1) * PAGE)} of ${rows.length}` : "0 results"}
          </span>
          <div className="flex items-center gap-1">
            <button className="icon-btn" disabled={page === 0} onClick={() => setPage((p) => p - 1)}><Icon name="left" /></button>
            <span className="num px-2">Page {page + 1} / {pages}</span>
            <button className="icon-btn" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}><Icon name="right" /></button>
          </div>
        </div>
      </Card>

      <SaleFormModal open={newOpen} onClose={() => setNewOpen(false)} />
      <SaleDetailModal sale={liveDetail} onClose={() => setDetail(null)} onPay={(s) => setPaying(s)} />
      <PaymentModal sale={paying} onClose={() => setPaying(null)} />
    </>
  );
}
