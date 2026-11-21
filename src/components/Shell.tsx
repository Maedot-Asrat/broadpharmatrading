"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icon, Logo } from "./Icon";
import { useStore } from "@/lib/store";
import { fmtDate, remainingOf, stockStatus, todayISO } from "@/lib/format";
import { Loading } from "./ui";

const NAV = [
  { href: "/", label: "Dashboard", icon: "dashboard" },
  { href: "/products", label: "Products & Stock", icon: "box" },
  { href: "/sales", label: "Sales", icon: "cart" },
  { href: "/receivables", label: "Receivables", icon: "wallet" },
  { href: "/analytics", label: "Analytics", icon: "chart" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const { ready, products, sales, resetDemo, toast } = useStore();

  const low = products.filter((p) => stockStatus(p) !== "In stock").length;
  const outstanding = sales.filter((s) => remainingOf(s) > 0).length;

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {NAV.map((n) => {
        const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
        const count = n.href === "/products" ? low : n.href === "/receivables" ? outstanding : 0;
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              active ? "bg-lime-accent text-brand-950" : "text-brand-100 hover:bg-brand-800 hover:text-white"
            }`}
          >
            <Icon name={n.icon} className="h-[18px] w-[18px]" />
            <span className="flex-1">{n.label}</span>
            {ready && count > 0 && (
              <span
                className={`num rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  active ? "bg-brand-900 text-lime-accent" : "bg-brand-800 text-brand-200"
                }`}
                title={n.href === "/products" ? "Low / out of stock" : "Invoices with balance"}
              >
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-3 px-5 py-5">
      <Logo />
      <div className="leading-tight">
        <p className="text-[15px] font-bold tracking-tight text-white">BroadPharma</p>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-lime-accent">Trading</p>
      </div>
    </div>
  );

  const footer = (
    <div className="m-3 rounded-xl bg-brand-800/70 p-3 text-xs text-brand-200">
      <p className="font-semibold text-white">Demo mode</p>
      <p className="mt-0.5">Data is stored in this browser only.</p>
      <button
        onClick={() => {
          if (confirm("Reset all data back to the demo dataset?")) {
            resetDemo();
            toast("Demo data has been reset");
          }
        }}
        className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-brand-900 px-2.5 py-1.5 font-medium text-lime-accent hover:bg-brand-950"
      >
        <Icon name="refresh" className="h-3.5 w-3.5" /> Reset demo data
      </button>
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-brand-900 lg:flex">
        {brand}
        {nav}
        {footer}
      </aside>

      {/* mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-brand-950/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-brand-900">
            {brand}
            {nav}
            {footer}
          </aside>
        </div>
      )}

      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-[var(--line)] bg-white/85 px-4 backdrop-blur sm:px-6">
        <button className="icon-btn lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
          <Icon name="menu" className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 lg:hidden">
          <Logo className="h-7 w-7" />
          <span className="text-sm font-bold text-brand-900">BroadPharma Trading</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-sm text-[var(--ink-2)] sm:inline">{fmtDate(todayISO())}</span>
          <div className="flex items-center gap-2 rounded-full bg-brand-50 py-1 pl-1 pr-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-700 text-xs font-semibold text-white">
              AD
            </span>
            <span className="hidden text-sm font-medium text-brand-900 sm:inline">Admin</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">{ready ? children : <Loading />}</main>
    </div>
  );
}
