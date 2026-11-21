"use client";

import { useEffect, useState } from "react";
import { Field, Modal, Section } from "./ui";
import { useStore } from "@/lib/store";
import { CATEGORIES, CONDITIONS, EQUIPMENT_TYPES, UNITS, type Category, type Product } from "@/lib/types";
import { EMPTY_PRODUCT } from "@/lib/seed";
import { money, round2, todayISO } from "@/lib/format";

export function ProductFormModal({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing?: Product | null;
}) {
  const { products, addProduct, updateProduct, nextProductId, toast } = useStore();
  const [p, setP] = useState<Product>(EMPTY_PRODUCT(todayISO()));
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setP(editing ? { ...editing } : { ...EMPTY_PRODUCT(todayISO()), id: nextProductId() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const set = <K extends keyof Product>(k: K, v: Product[K]) => setP((x) => ({ ...x, [k]: v }));
  const num = (v: string) => (v === "" ? 0 : Number(v));

  const margin = p.unitCost > 0 ? ((p.sellingPrice - p.unitCost) / p.unitCost) * 100 : 0;

  const save = () => {
    const e: Record<string, string> = {};
    const id = p.id.trim().toUpperCase();
    if (!id) e.id = "Product ID is required";
    else if (products.some((x) => x.id.toUpperCase() === id && x.id !== editing?.id)) e.id = "This ID is already used by another product";
    if (!p.name.trim()) e.name = "Product name is required";
    if (p.unitCost <= 0) e.unitCost = "Enter the purchase cost";
    if (p.sellingPrice <= 0) e.sellingPrice = "Enter a selling price";
    if (p.quantity < 0) e.quantity = "Quantity cannot be negative";
    if (p.warrantyMonths < 0) e.warrantyMonths = "Warranty cannot be negative";
    setErrors(e);
    if (Object.keys(e).length) return;

    const clean: Product = { ...p, id, unitCost: round2(p.unitCost), sellingPrice: round2(p.sellingPrice) };
    if (editing) {
      updateProduct(editing.id, clean);
      toast(`${clean.name} updated`);
    } else {
      addProduct(clean);
      toast(`${clean.name} added to stock`);
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={editing ? "Edit product" : "Add new product"}
      subtitle={editing ? `${editing.id} · ${editing.name}` : "Register a machine or equipment item and its opening stock"}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save}>{editing ? "Save changes" : "Add product"}</button>
        </>
      }
    >
      <Section title="Identification">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Product ID *" error={errors.id} hint="Unique code, auto-suggested">
            <input className="input font-mono" value={p.id} onChange={(e) => set("id", e.target.value)} />
          </Field>
          <Field label="Product name *" error={errors.name} className="sm:col-span-2">
            <input className="input" placeholder="e.g. Multiparameter Patient Monitor" value={p.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="Brand / manufacturer">
            <input className="input" value={p.brand} onChange={(e) => set("brand", e.target.value)} />
          </Field>
          <Field label="Model number">
            <input className="input font-mono" placeholder="e.g. PM-12" value={p.model} onChange={(e) => set("model", e.target.value)} />
          </Field>
          <Field label="Category">
            <select className="input" value={p.category} onChange={(e) => set("category", e.target.value as Category)}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Equipment type">
            <select className="input" value={p.type} onChange={(e) => set("type", e.target.value)}>
              {EQUIPMENT_TYPES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Key specifications" className="sm:col-span-2">
            <input className="input" placeholder="e.g. 220V · 500 W · 15&quot; touchscreen" value={p.specs} onChange={(e) => set("specs", e.target.value)} />
          </Field>
          <Field label="Country of origin">
            <input className="input" value={p.origin} onChange={(e) => set("origin", e.target.value)} />
          </Field>
          <Field label="Supplier" className="sm:col-span-2">
            <input className="input" value={p.supplier} onChange={(e) => set("supplier", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Stock & pricing (ETB)">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field
            label={editing ? "Quantity in stock" : "Opening quantity *"}
            error={errors.quantity}
            hint={editing ? "Use Restock to add stock" : undefined}
          >
            <input type="number" min={0} className="input num" disabled={!!editing} value={p.quantity || ""} onChange={(e) => set("quantity", num(e.target.value))} />
          </Field>
          <Field label="Unit">
            <select className="input" value={p.unit} onChange={(e) => set("unit", e.target.value)}>
              {UNITS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Landed unit cost *" error={errors.unitCost} hint="Purchase + freight + duty">
            <input type="number" min={0} step="0.01" className="input num" value={p.unitCost || ""} onChange={(e) => set("unitCost", num(e.target.value))} />
          </Field>
          <Field
            label="Selling price *"
            error={errors.sellingPrice}
            hint={p.unitCost > 0 && p.sellingPrice > 0 ? `Margin ${margin.toFixed(1)}%` : undefined}
          >
            <input type="number" min={0} step="0.01" className="input num" value={p.sellingPrice || ""} onChange={(e) => set("sellingPrice", num(e.target.value))} />
          </Field>
          <Field label="Reorder level" hint="Alert when stock falls to this">
            <input type="number" min={0} className="input num" value={p.reorderLevel || ""} onChange={(e) => set("reorderLevel", num(e.target.value))} />
          </Field>
          <Field label="Serial / lot number">
            <input className="input font-mono" value={p.lotNumber} onChange={(e) => set("lotNumber", e.target.value)} />
          </Field>
          <div className="col-span-2 flex items-end">
            <div className="w-full rounded-lg bg-brand-50 px-3 py-2 text-sm">
              <span className="text-[var(--ink-2)]">Stock value at cost: </span>
              <span className="num font-semibold text-brand-900">{money(p.quantity * p.unitCost)}</span>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Dates, warranty & handling" className="mb-0">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Date added">
            <input type="date" className="input" value={p.dateAdded} onChange={(e) => set("dateAdded", e.target.value)} />
          </Field>
          <Field label="Manufacture date">
            <input type="date" className="input" value={p.manufactureDate} onChange={(e) => set("manufactureDate", e.target.value)} />
          </Field>
          <Field label="Warranty (months)" error={errors.warrantyMonths}>
            <select className="input" value={p.warrantyMonths} onChange={(e) => set("warrantyMonths", Number(e.target.value))}>
              {[0, 6, 12, 18, 24, 36, 60].map((m) => <option key={m} value={m}>{m === 0 ? "No warranty" : `${m} months`}</option>)}
            </select>
          </Field>
          <Field label="Condition">
            <select className="input" value={p.condition} onChange={(e) => set("condition", e.target.value)}>
              {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Warehouse location" className="col-span-2">
            <input className="input" value={p.location} onChange={(e) => set("location", e.target.value)} />
          </Field>
          <label className="col-span-2 flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-brand-700" checked={p.requiresInstallation} onChange={(e) => set("requiresInstallation", e.target.checked)} />
            Requires on-site installation &amp; training
          </label>
          <Field label="Notes" className="col-span-2 sm:col-span-4">
            <textarea className="input" rows={2} value={p.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </div>
      </Section>
    </Modal>
  );
}

export function RestockModal({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const { restock, toast } = useStore();
  const [qty, setQty] = useState(0);
  const [cost, setCost] = useState(0);
  const [date, setDate] = useState(todayISO());
  const [lot, setLot] = useState("");
  const [supplier, setSupplier] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!product) return;
    setQty(0);
    setCost(product.unitCost);
    setDate(todayISO());
    setLot("");
    setSupplier(product.supplier);
    setNote("");
    setErr("");
  }, [product]);

  if (!product) return null;

  const save = () => {
    if (qty <= 0) return setErr("Enter the quantity received");
    restock({ productId: product.id, quantity: qty, unitCost: cost, date, lotNumber: lot, supplier, note: note || "Import shipment" });
    toast(`Received ${qty} ${product.unit} of ${product.name}`);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Restock product"
      subtitle={`${product.id} · ${product.name} — currently ${product.quantity} ${product.unit}`}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save}>Add to stock</button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label={`Quantity received (${product.unit}) *`} error={err}>
          <input type="number" min={1} className="input num" value={qty || ""} onChange={(e) => setQty(Number(e.target.value))} autoFocus />
        </Field>
        <Field label="Landed unit cost (ETB)">
          <input type="number" step="0.01" className="input num" value={cost || ""} onChange={(e) => setCost(Number(e.target.value))} />
        </Field>
        <Field label="Date received">
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Serial / lot number">
          <input className="input font-mono" value={lot} onChange={(e) => setLot(e.target.value)} />
        </Field>
        <Field label="Supplier">
          <input className="input" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
        </Field>
        <Field label="Note / GRN / customs ref.">
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
      <div className="mt-4 rounded-lg bg-brand-50 px-3 py-2 text-sm text-[var(--ink-2)]">
        New stock level: <b className="num text-brand-900">{product.quantity + (qty || 0)} {product.unit}</b> · Purchase value:{" "}
        <b className="num text-brand-900">{money((qty || 0) * cost)}</b>
      </div>
    </Modal>
  );
}
