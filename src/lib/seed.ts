import type { Category, Payment, PaymentMethod, Product, Sale, StockEntry } from "./types";
import { addDays, computeTotals, daysBetween, parseISO, round2 } from "./format";

/* Deterministic PRNG so the demo looks the same for everyone */
function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type CatalogRow = {
  name: string;
  model: string;
  category: Category;
  type: string;
  specs: string;
  unit: string;
  cost: number;
  brand: string;
  origin: string;
  install: boolean;
  warranty: number;
  pop: number; // relative popularity
  q: [number, number]; // typical order size range
};

const C = (
  name: string, model: string, category: Category, type: string, specs: string, unit: string,
  cost: number, brand: string, origin: string, pop: number, q: [number, number], install = true, warranty = 12
): CatalogRow => ({ name, model, category, type, specs, unit, cost, brand, origin, install, warranty, pop, q });

// Fictional brands — demo data only
const CATALOG: CatalogRow[] = [
  C("Digital X-Ray System 500mA", "DRX-500", "Diagnostic Imaging", "Stationary system", "500 mA · 150 kV · flat-panel detector", "Unit", 2_800_000, "Helix Imaging", "China", 1.2, [1, 1], true, 24),
  C("Portable Color Doppler Ultrasound", "US-P20", "Diagnostic Imaging", "Portable", '15" LCD · 3 probes · Doppler', "Unit", 420_000, "Helix Imaging", "China", 3.5, [1, 3], true, 24),
  C("Mobile C-Arm Fluoroscopy", "CA-9000", "Diagnostic Imaging", "Mobile / trolley", "5 kW · 9\" image intensifier", "Unit", 3_600_000, "Medora Systems", "Germany", 0.7, [1, 1], true, 24),
  C("12-Channel ECG Machine", "ECG-1200", "Patient Monitoring", "Portable", "12-lead · thermal printer · interpretation", "Unit", 68_000, "Vitalis Medical", "Korea", 5, [1, 6], false, 12),
  C('Multiparameter Patient Monitor 12"', "PM-12", "Patient Monitoring", "Benchtop", "ECG · SpO₂ · NIBP · Temp · Resp", "Unit", 95_000, "Vitalis Medical", "Korea", 6, [2, 10], false, 24),
  C("Fetal Doppler", "FD-200", "Patient Monitoring", "Portable", "2 MHz probe · LCD display", "Unit", 9_500, "Vitalis Medical", "China", 3, [2, 12], false, 12),
  C("ICU Ventilator", "VT-850", "Respiratory & ICU", "Mobile / trolley", "Invasive & NIV · 15\" touchscreen", "Unit", 1_250_000, "Aerolife", "Turkey", 1.4, [1, 3], true, 24),
  C("Oxygen Concentrator 10L", "OC-10", "Respiratory & ICU", "Floor-standing", "10 L/min · 93% ±3 purity", "Unit", 62_000, "Aerolife", "China", 5, [2, 12], false, 12),
  C("Volumetric Infusion Pump", "IP-300", "Respiratory & ICU", "Benchtop", "0.1–1200 ml/h · drug library", "Unit", 48_000, "Novatek Medical", "China", 5, [2, 15], false, 24),
  C("Syringe Pump", "SP-50", "Respiratory & ICU", "Benchtop", "5–60 ml syringes · KVO", "Unit", 39_000, "Novatek Medical", "China", 3, [2, 10], false, 24),
  C("Electric Suction Machine", "SU-40", "Respiratory & ICU", "Mobile / trolley", "40 L/min · 2×2.5 L jars", "Unit", 28_000, "Novatek Medical", "India", 3, [1, 6], false, 12),
  C("Automated Chemistry Analyzer", "CA-400", "Laboratory Equipment", "Benchtop", "400 tests/h · 80 reagent positions", "Unit", 1_900_000, "LabCore", "Italy", 1.1, [1, 1], true, 24),
  C("5-Part Hematology Analyzer", "HA-5", "Laboratory Equipment", "Benchtop", "60 samples/h · 29 parameters", "Unit", 980_000, "LabCore", "China", 1.6, [1, 2], true, 24),
  C("Laboratory Centrifuge 24-place", "LC-24", "Laboratory Equipment", "Benchtop", "4000 rpm · digital timer", "Unit", 46_000, "LabCore", "China", 4, [1, 6], false, 12),
  C("Binocular Microscope", "BM-1000", "Laboratory Equipment", "Benchtop", "40×–1000× · LED illumination", "Unit", 24_000, "Optiview", "India", 5, [2, 12], false, 12),
  C("Laboratory Incubator 80L", "INC-80", "Laboratory Equipment", "Floor-standing", "RT+5 to 70°C · PID control", "Unit", 72_000, "LabCore", "China", 2, [1, 4], false, 12),
  C("Biosafety Cabinet Class II", "BSC-1300", "Laboratory Equipment", "Floor-standing", "1.3 m · HEPA · UV lamp", "Unit", 340_000, "LabCore", "China", 1.3, [1, 2], true, 24),
  C("Vertical Autoclave 50L", "VA-50", "Sterilization", "Floor-standing", "134°C · 50 L · auto drain", "Unit", 160_000, "SteriMax", "China", 3, [1, 4], true, 12),
  C("Tabletop Autoclave 23L Class B", "TA-23B", "Sterilization", "Benchtop", "Class B vacuum · 23 L", "Unit", 115_000, "SteriMax", "Italy", 3, [1, 4], false, 24),
  C("Hot Air Sterilizer Oven", "HO-70", "Sterilization", "Benchtop", "70 L · up to 250°C", "Unit", 38_000, "SteriMax", "India", 2, [1, 4], false, 12),
  C("Electric Operating Table", "OT-700", "Surgical & Theatre", "Stationary system", "Electro-hydraulic · 5 sections", "Unit", 720_000, "Medora Systems", "Turkey", 1.3, [1, 2], true, 24),
  C("LED Surgical Light (Double Dome)", "SL-760", "Surgical & Theatre", "Wall / ceiling mounted", "160,000 lux · 2 domes", "Set", 380_000, "Medora Systems", "Turkey", 1.3, [1, 2], true, 24),
  C("Electrosurgical Unit 400W", "ESU-400", "Surgical & Theatre", "Mobile / trolley", "Mono & bipolar · 400 W", "Unit", 210_000, "Novatek Medical", "China", 2, [1, 3], false, 24),
  C("Anaesthesia Workstation", "AW-900", "Surgical & Theatre", "Mobile / trolley", "2 vaporizers · integrated ventilator", "Unit", 890_000, "Aerolife", "Turkey", 1, [1, 1], true, 24),
  C("Rotary Tablet Press 27-Station", "RTP-27", "Pharmaceutical Production", "Production machine", "Up to 97,200 tablets/h", "Unit", 3_200_000, "PharmaTech Machinery", "India", 0.5, [1, 1], true, 12),
  C("Semi-Auto Capsule Filling Machine", "CFM-25", "Pharmaceutical Production", "Production machine", "25,000 capsules/h", "Unit", 1_450_000, "PharmaTech Machinery", "India", 0.5, [1, 1], true, 12),
  C("Blister Packing Machine", "BPM-140", "Pharmaceutical Production", "Production machine", "ALU-PVC · 140 blisters/min", "Unit", 2_100_000, "PharmaTech Machinery", "China", 0.4, [1, 1], true, 12),
  C("4-Head Liquid Filling Machine", "LFM-4", "Pharmaceutical Production", "Production machine", "30–60 bottles/min · servo", "Unit", 680_000, "PharmaTech Machinery", "India", 0.6, [1, 1], true, 12),
  C("Dental Chair Unit", "DC-3200", "Dental Equipment", "Stationary system", "Electric chair · LED lamp · handpieces", "Unit", 420_000, "Dentaline", "China", 1.6, [1, 3], true, 24),
  C("Wall-Mounted Dental X-Ray", "DX-70", "Dental Equipment", "Wall / ceiling mounted", "70 kV · 8 mA", "Unit", 165_000, "Dentaline", "Italy", 1, [1, 2], true, 24),
  C("5-Function Electric ICU Bed", "ICU-5F", "Hospital Furniture", "Floor-standing", "5 motors · CPR release · side rails", "Unit", 145_000, "CareFrame", "China", 3, [2, 10], false, 24),
  C("2-Crank Manual Hospital Bed", "HB-2C", "Hospital Furniture", "Floor-standing", "ABS head/foot boards · castors", "Unit", 32_000, "CareFrame", "China", 5, [4, 20], false, 12),
  C("Standard Wheelchair", "WC-01", "Hospital Furniture", "Mobile / trolley", "Foldable · 100 kg load", "Unit", 6_500, "CareFrame", "China", 4, [5, 25], false, 6),
  C("Convex Ultrasound Probe", "C5-2", "Spare Parts & Accessories", "Accessory / spare part", "2–5 MHz · for US-P20", "Piece", 85_000, "Helix Imaging", "China", 2, [1, 3], false, 6),
  C("ECG Cable & Electrode Kit", "EK-10", "Spare Parts & Accessories", "Accessory / spare part", "10-lead cable · 6 bulb electrodes", "Set", 3_200, "Vitalis Medical", "China", 4, [5, 30], false, 6),
  C("SpO₂ Sensor (Reusable)", "SPO-R", "Spare Parts & Accessories", "Accessory / spare part", "Adult finger clip · 3 m", "Piece", 2_400, "Vitalis Medical", "China", 4, [5, 40], false, 6),
];

const SUPPLIERS: Record<string, string> = {
  "Helix Imaging": "Helix Imaging Africa FZE",
  "Medora Systems": "Medora Export GmbH",
  "Vitalis Medical": "Vitalis Global Trade",
  Aerolife: "Aerolife Medikal A.Ş.",
  "Novatek Medical": "Novatek Medical Supply",
  LabCore: "LabCore Instruments",
  Optiview: "Optiview Scientific",
  SteriMax: "SteriMax International",
  "PharmaTech Machinery": "PharmaTech Engineering Pvt.",
  Dentaline: "Dentaline Equipment Co.",
  CareFrame: "CareFrame Hospital Furniture",
};

const CUSTOMERS = [
  { name: "Hayat General Hospital", tin: "0045678123", phone: "+251 114 567 890", w: 8 },
  { name: "Tena Medium Clinic", tin: "0034567812", phone: "+251 913 456 789", w: 5 },
  { name: "Unity Hospital", tin: "0125678901", phone: "+251 116 345 678", w: 6 },
  { name: "Kidus Specialty Clinic", tin: "0081234567", phone: "+251 918 901 234", w: 4 },
  { name: "Nile Health Center", tin: "0103456789", phone: "+251 921 123 456", w: 4 },
  { name: "Abay Diagnostic Laboratory", tin: "0023456781", phone: "+251 912 345 678", w: 5 },
  { name: "Selam Dental Clinic", tin: "0012345678", phone: "+251 911 234 567", w: 3 },
  { name: "Entoto Referral Hospital", tin: "0114567890", phone: "+251 922 234 567", w: 5 },
  { name: "Gihon Pharmaceuticals PLC", tin: "0067812345", phone: "+251 916 789 012", w: 2 },
  { name: "Afya Medical Center", tin: "0092345678", phone: "+251 919 012 345", w: 4 },
  { name: "Bethel Maternity Hospital", tin: "0078123456", phone: "+251 917 890 123", w: 3 },
  { name: "Regional Health Bureau", tin: "0056781234", phone: "+251 115 678 901", w: 4 },
];

const SALES_PEOPLE = ["Abel Tesfaye", "Hana Mekonnen", "Dawit Kebede", "Meron Alemu"];
const LOCATIONS = ["Main Warehouse", "Warehouse B", "Showroom"];

export type SeedData = { products: Product[]; stock: StockEntry[]; sales: Sale[] };

export function generateSeed(today: string): SeedData {
  const r = mulberry32(20260101);
  const rand = (a: number, b: number) => a + r() * (b - a);
  const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1));
  const pick = <T,>(arr: T[]) => arr[Math.floor(r() * arr.length)];
  const weighted = <T,>(arr: T[], w: (t: T) => number) => {
    const total = arr.reduce((s, t) => s + w(t), 0);
    let x = r() * total;
    for (const t of arr) {
      x -= w(t);
      if (x <= 0) return t;
    }
    return arr[arr.length - 1];
  };
  const lot = () =>
    "SN" + String.fromCharCode(65 + randInt(0, 25)) + String.fromCharCode(65 + randInt(0, 25)) + randInt(100000, 999999);

  const thisYear = parseISO(today).getFullYear();
  const start = `${thisYear - 1}-01-02`;
  const totalDays = daysBetween(start, today);

  const stock: StockEntry[] = [];
  const sales: Sale[] = [];
  let stockSeq = 1;
  let paySeq = 1;

  const products: Product[] = CATALOG.map((c, i) => {
    const lateAdd = i % 9 === 8; // a few products added this year
    const dateAdded = lateAdd
      ? addDays(`${thisYear}-01-05`, randInt(0, Math.max(1, daysBetween(`${thisYear}-01-05`, today) - 60)))
      : addDays(start, randInt(0, 20));
    const margin = c.cost > 500_000 ? rand(0.12, 0.22) : rand(0.2, 0.35);
    const avgQ = (c.q[0] + c.q[1]) / 2;
    return {
      id: `BP-${1001 + i}`,
      name: c.name,
      model: c.model,
      brand: c.brand,
      category: c.category,
      type: c.type,
      specs: c.specs,
      origin: c.origin,
      supplier: SUPPLIERS[c.brand] ?? "Global Medical Imports",
      lotNumber: lot(),
      quantity: 0,
      unit: c.unit,
      unitCost: c.cost,
      sellingPrice: Math.round((c.cost * (1 + margin)) / 100) * 100,
      reorderLevel: Math.max(1, Math.round(avgQ * 1.5)),
      manufactureDate: addDays(dateAdded, -randInt(30, 240)),
      warrantyMonths: c.warranty,
      dateAdded,
      location: `${c.type === "Production machine" ? "Warehouse B" : pick(LOCATIONS)} · Bay ${randInt(1, 12)}`,
      condition: r() < 0.08 ? "Refurbished" : "New",
      requiresInstallation: c.install,
      notes: "",
    };
  });

  const catalogOf = new Map(products.map((p, i) => [p.id, CATALOG[i]]));
  const orderSize = (p: Product) => {
    const c = catalogOf.get(p.id)!;
    return randInt(c.q[0], c.q[1]);
  };
  const restockQty = (p: Product) => {
    const c = catalogOf.get(p.id)!;
    return Math.max(2, Math.round(((c.q[0] + c.q[1]) / 2) * rand(4, 8)));
  };

  const restock = (p: Product, date: string, qty: number, opening = false) => {
    const l = lot();
    stock.push({
      id: `STK-${String(stockSeq++).padStart(5, "0")}`,
      productId: p.id,
      quantity: qty,
      unitCost: p.unitCost,
      date,
      lotNumber: l,
      supplier: p.supplier,
      note: opening ? "Opening stock" : "Import shipment",
    });
    p.quantity += qty;
    p.lotNumber = l;
    p.manufactureDate = addDays(date, -randInt(30, 180));
  };

  for (const p of products) restock(p, p.dateAdded, restockQty(p), true);

  const methods: PaymentMethod[] = ["Bank Transfer", "Bank Transfer", "Bank Transfer", "Cheque", "Letter of Credit", "Cash"];
  const invSeq: Record<number, number> = {};
  const ref = (m: PaymentMethod) =>
    m === "Cash" ? "" : m === "Cheque" ? `CHQ${randInt(100000, 999999)}` : m === "Letter of Credit" ? `LC-${randInt(1000, 9999)}` : `TRX${randInt(100000, 999999)}`;

  for (let dayIdx = 0; dayIdx <= totalDays; dayIdx++) {
    const date = addDays(start, dayIdx);
    const d = parseISO(date);
    if (d.getDay() === 0) continue; // closed on Sundays
    const daysToToday = totalDays - dayIdx;

    // growth trend + fiscal-year-end procurement push (Ethiopian FY ends early July)
    const month = d.getMonth();
    const growth = 1 + (dayIdx / totalDays) * 0.5;
    const season = month === 5 || month === 6 ? 1.35 : month === 7 || month === 8 ? 0.8 : 1;
    const saturday = d.getDay() === 6 ? 0.4 : 1;
    const n = Math.max(0, Math.round(rand(0.2, 2.1) * growth * season * saturday));

    for (let k = 0; k < n; k++) {
      const available = products.filter((p) => p.dateAdded <= date);
      const p = weighted(available, (p) => catalogOf.get(p.id)!.pop);
      const qty = orderSize(p);

      if (p.quantity < qty) restock(p, date, restockQty(p));

      const cust = weighted(CUSTOMERS, (c) => c.w);
      const unitPrice = round2(p.sellingPrice * (1 - (r() < 0.3 ? rand(0, 0.04) : 0)));
      const discount = r() < 0.12 ? Math.round(qty * unitPrice * rand(0.02, 0.05)) : 0;
      const t = computeTotals(qty, unitPrice, discount, 15);

      const y = d.getFullYear();
      invSeq[y] = (invSeq[y] ?? 0) + 1;

      // equipment deals often start with a deposit; older deals are mostly settled
      const roll = r();
      let paidShare: number;
      if (daysToToday > 90) paidShare = roll < 0.93 ? 1 : rand(0.4, 0.8);
      else if (daysToToday > 20) paidShare = roll < 0.6 ? 1 : roll < 0.9 ? rand(0.3, 0.7) : 0;
      else paidShare = roll < 0.35 ? 1 : roll < 0.8 ? rand(0.3, 0.6) : 0;

      const payments: Payment[] = [];
      if (paidShare > 0) {
        const m = pick(methods);
        if (paidShare === 1 && r() < 0.55 && daysToToday > 10) {
          // deposit then balance on delivery / installation
          const first = round2(t.total * rand(0.3, 0.6));
          const later = addDays(date, Math.min(daysToToday, randInt(7, 45)));
          payments.push({ id: `PAY-${paySeq++}`, date, amount: first, method: m, reference: ref(m) });
          payments.push({ id: `PAY-${paySeq++}`, date: later, amount: round2(t.total - first), method: m, reference: ref(m) });
        } else {
          const amount = paidShare === 1 ? t.total : round2(t.total * paidShare);
          payments.push({ id: `PAY-${paySeq++}`, date, amount, method: m, reference: ref(m) });
        }
      }

      sales.push({
        id: `S-${sales.length + 1}`,
        invoiceNo: `INV-${y}-${String(invSeq[y]).padStart(5, "0")}`,
        vatReceiptNo: `FS${String(randInt(10000000, 99999999))}`,
        date,
        productId: p.id,
        productName: p.name,
        quantity: qty,
        unitPrice,
        unitCost: p.unitCost,
        discount,
        vatRate: 15,
        ...t,
        customerName: cust.name,
        customerTin: cust.tin,
        customerPhone: cust.phone,
        salesPerson: pick(SALES_PEOPLE),
        dueDate: addDays(date, 45),
        payments,
        notes: catalogOf.get(p.id)!.install ? "Includes delivery, installation & user training" : "",
      });
      p.quantity -= qty;

      // replenish when at/below reorder level (less eager near the end so some items show as low stock)
      const eagerness = daysToToday < 75 ? 0.12 : 0.75;
      if (p.quantity <= p.reorderLevel && r() < eagerness) restock(p, date, restockQty(p));
    }
  }

  return { products, stock, sales: sales.reverse() };
}

export const EMPTY_PRODUCT = (today: string): Product => ({
  id: "",
  name: "",
  model: "",
  brand: "",
  category: "Patient Monitoring",
  type: "Benchtop",
  specs: "",
  origin: "",
  supplier: "",
  lotNumber: "",
  quantity: 0,
  unit: "Unit",
  unitCost: 0,
  sellingPrice: 0,
  reorderLevel: 2,
  manufactureDate: "",
  warrantyMonths: 12,
  dateAdded: today,
  location: "Main Warehouse",
  condition: "New",
  requiresInstallation: false,
  notes: "",
});
