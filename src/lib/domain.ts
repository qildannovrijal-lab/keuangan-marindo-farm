export type TransactionKind = "income" | "expense";
export type PaymentMethod = "cash" | "transfer" | "qris";
export type DebtKind = "payable" | "receivable";
export type DebtStatus = "unpaid" | "partial" | "paid";

export type Profile = {
  id: string;
  business_name: string;
  address: string;
  logo_path: string | null;
  currency: "IDR";
};

export type Category = {
  id: string;
  user_id: string;
  kind: TransactionKind;
  name: string;
  is_default: boolean;
  deleted_at: string | null;
};

export type Pen = {
  id: string;
  user_id: string;
  name: string;
  livestock_type: string;
  head_count: number;
  start_date: string;
  deleted_at: string | null;
};

export type FarmTransaction = {
  id: string;
  user_id: string;
  transaction_date: string;
  kind: TransactionKind;
  category_id: string;
  amount: number;
  description: string;
  payment_method: PaymentMethod;
  pen_id: string | null;
  attachment_path: string | null;
  note: string;
  deleted_at: string | null;
  created_at: string;
};

export type Debt = {
  id: string;
  user_id: string;
  kind: DebtKind;
  party_name: string;
  description: string;
  amount: number;
  paid_amount: number;
  due_date: string | null;
  status: DebtStatus;
  created_at: string;
};

export type DebtPayment = {
  id: string;
  user_id: string;
  debt_id: string;
  payment_date: string;
  amount: number;
  payment_method: PaymentMethod;
  note: string;
};

export type Budget = {
  id: string;
  user_id: string;
  category_id: string;
  period_month: string;
  target_amount: number;
};

export type FarmData = {
  profile: Profile;
  categories: Category[];
  pens: Pen[];
  transactions: FarmTransaction[];
  debts: Debt[];
  debtPayments: DebtPayment[];
  budgets: Budget[];
};

export type FarmUser = {
  id: string;
  email: string;
  businessName: string;
};