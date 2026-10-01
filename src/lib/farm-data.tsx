"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createEmptyFarmData } from "@/lib/demo-data";
import type {
  Budget,
  Category,
  Debt,
  DebtPayment,
  FarmData,
  FarmTransaction,
  FarmUser,
  Pen,
  Profile,
} from "@/lib/domain";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type TransactionInput = Omit<FarmTransaction, "id" | "user_id" | "created_at" | "deleted_at">;
type PenInput = Omit<Pen, "id" | "user_id" | "deleted_at">;
type CategoryInput = Pick<Category, "kind" | "name">;
type DebtInput = Pick<Debt, "kind" | "party_name" | "description" | "amount" | "due_date">;

type FarmContextValue = {
  data: FarmData;
  user: FarmUser | null;
  ready: boolean;
  mode: "local" | "supabase";
  error: string;
  addTransaction: (input: TransactionInput) => Promise<void>;
  updateTransaction: (id: string, input: TransactionInput) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  addCategory: (input: CategoryInput) => Promise<void>;
  updateCategory: (id: string, name: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  addPen: (input: PenInput) => Promise<void>;
  updatePen: (id: string, input: PenInput) => Promise<void>;
  deletePen: (id: string) => Promise<void>;
  addDebt: (input: DebtInput) => Promise<void>;
  addDebtPayment: (input: Omit<DebtPayment, "id" | "user_id">) => Promise<void>;
  addBudget: (input: Pick<Budget, "category_id" | "period_month" | "target_amount">) => Promise<void>;
  updateProfile: (input: Pick<Profile, "business_name" | "address" | "logo_path">) => Promise<void>;
  uploadAsset: (file: File, bucketFolder: "receipts" | "logos") => Promise<string>;
  getAssetUrl: (path: string | null) => Promise<string | null>;
  openAsset: (path: string) => Promise<void>;
  logout: () => Promise<void>;
};

const FarmContext = createContext<FarmContextValue | null>(null);

const createId = () => crypto.randomUUID();
const localUser: FarmUser = { id: "00000000-0000-4000-8000-000000000001", email: "lokal@marindofarm.id", businessName: "Marindo Farm" };

const mapRemoteData = (
  profile: Profile | null,
  categories: Category[] | null,
  pens: Pen[] | null,
  transactions: FarmTransaction[] | null,
  debts: Debt[] | null,
  debtPayments: DebtPayment[] | null,
  budgets: Budget[] | null,
  userId: string,
): FarmData => ({
  profile: profile ?? {
    id: userId,
    business_name: "Marindo Farm",
    address: "",
    logo_path: null,
    currency: "IDR",
  },
  categories: categories ?? [],
  pens: pens ?? [],
  transactions: transactions ?? [],
  debts: debts ?? [],
  debtPayments: debtPayments ?? [],
  budgets: budgets ?? [],
});

const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(new Error("Lampiran tidak dapat dibaca."));
  reader.readAsDataURL(file);
});

export function FarmDataProvider({ children }: { children: ReactNode }) {
  const [supabase] = useState(createSupabaseBrowserClient);
  const [data, setData] = useState<FarmData>(() => createEmptyFarmData());
  const [user, setUser] = useState<FarmUser | null>(null);
  const mode = isSupabaseConfigured ? "supabase" : "local";
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const client = supabase;
    let alive = true;

    if (!client) {
      const loadLocalDatabase = async () => {
        if (process.env.NODE_ENV === "production") {
          setError("Login online belum aktif. Hubungkan Supabase sebelum aplikasi dipublikasikan.");
          if (alive) setReady(true);
          return;
        }
        try {
          const response = await fetch("/api/local-data", { cache: "no-store" });
          if (!response.ok) throw new Error("Database SQLite tidak dapat dibuka.");
          setData(await response.json() as FarmData);
          setUser(localUser);
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "Database lokal tidak dapat dibuka.");
        }
        if (alive) setReady(true);
      };
      void loadLocalDatabase();
      return () => {
        alive = false;
      };
    }

    const loadSession = async () => {
      const { data: authData, error: authError } = await client.auth.getUser();
      if (!alive) return;
      if (authError || !authData.user) {
        setUser(null);
        setReady(true);
        return;
      }

      const authUser = authData.user;
      setUser({
        id: authUser.id,
        email: authUser.email ?? "",
        businessName: String(authUser.user_metadata.business_name ?? "Marindo Farm"),
      });

      const results = await Promise.all([
        client.from("profiles").select("*").maybeSingle(),
        client.from("categories").select("*").order("name"),
        client.from("pens").select("*").order("start_date", { ascending: false }),
      client.from("transactions").select("*").order("transaction_date", { ascending: false }),
        client.from("debts").select("*").order("due_date", { ascending: true }),
        client.from("debt_payments").select("*").order("payment_date", { ascending: false }),
        client.from("budgets").select("*").order("period_month", { ascending: false }),
      ]);

      if (!alive) return;
      const failed = results.find((result) => result.error);
      if (failed?.error) {
        setError("Data belum dapat dimuat. Periksa migration Supabase dan kebijakan RLS.");
      } else {
        setData(
          mapRemoteData(
            results[0].data as Profile | null,
            results[1].data as Category[] | null,
            results[2].data as Pen[] | null,
            results[3].data as FarmTransaction[] | null,
            results[4].data as Debt[] | null,
            results[5].data as DebtPayment[] | null,
            results[6].data as Budget[] | null,
            authUser.id,
          ),
        );
      }
      setReady(true);
    };

    void loadSession();
    const { data: authListener } = client.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setUser(null);
        return;
      }
      setUser({
        id: session.user.id,
        email: session.user.email ?? "",
        businessName: String(session.user.user_metadata.business_name ?? "Marindo Farm"),
      });
    });

    return () => {
      alive = false;
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  const commit = async (nextData: FarmData, writes: Array<() => Promise<void>>) => {
    if (mode === "local") {
      const response = await fetch("/api/local-data", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextData),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(result?.error ?? "Data belum berhasil disimpan ke database lokal.");
      }
      setData(nextData);
      return;
    }
    for (const write of writes) await write();
    setData(nextData);
  };

  const persist = async (table: string, row: Record<string, unknown>, id?: string) => {
    if (mode !== "supabase" || !supabase) return;
    const result = id
      ? await supabase.from(table).update(row).eq("id", id)
      : await supabase.from(table).insert(row);
    if (result.error) throw new Error(result.error.message);
  };

  const addTransaction = async (input: TransactionInput) => {
    if (!user) throw new Error("Sesi masuk tidak ditemukan.");
    const row: FarmTransaction = {
      ...input,
      id: createId(),
      user_id: user.id,
      created_at: new Date().toISOString(),
      deleted_at: null,
    };
    await commit({ ...data, transactions: [row, ...data.transactions] }, [() => persist("transactions", row as unknown as Record<string, unknown>)]);
  };

  const updateTransaction = async (id: string, input: TransactionInput) => {
    await commit({ ...data, transactions: data.transactions.map((item) => item.id === id ? { ...item, ...input } : item) }, [() => persist("transactions", input as unknown as Record<string, unknown>, id)]);
  };

  const deleteTransaction = async (id: string) => {
    const deletedAt = new Date().toISOString();
    await commit({ ...data, transactions: data.transactions.map((item) => item.id === id ? { ...item, deleted_at: deletedAt } : item) }, [() => persist("transactions", { deleted_at: deletedAt }, id)]);
  };

  const addCategory = async (input: CategoryInput) => {
    if (!user) throw new Error("Sesi masuk tidak ditemukan.");
    const row: Category = { ...input, id: createId(), user_id: user.id, is_default: false, deleted_at: null };
    await commit({ ...data, categories: [...data.categories, row] }, [() => persist("categories", row as unknown as Record<string, unknown>)]);
  };

  const updateCategory = async (id: string, name: string) => {
    await commit({ ...data, categories: data.categories.map((item) => item.id === id ? { ...item, name } : item) }, [() => persist("categories", { name }, id)]);
  };

  const deleteCategory = async (id: string) => {
    const deletedAt = new Date().toISOString();
    await commit({ ...data, categories: data.categories.map((item) => item.id === id ? { ...item, deleted_at: deletedAt } : item) }, [() => persist("categories", { deleted_at: deletedAt }, id)]);
  };

  const addPen = async (input: PenInput) => {
    if (!user) throw new Error("Sesi masuk tidak ditemukan.");
    const row: Pen = { ...input, id: createId(), user_id: user.id, deleted_at: null };
    await commit({ ...data, pens: [...data.pens, row] }, [() => persist("pens", row as unknown as Record<string, unknown>)]);
  };

  const updatePen = async (id: string, input: PenInput) => {
    await commit({ ...data, pens: data.pens.map((item) => item.id === id ? { ...item, ...input } : item) }, [() => persist("pens", input as unknown as Record<string, unknown>, id)]);
  };

  const deletePen = async (id: string) => {
    const deletedAt = new Date().toISOString();
    await commit({ ...data, pens: data.pens.map((item) => item.id === id ? { ...item, deleted_at: deletedAt } : item) }, [() => persist("pens", { deleted_at: deletedAt }, id)]);
  };

  const addDebt = async (input: DebtInput) => {
    if (!user) throw new Error("Sesi masuk tidak ditemukan.");
    const row: Debt = {
      ...input,
      id: createId(),
      user_id: user.id,
      amount: Number(input.amount),
      paid_amount: 0,
      status: "unpaid",
      created_at: new Date().toISOString(),
    };
    await commit({ ...data, debts: [row, ...data.debts] }, [() => persist("debts", row as unknown as Record<string, unknown>)]);
  };

  const addDebtPayment = async (input: Omit<DebtPayment, "id" | "user_id">) => {
    if (!user) throw new Error("Sesi masuk tidak ditemukan.");
    const row: DebtPayment = { ...input, id: createId(), user_id: user.id };
    const debt = data.debts.find((item) => item.id === input.debt_id);
    if (!debt) throw new Error("Catatan hutang/piutang tidak ditemukan.");
    const paidAmount = Math.min(debt.amount, debt.paid_amount + Number(input.amount));
    const updatedDebt = { ...debt, paid_amount: paidAmount, status: paidAmount >= debt.amount ? "paid" as const : "partial" as const };
    const category = data.categories.find((item) => item.kind === (debt.kind === "payable" ? "expense" : "income") && !item.deleted_at && item.name === "Lain-lain")
      ?? data.categories.find((item) => item.kind === (debt.kind === "payable" ? "expense" : "income") && !item.deleted_at);
    const cashTransaction: FarmTransaction | null = category ? {
      id: createId(), user_id: user.id, transaction_date: input.payment_date,
      kind: debt.kind === "payable" ? "expense" : "income", category_id: category.id,
      amount: Number(input.amount), description: `${debt.kind === "payable" ? "Pembayaran hutang" : "Penerimaan piutang"}: ${debt.party_name}`,
      payment_method: input.payment_method, pen_id: null, attachment_path: null, note: input.note,
      deleted_at: null, created_at: new Date().toISOString(),
    } : null;
    if (mode === "local" && !cashTransaction) throw new Error("Kategori transaksi tidak tersedia untuk mencatat pembayaran.");
    const paymentWrite = async () => {
      if (mode !== "supabase" || !supabase) return;
      const { data: result, error: writeError } = await supabase.rpc("record_debt_payment", {
        target_debt_id: input.debt_id,
        payment_date: input.payment_date,
        payment_amount: Number(input.amount),
        payment_method: input.payment_method,
        payment_note: input.note,
      });
      if (writeError) throw new Error(writeError.message);
      if (cashTransaction && result?.transaction_id) cashTransaction.id = String(result.transaction_id);
      if (result?.payment_id) row.id = String(result.payment_id);
    };
    await commit({
      ...data,
      debtPayments: [row, ...data.debtPayments],
      debts: data.debts.map((item) => item.id === debt.id ? updatedDebt : item),
      transactions: cashTransaction ? [cashTransaction, ...data.transactions] : data.transactions,
    }, [paymentWrite]);
  };

  const addBudget = async (input: Pick<Budget, "category_id" | "period_month" | "target_amount">) => {
    if (!user) throw new Error("Sesi masuk tidak ditemukan.");
    const existing = data.budgets.find((item) => item.category_id === input.category_id && item.period_month === input.period_month);
    if (existing) {
      await commit({ ...data, budgets: data.budgets.map((item) => item.id === existing.id ? { ...item, target_amount: input.target_amount } : item) }, [() => persist("budgets", { target_amount: input.target_amount }, existing.id)]);
      return;
    }
    const row: Budget = { ...input, id: createId(), user_id: user.id };
    const budgetWrite = async () => {
      if (mode !== "supabase" || !supabase) return;
      const result = await supabase.from("budgets").upsert(row, { onConflict: "user_id,category_id,period_month" });
      if (result.error) throw new Error(result.error.message);
    };
    await commit({ ...data, budgets: [...data.budgets, row] }, [budgetWrite]);
  };

  const updateProfile = async (input: Pick<Profile, "business_name" | "address" | "logo_path">) => {
    await commit({ ...data, profile: { ...data.profile, ...input } }, [() => persist("profiles", input as unknown as Record<string, unknown>, data.profile.id)]);
  };

  const uploadAsset = async (file: File, bucketFolder: "receipts" | "logos") => {
    if (!user) throw new Error("Sesi masuk tidak ditemukan.");
    if (file.size > 5 * 1024 * 1024) throw new Error("Ukuran file maksimal 5 MB.");
    if (!file.type.startsWith("image/")) throw new Error("Lampiran harus berupa gambar.");
    if (mode === "local") return fileToDataUrl(file);
    if (!supabase) throw new Error("Sesi Supabase belum tersedia untuk menyimpan lampiran.");

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${user.id}/${bucketFolder}/${createId()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("farm-assets").upload(path, file, { upsert: false });
    if (uploadError) throw new Error(uploadError.message);
    return path;
  };

  const getAssetUrl = async (path: string | null) => {
    if (!path) return null;
    if (path.startsWith("data:image/")) return path;
    if (!supabase) return null;
    const { data: asset, error: assetError } = await supabase.storage.from("farm-assets").createSignedUrl(path, 3600);
    if (assetError) return null;
    return asset.signedUrl;
  };

  const openAsset = async (path: string) => {
    if (path.startsWith("data:image/")) { window.open(path, "_blank", "noopener,noreferrer"); return; }
    if (!supabase) throw new Error("Sesi Supabase belum tersedia.");
    const { data: asset, error: assetError } = await supabase.storage.from("farm-assets").createSignedUrl(path, 60);
    if (assetError) throw new Error(assetError.message);
    window.open(asset.signedUrl, "_blank", "noopener,noreferrer");
  };

  const logout = async () => {
    if (supabase) {
      const { error: authError } = await supabase.auth.signOut();
      if (authError) throw new Error(authError.message);
    }
    setUser(null);
  };

  return (
    <FarmContext.Provider value={{
      data,
      user,
      ready,
      mode,
      error,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      addCategory,
      updateCategory,
      deleteCategory,
      addPen,
      updatePen,
      deletePen,
      addDebt,
      addDebtPayment,
      addBudget,
      updateProfile,
      uploadAsset,
      getAssetUrl,
      openAsset,
      logout,
    }}>
      {children}
    </FarmContext.Provider>
  );
}

export const useFarmData = () => {
  const context = useContext(FarmContext);
  if (!context) throw new Error("useFarmData harus digunakan di dalam FarmDataProvider.");
  return context;
};
