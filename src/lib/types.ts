export type Category =
  | "Diagnostic Imaging"
  | "Patient Monitoring"
  | "Respiratory & ICU"
  | "Laboratory Equipment"
  | "Sterilization"
  | "Surgical & Theatre"
  | "Pharmaceutical Production"
  | "Dental Equipment"
  | "Hospital Furniture"
  | "Spare Parts & Accessories";

export const CATEGORIES: Category[] = [
  "Diagnostic Imaging",
  "Patient Monitoring",
  "Respiratory & ICU",
  "Laboratory Equipment",
  "Sterilization",
  "Surgical & Theatre",
  "Pharmaceutical Production",
  "Dental Equipment",
  "Hospital Furniture",
  "Spare Parts & Accessories",
];

export const EQUIPMENT_TYPES = [
  "Stationary system",
  "Portable",
  "Benchtop",
  "Floor-standing",
  "Mobile / trolley",
  "Wall / ceiling mounted",
  "Production machine",
  "Accessory / spare part",
] as const;

export const UNITS = ["Unit", "Set", "Piece", "Box", "Pack"] as const;

export const CONDITIONS = ["New", "Refurbished", "Demo unit"] as const;

export type Product = {
  id: string; // unique product ID e.g. BP-1001
  name: string;
  model: string;
  brand: string;
  category: Category;
  type: string; // equipment type
  specs: string; // key specifications / power rating
  origin: string; // country of origin
  supplier: string;
  lotNumber: string; // serial / shipment lot number of current stock
  quantity: number; // current quantity in stock
  unit: string;
  unitCost: number; // landed purchase cost per unit (ETB)
  sellingPrice: number; // default selling price per unit (ETB)
  reorderLevel: number;
  manufactureDate: string; // YYYY-MM-DD
  warrantyMonths: number;
  dateAdded: string; // YYYY-MM-DD
  location: string;
  condition: string;
  requiresInstallation: boolean;
  notes: string;
};

export type StockEntry = {
  id: string;
  productId: string;
  quantity: number;
  unitCost: number;
  date: string;
  lotNumber: string;
  supplier: string;
  note: string;
};

export const PAYMENT_METHODS = ["Bank Transfer", "Cheque", "Cash", "Letter of Credit", "Mobile Money"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type Payment = {
  id: string;
  date: string;
  amount: number;
  method: PaymentMethod;
  reference: string;
};

export type Sale = {
  id: string;
  invoiceNo: string;
  vatReceiptNo: string; // VAT receipt / fiscal reference number
  date: string;
  productId: string;
  productName: string; // snapshot
  quantity: number;
  unitPrice: number; // sold price per unit (excl. VAT)
  unitCost: number; // cost snapshot for profit
  discount: number; // ETB amount
  vatRate: number; // percent e.g. 15
  subtotal: number; // qty*unitPrice - discount
  vatAmount: number;
  total: number; // subtotal + VAT
  customerName: string;
  customerTin: string;
  customerPhone: string;
  salesPerson: string;
  dueDate: string; // when the remaining balance is due
  payments: Payment[];
  notes: string;
};

export type SaleStatus = "Paid" | "Partial" | "Unpaid";
