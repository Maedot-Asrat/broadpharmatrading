"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import type { Sale } from "@/lib/types";
import { daysBetween, fmtDate, isOverdue, money, money0, paidOf, remainingOf, statusOf, todayISO } from "@/lib/format";
import { Card, Empty, PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { PaymentModal, SaleDetailModal } from "@/components/SaleForms";

const BUCKETS = ["Not yet due", "1–30 days", "31–60 days", "60+ days"] as const;

export default function ReceivablesPage() {
  const { sales } = useStore();
  const today = todayISO();
  const [customer, setCustomer] = useState<string>("All");
  const [paying, setPaying] = useState<Sale | null>(null);
  const [detail, setDetail] = useState<Sale | null>(null);

  const open = useMemo(
    () => sales.filter((s) => remainingOf(s) > 0).sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1)),
    [sales]
  );

  const bucketOf = (s: Sale) => {
    const late = daysBetween(s.dueDate, today);
    return late <= 0 ? 0 : late <= 30 ? 1 : late <= 60 ? 2 : 3;
  };

  const aging = useMemo(() => {
    const b = [0, 0, 0, 0];
    open.forEach((s) => (b[bucketOf(s)] += remainingOf(s)));
    return b;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, today]);

  const byCustomer = useMemo(() => {
    const m = new Map<string, { name: string; phone: string; count: number; rem: number; overdue: number; oldest: string }>();
    open.forEach((s) => {
      const c = m.get(s.customerName) ?? { name: s.customerName, phone: s.customerPhone, count: 0, rem: 0, overdue: 0, oldest: s.date };
      c.count++;
      c.rem += remainingOf(s);
      if (isOverdue(s, today)) c.overdue += remainingOf(s);
      if (s.date < c.oldest) c.oldest = s.date;
      m.set(s.customerName, c);
    });
    return [...m.values()].sort((a, b) => b.rem - a.rem);
  }, [open, today]);

  const total = aging.reduce((a, b) => a + b, 0);
  const overdueTotal = aging[1] + aging[2] + aging[3];
  const list = customer === "All" ? open : open.filter((s) => s.customerName === customer);
  const liveDetail = detail ? sales.find((s) => s.id === detail.id) ?? null : null;

  return (
    <>
      <PageHeader title="Receivables" subtitle="Unpaid and partially paid invoices — follow up and record payments" />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total outstanding" value={money0(total)} icon="wallet" tone="dark" sub={`${open.length} open invoices`} />
        <StatCard label="Overdue" value={money0(overdueTotal)} icon="alert" tone={overdueTotal ? "warn" : "default"} sub={`${open.filter((s) => isOverdue(s, today)).length} invoices past due date`} />
        <StatCard label="Partially paid" value={String(open.filter((s) => statusOf(s) === "Partial").length)} icon="cash" sub="Invoices with a deposit" />
        <StatCard label="Customers owing" value={String(byCustomer.length)} icon="users" sub="With an open balance" />
      </div>

      <Card title="Aging of receivables" subtitle="Outstanding balance by days past due date" className="mb-6">
        <div className="flex h-4 w-full gap-[2px] overflow-hidden rounded-full bg-brand-50">
          {aging.map((v, i) =>
            v > 0 ? (
              <div key={i} title={`${BUCKETS[i]}: ${money(v)}`} style={{ width: `${(v / total) * 100}%` }}
                className={["bg-brand-500", "bg-amber-300", "bg-amber-500", "bg-red-500"][i]} />
            ) : null
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {aging.map((v, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-sm ${["bg-brand-500", "bg-amber-300", "bg-amber-500", "bg-red-500"][i]}`} />
              <div>
                <p className="text-xs text-[var(--ink-3)]">{BUCKETS[i]}</p>
                <p className="num text-sm font-semibold text-brand-950">{money0(v)}</p>
                <p className="num text-xs text-[var(--ink-3)]">{total ? ((v / total) * 100).toFixed(1) : 0}%</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Card title="By customer" bodyClass="p-0">
          <ul className="max-h-[560px] divide-y divide-[var(--line)] overflow-y-auto">
            <li>
              <button onClick={() => setCustomer("All")}
                className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm ${customer === "All" ? "bg-brand-50" : "hover:bg-brand-50/50"}`}>
                <span className="font-medium">All customers</span>
                <span className="num font-semibold">{money0(total)}</span>
              </button>
            </li>
            {byCustomer.map((c) => (
              <li key={c.name}>
                <button onClick={() => setCustomer(c.name)}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm ${customer === c.name ? "bg-brand-50" : "hover:bg-brand-50/50"}`}>
                  <span>
                    <span className="block font-medium text-brand-950">{c.name}</span>
                    <span className="text-xs text-[var(--ink-3)]">{c.count} invoices · since {fmtDate(c.oldest)}</span>
                  </span>
                  <span className="text-right">
                    <span className="num block font-semibold">{money0(c.rem)}</span>
                    {c.overdue > 0 && <span className="num text-xs font-medium text-red-600">{money0(c.overdue)} overdue</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card title={customer === "All" ? "Open invoices" : `Open invoices · ${customer}`} subtitle="Sorted by due date" bodyClass="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-brand-50/60">
                <tr>
                  <th className="th">Invoice</th><th className="th">Customer</th><th className="th">Sale date</th><th className="th">Due</th>
                  <th className="th text-right">Total</th><th className="th text-right">Paid</th><th className="th text-right">Remaining</th><th className="th">Status</th><th className="th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {list.map((s) => {
                  const late = daysBetween(s.dueDate, today);
                  return (
                    <tr key={s.id} className="cursor-pointer hover:bg-brand-50/40" onClick={() => setDetail(s)}>
                      <td className="td font-mono text-xs font-semibold text-brand-700">{s.invoiceNo}</td>
                      <td className="td font-medium">{s.customerName}</td>
                      <td className="td text-[var(--ink-2)]">{fmtDate(s.date)}</td>
                      <td className="td">
                        <span className={late > 0 ? "font-medium text-red-600" : ""}>{fmtDate(s.dueDate)}</span>
                        {late > 0 && <span className="block text-xs text-red-600">{late} days late</span>}
                      </td>
                      <td className="td num text-right">{money(s.total)}</td>
                      <td className="td num text-right text-[var(--ink-2)]">{money(paidOf(s))}</td>
                      <td className="td num text-right font-semibold text-amber-700">{money(remainingOf(s))}</td>
                      <td className="td"><StatusBadge status={statusOf(s)} /></td>
                      <td className="td text-right" onClick={(e) => e.stopPropagation()}>
                        <button className="btn-light px-2.5 py-1 text-xs" onClick={() => setPaying(s)}>
                          <Icon name="cash" className="h-3.5 w-3.5" /> Record payment
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {list.length === 0 && <Empty text="Nothing outstanding — all invoices are paid." />}
          </div>
        </Card>
      </div>

      <SaleDetailModal sale={liveDetail} onClose={() => setDetail(null)} onPay={(s) => setPaying(s)} />
      <PaymentModal sale={paying} onClose={() => setPaying(null)} />
    </>
  );
}
