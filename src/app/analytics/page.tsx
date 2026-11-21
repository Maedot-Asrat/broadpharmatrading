"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { int, money0, statusOf, todayISO, remainingOf, paidOf } from "@/lib/format";
import { metrics, pctDelta, rangeFor, series, shiftAnchor, stockByCategory, topBy, type PeriodType } from "@/lib/analytics";
import { Card, PageHeader, Segmented, StatCard } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { C, HBars, Legend, RevenueBars, UnitsLines } from "@/components/Charts";

const TYPES = ["Year", "Month", "Week"] as const;

export default function AnalyticsPage() {
  const { sales, stock, products } = useStore();
  const today = todayISO();
  const [type, setType] = useState<PeriodType>("Month");
  const [anchor, setAnchor] = useState(today);

  const range = useMemo(() => rangeFor(type, anchor), [type, anchor]);
  const prevRange = useMemo(() => rangeFor(type, shiftAnchor(type, anchor, -1)), [type, anchor]);
  const m = useMemo(() => metrics(sales, stock, range), [sales, stock, range]);
  const pm = useMemo(() => metrics(sales, stock, prevRange), [sales, stock, prevRange]);
  const data = useMemo(() => series(sales, stock, range), [sales, stock, range]);
  const products10 = useMemo(() => topBy(m.list, (s) => s.productName).slice(0, 10), [m.list]);
  const customers = useMemo(() => topBy(m.list, (s) => s.customerName).slice(0, 8), [m.list]);
  const categories = useMemo(() => {
    const byName = new Map(products.map((p) => [p.id, p.category]));
    return topBy(m.list, (s) => byName.get(s.productId) ?? "Other");
  }, [m.list, products]);
  const stockCats = useMemo(() => stockByCategory(products), [products]);

  const status = useMemo(() => {
    const out = { Paid: { n: 0, v: 0 }, Partial: { n: 0, v: 0 }, Unpaid: { n: 0, v: 0 } };
    m.list.forEach((s) => {
      const st = statusOf(s);
      out[st].n++;
      out[st].v += st === "Paid" ? s.total : st === "Partial" ? paidOf(s) + remainingOf(s) : s.total;
    });
    return out;
  }, [m.list]);

  const isCurrent = range.start <= today && today <= range.end;
  const prevName = type === "Year" ? "last year" : type === "Month" ? "last month" : "last week";
  const stockValue = products.reduce((a, p) => a + p.quantity * p.unitCost, 0);
  const totalCatRev = categories.reduce((a, c) => a + c.revenue, 0);

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle="Sales, collections and stock movement by year, month or week"
        actions={
          <>
            <Segmented options={TYPES} value={type} onChange={(t) => { setType(t); setAnchor(today); }} />
            <div className="flex items-center rounded-lg border border-[var(--line)] bg-white">
              <button className="icon-btn" onClick={() => setAnchor((a) => shiftAnchor(type, a, -1))} aria-label="Previous period"><Icon name="left" /></button>
              <span className="min-w-[150px] px-2 text-center text-sm font-medium text-brand-950">{range.label}</span>
              <button className="icon-btn" onClick={() => setAnchor((a) => shiftAnchor(type, a, 1))} disabled={range.end >= today} aria-label="Next period"><Icon name="right" /></button>
            </div>
            {!isCurrent && <button className="btn-light" onClick={() => setAnchor(today)}>This {type.toLowerCase()}</button>}
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Sales (incl. VAT)" value={money0(m.revenue)} icon="receipt" tone="dark" delta={pctDelta(m.revenue, pm.revenue)} sub={`vs ${prevName}`} />
        <StatCard label="Gross profit" value={money0(m.profit)} icon="trend" delta={pctDelta(m.profit, pm.profit)} sub={m.net ? `${((m.profit / m.net) * 100).toFixed(1)}% margin` : undefined} />
        <StatCard label="Collected" value={money0(m.collected)} icon="cash" sub={m.revenue ? `${((m.collected / m.revenue) * 100).toFixed(1)}% of sales` : "—"} />
        <StatCard label="Outstanding" value={money0(m.outstanding)} icon="wallet" tone={m.outstanding > 0 ? "warn" : "default"} sub="From this period's invoices" />
        <StatCard label="Invoices" value={int(m.count)} icon="cart" delta={pctDelta(m.count, pm.count)} sub={m.count ? `Avg ${money0(m.revenue / m.count)}` : undefined} />
        <StatCard label="Units sold" value={int(m.units)} icon="box" delta={pctDelta(m.units, pm.units)} sub={`vs ${prevName}`} />
        <StatCard label="VAT collected" value={money0(m.vat)} icon="chart" sub={`Net sales ${money0(m.net)}`} />
        <StatCard label="Stock received" value={`${int(m.unitsIn)} units`} icon="truck" sub={`${m.restocks} deliveries · ${money0(m.valueIn)}`} />
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title={`Sales by ${type === "Year" ? "month" : "day"}`}
          subtitle="Invoice value incl. VAT, split by how much has been collected"
          action={<Legend items={[
            { label: "Collected", color: C.green, value: money0(m.collected) },
            { label: "Outstanding", color: C.amber, value: money0(m.outstanding) },
          ]} />}
        >
          <RevenueBars data={data} />
        </Card>

        <Card title="Payment status" subtitle={`${m.count} invoices in ${range.label}`}>
          <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-brand-50">
            {(["Paid", "Partial", "Unpaid"] as const).map((k) =>
              status[k].n ? (
                <div key={k} style={{ width: `${(status[k].n / Math.max(1, m.count)) * 100}%` }}
                  className={k === "Paid" ? "bg-brand-600" : k === "Partial" ? "bg-amber-400" : "bg-red-500"} />
              ) : null
            )}
          </div>
          <ul className="mt-5 space-y-4">
            {(["Paid", "Partial", "Unpaid"] as const).map((k) => (
              <li key={k} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm">
                  <span className={`h-2.5 w-2.5 rounded-sm ${k === "Paid" ? "bg-brand-600" : k === "Partial" ? "bg-amber-400" : "bg-red-500"}`} />
                  <span className="font-medium text-brand-950">{k === "Unpaid" ? "Not paid" : k === "Partial" ? "Partially paid" : "Fully paid"}</span>
                </span>
                <span className="text-right">
                  <span className="num block text-sm font-semibold text-brand-950">{status[k].n} invoices</span>
                  <span className="num text-xs text-[var(--ink-3)]">
                    {m.count ? ((status[k].n / m.count) * 100).toFixed(0) : 0}% · {money0(status[k].v)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-6 rounded-lg bg-brand-50 p-3 text-xs text-[var(--ink-2)]">
            Collection rate this period:{" "}
            <b className="num text-brand-900">{m.revenue ? ((m.collected / m.revenue) * 100).toFixed(1) : "0"}%</b>
          </div>
        </Card>
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <Card title="Top products" subtitle="Net sales (excl. VAT) in this period">
          {products10.length ? <HBars data={products10} dataKey="revenue" name="Net sales" labelWidth={170} /> : <p className="py-8 text-center text-sm text-[var(--ink-3)]">No sales in this period.</p>}
        </Card>
        <Card title="Sales by category" subtitle="Net sales (excl. VAT) and share of total">
          <ul className="space-y-3">
            {categories.map((c) => (
              <li key={c.name}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="font-medium text-brand-950">{c.name}</span>
                  <span className="num text-[var(--ink-2)]">
                    {money0(c.revenue)} · <b className="text-brand-900">{((c.revenue / Math.max(1, totalCatRev)) * 100).toFixed(1)}%</b>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-brand-50">
                  <div className="h-2 rounded-full bg-brand-600" style={{ width: `${(c.revenue / Math.max(1, categories[0]?.revenue ?? 1)) * 100}%` }} />
                </div>
              </li>
            ))}
            {!categories.length && <p className="py-8 text-center text-sm text-[var(--ink-3)]">No sales in this period.</p>}
          </ul>
        </Card>
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title="Stock movement"
          subtitle="Units sold vs units received into the warehouse"
          action={<Legend items={[
            { label: "Sold", color: C.green, value: int(m.units) },
            { label: "Received", color: C.blue, value: int(m.unitsIn) },
          ]} />}
        >
          <UnitsLines data={data} />
        </Card>
        <Card title="Top customers" subtitle="By net sales this period" bodyClass="p-0">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-[var(--line)]">
              {customers.map((c, i) => (
                <tr key={c.name}>
                  <td className="py-2.5 pl-4 pr-2 text-xs text-[var(--ink-3)]">{i + 1}</td>
                  <td className="py-2.5 pr-2">
                    <span className="block font-medium text-brand-950">{c.name}</span>
                    <span className="text-xs text-[var(--ink-3)]">{c.count} invoices · {int(c.units)} units</span>
                  </td>
                  <td className="num py-2.5 pr-4 text-right font-semibold">{money0(c.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!customers.length && <p className="py-8 text-center text-sm text-[var(--ink-3)]">No sales in this period.</p>}
        </Card>
      </div>

      <Card title="Stored products — current stock position" subtitle={`Total stock value at cost ${money0(stockValue)} across ${products.length} products`} bodyClass="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-brand-50/60">
              <tr>
                <th className="th">Category</th><th className="th text-right">Products</th><th className="th text-right">Units</th>
                <th className="th text-right">Value at cost</th><th className="th text-right">Value at price</th><th className="th text-right">Low stock</th><th className="th w-[30%]">Share of stock value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {stockCats.map((c) => (
                <tr key={c.name}>
                  <td className="td font-medium">{c.name}</td>
                  <td className="td num text-right">{c.skus}</td>
                  <td className="td num text-right">{int(c.units)}</td>
                  <td className="td num text-right font-semibold">{money0(c.value)}</td>
                  <td className="td num text-right text-[var(--ink-2)]">{money0(c.retail)}</td>
                  <td className={`td num text-right ${c.low ? "font-semibold text-amber-700" : "text-[var(--ink-3)]"}`}>{c.low || "—"}</td>
                  <td className="td">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 rounded-full bg-brand-50">
                        <div className="h-2 rounded-full bg-brand-700" style={{ width: `${(c.value / Math.max(1, stockValue)) * 100}%` }} />
                      </div>
                      <span className="num w-12 text-right text-xs text-[var(--ink-2)]">{((c.value / Math.max(1, stockValue)) * 100).toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
