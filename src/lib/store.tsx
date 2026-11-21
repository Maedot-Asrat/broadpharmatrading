"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Payment, Product, Sale, StockEntry } from "./types";
import { generateSeed } from "./seed";
import { round2, todayISO } from "./format";

const KEY = "broadpharma-demo-v2-equipment";

type State = { products: Product[]; stock: StockEntry[]; sales: Sale[] };

type Toast = { id: number; text: string; tone: "ok" | "err" };

type Store = State & {
  ready: boolean;
  addProduct: (p: Product) => void;
  updateProduct: (id: string, p: Product) => void;
  deleteProduct: (id: string) => void;
  restock: (e: Omit<StockEntry, "id">, updates?: Partial<Product>) => void;
  addSale: (s: Omit<Sale, "id">) => void;
  addPayment: (saleId: string, p: Omit<Payment, "id">) => void;
  deleteSale: (id: string) => void;
  resetDemo: () => void;
  nextProductId: () => string;
  nextInvoiceNo: (date: string) => string;
  toast: (text: string, tone?: "ok" | "err") => void;
};

const Ctx = createContext<Store | null>(null);

const uid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>({ products: [], stock: [], sales: [] });
  const [ready, setReady] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastSeq = useRef(0);

  useEffect(() => {
    let loaded: State | null = null;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) loaded = JSON.parse(raw);
    } catch {}
    setState(loaded ?? generateSeed(todayISO()));
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {}
  }, [state, ready]);

  const toast = useCallback((text: string, tone: "ok" | "err" = "ok") => {
    const id = ++toastSeq.current;
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const store = useMemo<Store>(() => {
    const { products, sales } = state;
    return {
      ...state,
      ready,
      toast,
      nextProductId: () => {
        const max = products.reduce((m, p) => {
          const n = Number(p.id.replace(/\D/g, ""));
          return Number.isFinite(n) ? Math.max(m, n) : m;
        }, 1000);
        return `BP-${max + 1}`;
      },
      nextInvoiceNo: (date: string) => {
        const y = date.slice(0, 4);
        const max = sales
          .filter((s) => s.invoiceNo.startsWith(`INV-${y}-`))
          .reduce((m, s) => Math.max(m, Number(s.invoiceNo.split("-")[2]) || 0), 0);
        return `INV-${y}-${String(max + 1).padStart(5, "0")}`;
      },
      addProduct: (p) =>
        setState((s) => ({
          ...s,
          products: [p, ...s.products],
          stock:
            p.quantity > 0
              ? [
                  {
                    id: uid("STK"),
                    productId: p.id,
                    quantity: p.quantity,
                    unitCost: p.unitCost,
                    date: p.dateAdded,
                    lotNumber: p.lotNumber,
                    supplier: p.supplier,
                    note: "Opening stock",
                  },
                  ...s.stock,
                ]
              : s.stock,
        })),
      updateProduct: (id, p) =>
        setState((s) => ({ ...s, products: s.products.map((x) => (x.id === id ? p : x)) })),
      deleteProduct: (id) =>
        setState((s) => ({ ...s, products: s.products.filter((x) => x.id !== id) })),
      restock: (e, updates) =>
        setState((s) => ({
          ...s,
          stock: [{ ...e, id: uid("STK") }, ...s.stock],
          products: s.products.map((p) =>
            p.id === e.productId
              ? { ...p, ...updates, quantity: p.quantity + e.quantity, lotNumber: e.lotNumber || p.lotNumber, unitCost: e.unitCost }
              : p
          ),
        })),
      addSale: (sale) =>
        setState((s) => ({
          ...s,
          sales: [{ ...sale, id: uid("S") }, ...s.sales],
          products: s.products.map((p) =>
            p.id === sale.productId ? { ...p, quantity: p.quantity - sale.quantity } : p
          ),
        })),
      addPayment: (saleId, pay) =>
        setState((s) => ({
          ...s,
          sales: s.sales.map((x) =>
            x.id === saleId
              ? { ...x, payments: [...x.payments, { ...pay, amount: round2(pay.amount), id: uid("PAY") }] }
              : x
          ),
        })),
      deleteSale: (id) =>
        setState((s) => {
          const sale = s.sales.find((x) => x.id === id);
          return {
            ...s,
            sales: s.sales.filter((x) => x.id !== id),
            products: sale
              ? s.products.map((p) => (p.id === sale.productId ? { ...p, quantity: p.quantity + sale.quantity } : p))
              : s.products,
          };
        }),
      resetDemo: () => {
        setState(generateSeed(todayISO()));
      },
    };
  }, [state, ready, toast]);

  return (
    <Ctx.Provider value={store}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${
              t.tone === "ok" ? "bg-brand-800" : "bg-red-600"
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be used inside StoreProvider");
  return s;
}
