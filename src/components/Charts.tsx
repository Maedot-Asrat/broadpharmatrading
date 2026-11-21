"use client";

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { compact, int, money0 } from "@/lib/format";

export const C = {
  green: "#1f8049",
  greenLight: "#8bd3a5",
  amber: "#eda100",
  blue: "#2a78d6",
  grid: "#e8efea",
  axis: "#7c8b82",
};

const axisProps = {
  tick: { fill: C.axis, fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

type TipRow = { name: string; value: string; color: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Tip({ active, payload, label, fmt, extra }: any) {
  if (!active || !payload?.length) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: TipRow[] = payload.map((p: any) => ({ name: p.name, value: fmt(Number(p.value)), color: p.color || p.fill }));
  const ex = extra?.(payload[0].payload) as string | undefined;
  return (
    <div className="min-w-[170px] rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1.5 font-semibold text-brand-950">{label}</p>
      {rows.map((r) => (
        <div key={r.name} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-[var(--ink-2)]">
            <span className="h-2 w-2 rounded-sm" style={{ background: r.color }} />
            {r.name}
          </span>
          <span className="num font-semibold text-brand-950">{r.value}</span>
        </div>
      ))}
      {ex && <p className="mt-1.5 border-t border-[var(--line)] pt-1.5 text-[var(--ink-2)]">{ex}</p>}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; value?: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-[var(--ink-2)]">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label}
          {i.value && <b className="num font-semibold text-brand-950">{i.value}</b>}
        </span>
      ))}
    </div>
  );
}

type Row = Record<string, string | number>;

export function RevenueBars({ data }: { data: Row[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="18%">
        <CartesianGrid vertical={false} stroke={C.grid} />
        <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={4} />
        <YAxis {...axisProps} width={48} tickFormatter={(v) => compact(Number(v))} />
        <Tooltip
          cursor={{ fill: "rgba(31,128,73,0.06)" }}
          content={<Tip fmt={money0} extra={(p: Row) => `Total ${money0(Number(p.revenue))} · ${p.invoices} invoices`} />}
        />
        <Bar dataKey="collected" name="Collected" stackId="a" fill={C.green} stroke="#fff" strokeWidth={1} />
        <Bar dataKey="outstanding" name="Outstanding" stackId="a" fill={C.amber} stroke="#fff" strokeWidth={1} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function UnitsLines({ data }: { data: Row[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={C.grid} />
        <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={4} />
        <YAxis {...axisProps} width={48} tickFormatter={(v) => compact(Number(v))} />
        <Tooltip cursor={{ stroke: C.axis, strokeDasharray: "3 3" }} content={<Tip fmt={(v: number) => `${int(v)} units`} />} />
        <Line type="monotone" dataKey="sold" name="Units sold" stroke={C.green} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2 }} />
        <Line type="monotone" dataKey="received" name="Units received" stroke={C.blue} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function HBars({
  data, dataKey, name, fmt = money0, color = C.green, labelWidth = 150,
}: {
  data: Row[]; dataKey: string; name: string; fmt?: (n: number) => string; color?: string; labelWidth?: number;
}) {
  const h = Math.max(120, data.length * 32 + 16);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 56, left: 0, bottom: 0 }} barCategoryGap={6}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={labelWidth}
          tick={{ fill: "#4b5d52", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: string) => (v.length > 24 ? v.slice(0, 23) + "…" : v)}
        />
        <Tooltip cursor={{ fill: "rgba(31,128,73,0.06)" }} content={<Tip fmt={fmt} />} />
        <Bar
          dataKey={dataKey}
          name={name}
          fill={color}
          radius={[0, 4, 4, 0]}
          label={{ position: "right", fill: "#4b5d52", fontSize: 11, formatter: (v: unknown) => compact(Number(v)) }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SparkArea({ data, dataKey = "revenue", height = 200 }: { data: Row[]; dataKey?: string; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="bpArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.green} stopOpacity={0.28} />
            <stop offset="100%" stopColor={C.green} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={C.grid} />
        <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={16} />
        <YAxis {...axisProps} width={44} tickFormatter={(v) => compact(Number(v))} />
        <Tooltip cursor={{ stroke: C.axis, strokeDasharray: "3 3" }} content={<Tip fmt={money0} />} />
        <Area type="monotone" dataKey={dataKey} name="Sales (incl. VAT)" stroke={C.green} strokeWidth={2} fill="url(#bpArea)" activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
