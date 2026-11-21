"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { CATEGORIES, type Product } from "@/lib/types";
import {
  SLOW_MOVING_DAYS, daysBetween, daysSinceSold, downloadCSV, fmtDate, int, isSlowMoving, lastSoldMap, money, money0,
  stockStatus, todayISO, warrantyLabel,
} from "@/lib/format";
import { Badge, Card, Empty, Modal, PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { ProductFormModal, RestockModal } from "@/components/ProductForms";
import { SaleFormModal } from "@/components/SaleForms";

const FILTERS = ["All", "In stock", "Low stock", "Out of stock", "Slow moving"] as const;
type SortKey = "id" | "name" | "quantity" | "value" | "sellingPrice" | "dateAdded";

export default function ProductsPage() {
  const { products, stock, sales, deleteProduct, toast } = useStore();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: "id", dir: 1 });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [restocking, setRestocking] = useState<Product | null>(null);
  const [viewing, setViewing] = useState<Product | null>(null);
  const [sellId, setSellId] = useState<string | null>(null);

  const today = todayISO();
  const lastSold = useMemo(() => lastSoldMap(sales), [sales]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return products
      .filter((p) => cat === "All" || p.category === cat)
      .filter((p) => {
        if (filter === "All") return true;
        if (filter === "Slow moving") return isSlowMoving(p, lastSold, today);
        return stockStatus(p) === filter;
      })
      .filter(
        (p) =>
          !s ||
          [p.id, p.name, p.model, p.brand, p.lotNumber, p.supplier, p.origin].some((x) => x.toLowerCase().includes(s))
      )
      .sort((a, b) => {
        const v = (p: Product) => (sort.k === "value" ? p.quantity * p.unitCost : p[sort.k]);
        const A = v(a), B = v(b);
        return (A < B ? -1 : A > B ? 1 : 0) * sort.dir;
      });
  }, [products, q, cat, filter, sort, today, lastSold]);

  const totals = useMemo(() => {
    const cost = products.reduce((a, p) => a + p.quantity * p.unitCost, 0);
    const retail = products.reduce((a, p) => a + p.quantity * p.sellingPrice, 0);
    const low = products.filter((p) => stockStatus(p) === "Low stock").length;
    const out = products.filter((p) => stockStatus(p) === "Out of stock").length;
    const slow = products.filter((p) => isSlowMoving(p, lastSold, today));
    return { cost, retail, low, out, slow: slow.length, slowValue: slow.reduce((a, p) => a + p.quantity * p.unitCost, 0) };
  }, [products, today, lastSold]);

  const th = (k: SortKey, label: string, right = false) => (
    <th className={`th cursor-pointer select-none hover:text-brand-700 ${right ? "text-right" : ""}`}
      onClick={() => setSort((s) => ({ k, dir: s.k === k ? ((-s.dir) as 1 | -1) : 1 }))}>
      {label} {sort.k === k ? (sort.dir === 1 ? "↑" : "↓") : ""}
    </th>
  );

  const exportCSV = () =>
    downloadCSV(`broadpharma-products-${today}.csv`, [
      ["Product ID", "Name", "Brand", "Model", "Category", "Type", "Specifications", "Origin", "Serial / lot", "Quantity", "Unit", "Unit cost", "Selling price", "Stock value", "Reorder level", "Warranty (months)", "Condition", "Installation", "Manufacture date", "Date added", "Location", "Supplier"],
      ...rows.map((p) => [p.id, p.name, p.brand, p.model, p.category, p.type, p.specs, p.origin, p.lotNumber, p.quantity, p.unit, p.unitCost, p.sellingPrice, p.quantity * p.unitCost, p.reorderLevel, p.warrantyMonths, p.condition, p.requiresInstallation ? "Yes" : "No", p.manufactureDate, p.dateAdded, p.location, p.supplier]),
    ]);

  return (
    <>
      <PageHeader
        title="Products & Stock"
        subtitle={`${products.length} machines & equipment items · ${int(products.reduce((a, p) => a + p.quantity, 0))} units on hand`}
        actions={
          <>
            <button className="btn-ghost" onClick={exportCSV}><Icon name="download" /> Export CSV</button>
            <button className="btn-primary" onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Icon name="plus" /> Add product
            </button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Stock value (cost)" value={money0(totals.cost)} icon="box" tone="dark" sub={`Retail value ${money0(totals.retail)}`} />
        <StatCard label="Potential margin" value={money0(totals.retail - totals.cost)} icon="trend" sub={`${((totals.retail / totals.cost - 1) * 100 || 0).toFixed(1)}% on cost`} />
        <StatCard label="Low / out of stock" value={`${totals.low} / ${totals.out}`} icon="alert" tone={totals.low + totals.out ? "warn" : "default"} sub="At or below reorder level" />
        <StatCard label="Slow-moving items" value={String(totals.slow)} icon="clock" tone={totals.slow ? "warn" : "default"} sub={`No sale in ${SLOW_MOVING_DAYS}+ days · ${money0(totals.slowValue)}`} />
      </div>

      <Card bodyClass="p-0">
        <div className="flex flex-col gap-3 border-b border-[var(--line)] p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-3)]" />
            <input className="input pl-9" placeholder="Search by ID, name, model, brand, serial…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="input lg:w-60" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option>All</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${filter === f ? "bg-brand-700 text-white" : "bg-brand-50 text-brand-800 hover:bg-brand-100"}`}>
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-brand-50/60">
              <tr>
                {th("id", "ID")}
                {th("name", "Product")}
                <th className="th">Category</th>
                <th className="th">Serial / lot</th>
                {th("quantity", "Qty", true)}
                <th className="th text-right">Cost</th>
                {th("sellingPrice", "Price", true)}
                {th("value", "Stock value", true)}
                <th className="th">Warranty</th>
                {th("dateAdded", "Added")}
                <th className="th">Status</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {rows.map((p) => {
                const st = stockStatus(p);
                const slow = isSlowMoving(p, lastSold, today);
                return (
                  <tr key={p.id} className="hover:bg-brand-50/40">
                    <td className="td font-mono text-xs font-semibold text-brand-700">{p.id}</td>
                    <td className="td max-w-[300px]">
                      <button className="block max-w-full truncate text-left font-medium text-brand-950 hover:text-brand-700" onClick={() => setViewing(p)}>
                        {p.name}
                      </button>
                      <span className="text-xs text-[var(--ink-3)]">
                        {p.brand} · {p.model}{p.condition !== "New" ? ` · ${p.condition}` : ""}
                      </span>
                    </td>
                    <td className="td text-[var(--ink-2)]">{p.category}</td>
                    <td className="td font-mono text-xs">{p.lotNumber}</td>
                    <td className="td num text-right">
                      <span className={`font-semibold ${st === "In stock" ? "text-brand-950" : st === "Low stock" ? "text-amber-700" : "text-red-600"}`}>{int(p.quantity)}</span>
                      <span className="ml-1 text-xs text-[var(--ink-3)]">{p.unit}</span>
                    </td>
                    <td className="td num text-right text-[var(--ink-2)]">{money0(p.unitCost)}</td>
                    <td className="td num text-right">{money0(p.sellingPrice)}</td>
                    <td className="td num text-right font-medium">{money0(p.quantity * p.unitCost)}</td>
                    <td className="td text-[var(--ink-2)]">{warrantyLabel(p.warrantyMonths)}</td>
                    <td className="td text-[var(--ink-2)]">{fmtDate(p.dateAdded)}</td>
                    <td className="td">
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge status={st} />
                        {slow && <StatusBadge status="Slow moving" />}
                      </div>
                    </td>
                    <td className="td text-right">
                      <div className="flex justify-end gap-0.5">
                        <button className="icon-btn" title="Sell" onClick={() => setSellId(p.id)} disabled={p.quantity <= 0}><Icon name="cart" /></button>
                        <button className="icon-btn" title="Restock" onClick={() => setRestocking(p)}><Icon name="truck" /></button>
                        <button className="icon-btn" title="Edit" onClick={() => { setEditing(p); setFormOpen(true); }}><Icon name="edit" /></button>
                        <button className="icon-btn hover:!bg-red-50 hover:!text-red-600" title="Delete"
                          onClick={() => {
                            const hasSales = sales.some((s) => s.productId === p.id);
                            if (!confirm(hasSales ? `${p.name} has sales history. Delete anyway?` : `Delete ${p.name}?`)) return;
                            deleteProduct(p.id);
                            toast(`${p.name} deleted`);
                          }}>
                          <Icon name="trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && <Empty text="No products match your filters." />}
        </div>
        <div className="border-t border-[var(--line)] px-4 py-3 text-xs text-[var(--ink-3)]">
          Showing {rows.length} of {products.length} products
        </div>
      </Card>

      <ProductFormModal open={formOpen} onClose={() => setFormOpen(false)} editing={editing} />
      <RestockModal product={restocking} onClose={() => setRestocking(null)} />
      <SaleFormModal open={!!sellId} presetProductId={sellId ?? undefined} onClose={() => setSellId(null)} />
      {viewing && (
        <ProductDetail
          product={products.find((p) => p.id === viewing.id) ?? viewing}
          onClose={() => setViewing(null)}
          stock={stock.filter((s) => s.productId === viewing.id)}
          sold={sales.filter((s) => s.productId === viewing.id)}
          lastSoldDays={daysSinceSold(viewing, lastSold, today)}
        />
      )}
    </>
  );
}

function ProductDetail({
  product: p, onClose, stock, sold, lastSoldDays,
}: {
  product: Product;
  onClose: () => void;
  stock: ReturnType<typeof useStore>["stock"];
  sold: ReturnType<typeof useStore>["sales"];
  lastSoldDays: number | null;
}) {
  const today = todayISO();
  const units = sold.reduce((a, s) => a + s.quantity, 0);
  const revenue = sold.reduce((a, s) => a + s.subtotal, 0);
  const last180 = sold.filter((s) => daysBetween(s.date, today) <= 180).reduce((a, s) => a + s.quantity, 0);

  const specs: [string, string][] = [
    ["Brand", p.brand], ["Model", p.model], ["Category", p.category],
    ["Equipment type", p.type], ["Specifications", p.specs], ["Country of origin", p.origin],
    ["Supplier", p.supplier], ["Serial / lot", p.lotNumber], ["Condition", p.condition],
    ["Manufactured", fmtDate(p.manufactureDate)], ["Warranty", warrantyLabel(p.warrantyMonths)], ["Date added", fmtDate(p.dateAdded)],
    ["Location", p.location], ["Installation", p.requiresInstallation ? "On-site installation & training" : "Not required"], ["Reorder level", `${p.reorderLevel} ${p.unit}`],
  ];

  return (
    <Modal open onClose={onClose} wide title={p.name} subtitle={`${p.id} · ${p.brand} ${p.model}`}>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="In stock" value={`${int(p.quantity)} ${p.unit}`} tone="dark" sub={money0(p.quantity * p.unitCost) + " at cost"} />
        <StatCard label="Units sold (all time)" value={int(units)} sub={`${int(last180)} in last 180 days`} />
        <StatCard label="Net revenue" value={money0(revenue)} />
        <StatCard label="Last sold" value={lastSoldDays == null ? "Never" : `${lastSoldDays} d ago`} tone={lastSoldDays == null || lastSoldDays >= SLOW_MOVING_DAYS ? "warn" : "default"} />
      </div>
      <div className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
        {specs.map(([k, v]) => (
          <div key={k} className="border-b border-dashed border-[var(--line)] pb-1.5">
            <p className="text-xs text-[var(--ink-3)]">{k}</p>
            <p className="font-medium text-brand-950">{v || "—"}</p>
          </div>
        ))}
      </div>
      {p.notes && <p className="mt-4 text-sm text-[var(--ink-2)]"><b>Notes:</b> {p.notes}</p>}
      <h4 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-brand-700">Stock received</h4>
      <div className="max-h-56 overflow-y-auto rounded-xl border border-[var(--line)]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-brand-50"><tr><th className="th">Date</th><th className="th">Serial / lot</th><th className="th">Note</th><th className="th text-right">Qty</th><th className="th text-right">Unit cost</th></tr></thead>
          <tbody className="divide-y divide-[var(--line)]">
            {[...stock].sort((a, b) => (a.date < b.date ? 1 : -1)).map((s) => (
              <tr key={s.id}>
                <td className="td">{fmtDate(s.date)}</td>
                <td className="td font-mono text-xs">{s.lotNumber || "—"}</td>
                <td className="td text-[var(--ink-2)]"><Badge tone={s.note === "Opening stock" ? "blue" : "green"}>{s.note}</Badge></td>
                <td className="td num text-right font-medium">+{int(s.quantity)}</td>
                <td className="td num text-right">{money(s.unitCost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {stock.length === 0 && <Empty text="No stock entries yet." />}
      </div>
    </Modal>
  );
}
