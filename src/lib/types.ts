export type Role = 'ADMIN' | 'STAFF';
export type Payment = 'CASH' | 'UPI' | 'CARD';
export type Profile = {
  id: string;
  display_name: string;
  email: string;
  role: Role;
  active: boolean;
};
export type Product = { id: string; name: string; pricePaise: string; unitLabel: string };
export type Category = { id: string; name: string; groupType: string; products: Product[] };
export type CartLine = Product & { quantity: number };
export type BillInput = {
  idempotencyKey: string;
  paymentMethod: Payment;
  items: { productId: string; quantity: number }[];
};
export type Bill = {
  id: string;
  billNumber: string;
  status: 'COMPLETED' | 'VOID';
  paymentMethod: Payment;
  subtotalPaise: string;
  totalPaise: string;
  createdAt: string;
  createdBy: string;
  operatorName: string;
  voidReason: string | null;
  voidedAt: string | null;
  businessName: string;
  receiptFooter: string;
  items: {
    productId: string;
    productName: string;
    unitLabel: string;
    unitPricePaise: string;
    quantity: number;
    lineTotalPaise: string;
  }[];
};
export type Report = {
  date: string;
  completedBills: number;
  completedSalesPaise: string;
  paymentBreakdown: Record<Payment, string>;
  voidCount: number;
  voidedAmountPaise: string;
  topItems: { productName: string; quantity: number; salesPaise: string }[];
};
export type AdminProduct = {
  id: string;
  category_id: string;
  name: string;
  price_paise: string | null;
  unit_label: string;
  active: boolean;
  needs_confirmation: boolean;
  sort_order: number;
  source_notes: string;
};
export type AdminCategory = {
  id: string;
  name: string;
  group_type: string;
  sort_order: number;
  active: boolean;
};
