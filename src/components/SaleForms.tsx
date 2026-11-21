"use client";

import { useEffect, useMemo, useState } from "react";
import { Field, Modal, Section, StatusBadge } from "./ui";
import { useStore } from "@/lib/store";
import { CATEGORIES, PAYMENT_METHODS, type PaymentMethod, type Sale } from "@/lib/types";
import {
  addDays, computeTotals, fmtDate, warrantyLabel, isOverdue, money, paidOf, remainingOf, round2, statusOf, todayISO,
} from "@/lib/format";

type PayMode = "full" | "partial" | "none";

export function SaleFormModal({ open, onClose, presetProductId }: { open: boolean; onClose: () => void; presetProductId?: string }) {
  const { products, sales, addSale, nextInvoiceNo, toast } = useStore();

  const customers = useMemo(() => {
    const m = new Map<string, { tin: string; phone: string }>();
    sales.forEach((s) => !m.has(s.customerName) && m.set(s.customerName, { tin: s.customerTin, phone: s.customerPhone }));
    return m;
  }, [sales]);

  const blank = () => ({
    date: todayISO(),
    productId: presetProductId ?? "",
    quantity: 0,
    unitPrice: 0,
    discount: 0,
    vatRate: 15,
    vatReceiptNo: "",
    customerName: "",
    customerTin: "",
    customerPhone: "",
    salesPerson: "",
    payMode: "full" as PayMode,
    amountPaid: 0,
    method: "Bank Transfer" as PaymentMethod,
    payRef: "",
    dueDate: addDays(todayISO(), 30),
    notes: "",
  });
  const [f, setF] = useState(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    const b = blank();
    const p = products.find((x) => x.id === b.productId);
    if (p) b.unitPrice = p.sellingPrice;
    setF(b);
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, presetProductId]);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const product = products.find((p) => p.id === f.productId);
  const totals = computeTotals(f.quantity || 0, f.unitPrice || 0, f.discount || 0, f.vatRate || 0);
  const paidNow = f.payMode === "full" ? totals.total : f.payMode === "partial" ? Math.min(f.amountPaid || 0, totals.total) : 0;
  const remaining = round2(totals.total - paidNow);
  const invoiceNo = nextInvoiceNo(f.date || todayISO());
  const profit = product ? totals.subtotal - product.unitCost * (f.quantity || 0) : 0;

  const pickProduct = (id: string) => {
    const p = products.find((x) => x.id === id);
    setF((x) => ({ ...x, productId: id, unitPrice: p ? p.sellingPrice : 0 }));
  };

  const pickCustomer = (name: string) => {
    const c = customers.get(name);
    setF((x) => ({ ...x, customerName: name, ...(c ? { customerTin: c.tin, customerPhone: c.phone } : {}) }));
  };

  const save = () => {
    const e: Record<string, string> = {};
    if (!product) e.productId = "Select a product";
    if (!f.quantity || f.quantity <= 0) e.quantity = "Enter quantity";
    else if (product && f.quantity > product.quantity) e.quantity = `Only ${product.quantity} ${product.unit} in stock`;
    if (!f.unitPrice || f.unitPrice <= 0) e.unitPrice = "Enter sold price";
    if (!f.customerName.trim()) e.customerName = "Customer is required";
    if (!f.vatReceiptNo.trim()) e.vatReceiptNo = "VAT receipt / reference no. is required";
    if (f.payMode === "partial" && (!f.amountPaid || f.amountPaid <= 0)) e.amountPaid = "Enter amount paid";
    if (f.payMode === "partial" && f.amountPaid >= totals.total) e.amountPaid = "Amount equals total — choose 'Paid in full'";
    setErrors(e);
    if (Object.keys(e).length || !product) return;

    const sale: Omit<Sale, "id"> = {
      invoiceNo,
      vatReceiptNo: f.vatReceiptNo.trim(),
      date: f.date,
      productId: product.id,
      productName: product.name,
      quantity: f.quantity,
      unitPrice: round2(f.unitPrice),
      unitCost: product.unitCost,
      discount: round2(f.discount || 0),
      vatRate: f.vatRate,
      ...totals,
      customerName: f.customerName.trim(),
      customerTin: f.customerTin.trim(),
      customerPhone: f.customerPhone.trim(),
      salesPerson: f.salesPerson.trim(),
      dueDate: remaining > 0 ? f.dueDate : f.date,
      payments:
        paidNow > 0
          ? [{ id: "p0", date: f.date, amount: round2(paidNow), method: f.method, reference: f.payRef.trim() }]
          : [],
      notes: f.notes.trim(),
    };
    addSale(sale);
    toast(`Sale ${invoiceNo} recorded`);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Record new sale"
      subtitle={`Invoice ${invoiceNo}`}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save}>Save sale</button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div>
          <Section title="Product">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field label="Product *" error={errors.productId} className="col-span-2 sm:col-span-4"
                hint={product ? `In stock: ${product.quantity} ${product.unit} · List price ${money(product.sellingPrice)} · Warranty ${warrantyLabel(product.warrantyMonths)}${product.requiresInstallation ? " · Installation required" : ""}` : undefined}>
                <select className="input" value={f.productId} onChange={(e) => pickProduct(e.target.value)}>
                  <option value="">Select product…</option>
                  {CATEGORIES.map((cat) => {
                    const list = products.filter((p) => p.category === cat);
                    if (!list.length) return null;
                    return (
                      <optgroup key={cat} label={cat}>
                        {list.map((p) => (
                          <option key={p.id} value={p.id} disabled={p.quantity <= 0}>
                            {p.id} · {p.name} ({p.quantity} {p.unit}{p.quantity <= 0 ? " — out of stock" : ""})
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
              </Field>
              <Field label={`Quantity${product ? ` (${product.unit})` : ""} *`} error={errors.quantity}>
                <input type="number" min={1} className="input num" value={f.quantity || ""} onChange={(e) => set("quantity", Number(e.target.value))} />
              </Field>
              <Field label="Sold price / unit *" error={errors.unitPrice}>
                <input type="number" step="0.01" className="input num" value={f.unitPrice || ""} onChange={(e) => set("unitPrice", Number(e.target.value))} />
              </Field>
              <Field label="Discount (ETB)">
                <input type="number" step="0.01" className="input num" value={f.discount || ""} onChange={(e) => set("discount", Number(e.target.value))} />
              </Field>
              <Field label="VAT rate (%)">
                <select className="input" value={f.vatRate} onChange={(e) => set("vatRate", Number(e.target.value))}>
                  <option value={15}>15% (standard)</option>
                  <option value={0}>0% (exempt)</option>
                </select>
              </Field>
            </div>
          </Section>

          <Section title="Invoice & customer">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Sale date">
                <input type="date" className="input" value={f.date} onChange={(e) => set("date", e.target.value)} />
              </Field>
              <Field label="VAT receipt / ref. no. *" error={errors.vatReceiptNo}>
                <input className="input font-mono" placeholder="FS00000000" value={f.vatReceiptNo} onChange={(e) => set("vatReceiptNo", e.target.value)} />
              </Field>
              <Field label="Sales person">
                <input className="input" value={f.salesPerson} onChange={(e) => set("salesPerson", e.target.value)} />
              </Field>
              <Field label="Customer *" error={errors.customerName} className="col-span-2 sm:col-span-1">
                <input className="input" list="bp-customers" placeholder="Hospital, clinic, lab or factory" value={f.customerName} onChange={(e) => pickCustomer(e.target.value)} />
                <datalist id="bp-customers">
                  {[...customers.keys()].map((c) => <option key={c} value={c} />)}
                </datalist>
              </Field>
              <Field label="Customer TIN">
                <input className="input font-mono" value={f.customerTin} onChange={(e) => set("customerTin", e.target.value)} />
              </Field>
              <Field label="Phone">
                <input className="input" value={f.customerPhone} onChange={(e) => set("customerPhone", e.target.value)} />
              </Field>
            </div>
          </Section>

          <Section title="Payment" className="mb-0">
            <div className="mb-4 grid grid-cols-3 gap-2">
              {([
                ["full", "Paid in full"],
                ["partial", "Partially paid"],
                ["none", "Not paid (credit)"],
              ] as [PayMode, string][]).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => set("payMode", k)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    f.payMode === k ? "border-brand-600 bg-brand-50 text-brand-800 ring-2 ring-brand-200" : "border-[var(--line)] text-[var(--ink-2)] hover:bg-brand-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {f.payMode === "partial" && (
                <Field label="Amount paid (ETB) *" error={errors.amountPaid}>
                  <input type="number" step="0.01" className="input num" value={f.amountPaid || ""} onChange={(e) => set("amountPaid", Number(e.target.value))} />
                </Field>
              )}
              {f.payMode !== "none" && (
                <>
                  <Field label="Payment method">
                    <select className="input" value={f.method} onChange={(e) => set("method", e.target.value as PaymentMethod)}>
                      {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
                    </select>
                  </Field>
                  <Field label="Payment ref. (TRX / cheque no.)">
                    <input className="input font-mono" value={f.payRef} onChange={(e) => set("payRef", e.target.value)} />
                  </Field>
                </>
              )}
              {f.payMode !== "full" && (
                <Field label="Balance due date">
                  <input type="date" className="input" value={f.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
                </Field>
              )}
              <Field label="Notes" className="col-span-2 sm:col-span-4">
                <input className="input" value={f.notes} onChange={(e) => set("notes", e.target.value)} />
              </Field>
            </div>
          </Section>
        </div>

        {/* summary */}
        <aside className="h-fit rounded-xl bg-brand-900 p-5 text-sm text-brand-100 lg:sticky lg:top-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-lime-accent">Summary</p>
          <p className="mt-2 line-clamp-2 font-medium text-white">{product?.name ?? "No product selected"}</p>
          <dl className="mt-4 space-y-2">
            <Row k={`${f.quantity || 0} × ${money(f.unitPrice || 0)}`} v={money((f.quantity || 0) * (f.unitPrice || 0))} />
            {f.discount > 0 && <Row k="Discount" v={"− " + money(f.discount)} />}
            <Row k="Subtotal (excl. VAT)" v={money(totals.subtotal)} />
            <Row k={`VAT ${f.vatRate}%`} v={money(totals.vatAmount)} />
            <div className="my-2 border-t border-brand-700" />
            <Row k="Total" v={money(totals.total)} big />
            <Row k="Paid now" v={money(paidNow)} />
            <div className={`flex justify-between rounded-lg px-3 py-2 ${remaining > 0 ? "bg-amber-400/15 text-amber-200" : "bg-brand-800 text-lime-accent"}`}>
              <dt>Remaining</dt>
              <dd className="num font-semibold">{money(remaining)}</dd>
            </div>
            {product && f.quantity > 0 && (
              <p className="pt-2 text-xs text-brand-300">
                Est. gross profit: <span className="num font-semibold text-white">{money(profit)}</span>
              </p>
            )}
          </dl>
        </aside>
      </div>
    </Modal>
  );
}

function Row({ k, v, big }: { k: string; v: string; big?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt>{k}</dt>
      <dd className={`num text-right ${big ? "text-lg font-semibold text-white" : "text-white"}`}>{v}</dd>
    </div>
  );
}

export function PaymentModal({ sale, onClose }: { sale: Sale | null; onClose: () => void }) {
  const { addPayment, toast } = useStore();
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState<PaymentMethod>("Bank Transfer");
  const [ref, setRef] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!sale) return;
    setAmount(remainingOf(sale));
    setDate(todayISO());
    setRef("");
    setErr("");
  }, [sale]);

  if (!sale) return null;
  const rem = remainingOf(sale);

  const save = () => {
    if (amount <= 0) return setErr("Enter an amount");
    if (amount > rem + 0.005) return setErr(`Cannot exceed remaining ${money(rem)}`);
    addPayment(sale.id, { amount, date, method, reference: ref });
    toast(`Payment of ${money(amount)} recorded for ${sale.invoiceNo}`);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Record payment"
      subtitle={`${sale.invoiceNo} · ${sale.customerName}`}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save}>Save payment</button>
        </>
      }
    >
      <div className="mb-4 grid grid-cols-3 gap-2 text-center text-sm">
        <Mini k="Invoice total" v={money(sale.total)} />
        <Mini k="Paid so far" v={money(paidOf(sale))} />
        <Mini k="Remaining" v={money(rem)} warn />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Amount (ETB) *" error={err}>
          <input type="number" step="0.01" className="input num" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} autoFocus />
        </Field>
        <Field label="Payment date">
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Method">
          <select className="input" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
          </select>
        </Field>
        <Field label="Reference (TRX / cheque no.)">
          <input className="input font-mono" value={ref} onChange={(e) => setRef(e.target.value)} />
        </Field>
      </div>
      <div className="mt-3 flex gap-2">
        <button className="btn-light text-xs" onClick={() => setAmount(rem)}>Full balance</button>
        <button className="btn-light text-xs" onClick={() => setAmount(round2(rem / 2))}>Half</button>
      </div>
    </Modal>
  );
}

function Mini({ k, v, warn }: { k: string; v: string; warn?: boolean }) {
  return (
    <div className={`rounded-lg px-2 py-2 ${warn ? "bg-amber-50" : "bg-brand-50"}`}>
      <p className="text-[11px] text-[var(--ink-3)]">{k}</p>
      <p className={`num font-semibold ${warn ? "text-amber-800" : "text-brand-900"}`}>{v}</p>
    </div>
  );
}

export function SaleDetailModal({
  sale,
  onClose,
  onPay,
}: {
  sale: Sale | null;
  onClose: () => void;
  onPay: (s: Sale) => void;
}) {
  const { deleteSale, toast } = useStore();
  if (!sale) return null;
  const status = statusOf(sale);
  const overdue = isOverdue(sale);
  const rem = remainingOf(sale);

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={`Invoice ${sale.invoiceNo}`}
      subtitle={`${fmtDate(sale.date)} · VAT receipt ${sale.vatReceiptNo}`}
      footer={
        <>
          <button
            className="btn-ghost mr-auto text-red-600 hover:text-red-700"
            onClick={() => {
              if (confirm(`Delete sale ${sale.invoiceNo}? Stock will be returned.`)) {
                deleteSale(sale.id);
                toast(`${sale.invoiceNo} deleted`);
                onClose();
              }
            }}
          >
            Delete sale
          </button>
          <button className="btn-ghost" onClick={() => window.print()}>Print</button>
          {rem > 0 && <button className="btn-primary" onClick={() => onPay(sale)}>Record payment</button>}
        </>
      }
    >
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <StatusBadge status={status} />
        {overdue && <StatusBadge status="Overdue" />}
        {rem > 0 && <span className="text-sm text-[var(--ink-2)]">Balance due {fmtDate(sale.dueDate)}</span>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Info title="Customer" rows={[["Name", sale.customerName], ["TIN", sale.customerTin || "—"], ["Phone", sale.customerPhone || "—"], ["Sales person", sale.salesPerson || "—"]]} />
        <Info title="Product" rows={[["Product", sale.productName], ["Product ID", sale.productId], ["Quantity", String(sale.quantity)], ["Sold price / unit", money(sale.unitPrice)]]} />
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-[var(--line)]">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-[var(--line)]">
            <TR k="Gross amount" v={money(sale.quantity * sale.unitPrice)} />
            {sale.discount > 0 && <TR k="Discount" v={"− " + money(sale.discount)} />}
            <TR k="Subtotal (excl. VAT)" v={money(sale.subtotal)} />
            <TR k={`VAT (${sale.vatRate}%)`} v={money(sale.vatAmount)} />
            <TR k="Invoice total" v={money(sale.total)} strong />
            <TR k="Total paid" v={money(paidOf(sale))} />
            <TR k="Remaining balance" v={money(rem)} strong warn={rem > 0} />
          </tbody>
        </table>
      </div>
      <h4 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-brand-700">Payment history</h4>
      {sale.payments.length === 0 ? (
        <p className="text-sm text-[var(--ink-3)]">No payments received yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
          <table className="w-full text-sm">
            <thead className="bg-brand-50">
              <tr><th className="th">Date</th><th className="th">Method</th><th className="th">Reference</th><th className="th text-right">Amount</th></tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {sale.payments.map((p) => (
                <tr key={p.id}>
                  <td className="td">{fmtDate(p.date)}</td>
                  <td className="td">{p.method}</td>
                  <td className="td font-mono text-xs">{p.reference || "—"}</td>
                  <td className="td num text-right font-medium">{money(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {sale.notes && <p className="mt-4 text-sm text-[var(--ink-2)]"><b>Notes:</b> {sale.notes}</p>}
    </Modal>
  );
}

function Info({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="rounded-xl bg-brand-50/70 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-700">{title}</p>
      <dl className="space-y-1 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4">
            <dt className="text-[var(--ink-3)]">{k}</dt>
            <dd className="text-right font-medium text-brand-950">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function TR({ k, v, strong, warn }: { k: string; v: string; strong?: boolean; warn?: boolean }) {
  return (
    <tr className={strong ? "bg-brand-50/60" : ""}>
      <td className={`px-4 py-2 ${strong ? "font-semibold" : "text-[var(--ink-2)]"}`}>{k}</td>
      <td className={`num px-4 py-2 text-right ${strong ? "font-semibold" : ""} ${warn ? "text-amber-700" : "text-brand-950"}`}>{v}</td>
    </tr>
  );
}
