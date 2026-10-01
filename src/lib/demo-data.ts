import type { FarmData } from "@/lib/domain";

const demoUserId = "00000000-0000-4000-8000-000000000001";
const id = (number: number) => `10000000-0000-4000-8000-${String(number).padStart(12, "0")}`;

export const createEmptyFarmData = (): FarmData => ({
  profile: {
    id: "",
    business_name: "Marindo Farm",
    address: "",
    logo_path: null,
    currency: "IDR",
  },
  categories: [],
  pens: [],
  transactions: [],
  debts: [],
  debtPayments: [],
  budgets: [],
});

export const createDemoFarmData = (): FarmData => {
  const today = new Date();
  const date = (monthOffset: number, day: number) => {
    const value = new Date(today.getFullYear(), today.getMonth() + monthOffset, day);
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  };
  const categories = [
    ["income", "Penjualan Ternak"], ["income", "Penjualan Telur/Susu/Daging"], ["income", "Penjualan Pupuk Kandang"], ["income", "Lain-lain"],
    ["expense", "Pembelian Bibit/Bakalan"], ["expense", "Pakan"], ["expense", "Obat dan Vitamin"], ["expense", "Vaksinasi"], ["expense", "Tenaga Kerja"], ["expense", "Listrik dan Air"], ["expense", "Perawatan Kandang"], ["expense", "Transportasi"], ["expense", "Peralatan"], ["expense", "Lain-lain"],
  ].map(([kind, name], index) => ({ id: id(index + 1), user_id: demoUserId, kind: kind as "income" | "expense", name, is_default: true, deleted_at: null }));
  const pens = [
    { id: id(30), user_id: demoUserId, name: "Kandang Broiler A", livestock_type: "Ayam broiler", head_count: 850, start_date: date(-2, 3), deleted_at: null },
    { id: id(31), user_id: demoUserId, name: "Kandang Layer B", livestock_type: "Ayam petelur", head_count: 420, start_date: date(-5, 12), deleted_at: null },
    { id: id(32), user_id: demoUserId, name: "Kelompok Kambing", livestock_type: "Kambing", head_count: 36, start_date: date(-8, 20), deleted_at: null },
  ];
  const specs: [number, number, number, number, string, number | null][] = [
    [-2, 5, 4, 1_250_000, "Pembelian bibit broiler", 0], [-2, 7, 6, 2_450_000, "Pakan broiler", 0], [-2, 17, 0, 5_600_000, "Penjualan telur", 1],
    [-1, 2, 5, 1_150_000, "Upah pekerja kandang", 0], [-1, 6, 7, 340_000, "Vaksin dan vitamin", 0], [-1, 20, 0, 7_250_000, "Penjualan ayam panen", 0],
    [0, 2, 5, 1_200_000, "Upah pekerja kandang", 0], [0, 4, 6, 2_700_000, "Pakan dan konsentrat", 0], [0, 6, 7, 485_000, "Obat dan vitamin ternak", 2],
    [0, 8, 9, 310_000, "Listrik dan air kandang", 0], [0, 10, 8, 1_050_000, "Perawatan pagar kandang", 2], [0, 12, 1, 4_850_000, "Penjualan telur segar", 1],
  ];
  const transactions = specs.map(([month, day, category, amount, description, pen], index) => ({
    id: id(100 + index), user_id: demoUserId, transaction_date: date(month, day), kind: category < 4 ? "income" as const : "expense" as const,
    category_id: id(category + 1), amount, description, payment_method: index % 3 === 0 ? "cash" as const : "transfer" as const,
    pen_id: pen === null ? null : pens[pen].id, attachment_path: null, note: "", deleted_at: null,
    created_at: `${date(month, day)}T09:00:00.000Z`,
  }));
  return {
    profile: { id: demoUserId, business_name: "Marindo Farm", address: "", logo_path: null, currency: "IDR" },
    categories,
    pens,
    transactions,
    debts: [],
    debtPayments: [],
    budgets: [
      { id: id(200), user_id: demoUserId, category_id: id(6), period_month: date(0, 1), target_amount: 5_000_000 },
      { id: id(201), user_id: demoUserId, category_id: id(7), period_month: date(0, 1), target_amount: 1_000_000 },
    ],
  };
};

export const createLocalFarmData = (): FarmData => {
  const data = createEmptyFarmData();
  const userId = "00000000-0000-4000-8000-000000000001";
  data.profile.id = userId;
  data.categories = [
    ["income", "Penjualan Ternak"], ["income", "Penjualan Telur/Susu/Daging"], ["income", "Penjualan Pupuk Kandang"], ["income", "Lain-lain"],
    ["expense", "Pembelian Bibit/Bakalan"], ["expense", "Pakan"], ["expense", "Obat dan Vitamin"], ["expense", "Vaksinasi"], ["expense", "Tenaga Kerja"], ["expense", "Listrik dan Air"], ["expense", "Perawatan Kandang"], ["expense", "Transportasi"], ["expense", "Peralatan"], ["expense", "Lain-lain"],
  ].map(([kind, name], index) => ({
    id: id(index + 1), user_id: userId, kind: kind as "income" | "expense", name,
    is_default: true, deleted_at: null,
  }));
  return data;
};
