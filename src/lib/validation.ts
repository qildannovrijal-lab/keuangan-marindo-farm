import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Masukkan email yang valid."),
  password: z.string().min(8, "Kata sandi minimal 8 karakter."),
});

export const signUpSchema = loginSchema.extend({
  businessName: z.string().trim().min(2, "Nama usaha minimal 2 karakter."),
  password: z.string().min(8, "Kata sandi minimal 8 karakter."),
});

export const transactionSchema = z.object({
  transaction_date: z.string().min(1, "Tanggal wajib diisi."),
  kind: z.enum(["income", "expense"]),
  category_id: z.string().uuid("Pilih kategori."),
  amount: z.coerce.number().positive("Nominal harus lebih besar dari nol."),
  description: z.string().trim().min(1, "Deskripsi wajib diisi."),
  payment_method: z.enum(["cash", "transfer", "qris"]),
  pen_id: z.string().uuid().nullable().optional(),
  note: z.string().max(500, "Catatan maksimal 500 karakter.").optional(),
});

export const penSchema = z.object({
  name: z.string().trim().min(2, "Nama kandang minimal 2 karakter."),
  livestock_type: z.string().trim().min(2, "Jenis ternak wajib diisi."),
  head_count: z.coerce.number().int().min(0, "Jumlah ekor tidak boleh negatif."),
  start_date: z.string().min(1, "Tanggal mulai wajib diisi."),
});

export const categorySchema = z.object({
  kind: z.enum(["income", "expense"]),
  name: z.string().trim().min(2, "Nama kategori minimal 2 karakter.").max(80, "Nama kategori maksimal 80 karakter."),
});

export const debtSchema = z.object({
  kind: z.enum(["payable", "receivable"]),
  party_name: z.string().trim().min(2, "Nama pemasok atau pembeli wajib diisi.").max(120),
  description: z.string().trim().min(2, "Keterangan wajib diisi.").max(180),
  amount: z.coerce.number().positive("Nominal harus lebih besar dari nol."),
  due_date: z.string().nullable(),
});

export const debtPaymentSchema = z.object({
  payment_date: z.string().min(1, "Tanggal pembayaran wajib diisi."),
  amount: z.coerce.number().positive("Nominal harus lebih besar dari nol."),
  payment_method: z.enum(["cash", "transfer", "qris"]),
  note: z.string().max(180, "Catatan maksimal 180 karakter.").optional(),
});

export const budgetSchema = z.object({
  category_id: z.string().uuid("Pilih kategori pengeluaran."),
  period_month: z.string().regex(/^\d{4}-\d{2}-01$/, "Pilih bulan anggaran yang valid."),
  target_amount: z.coerce.number().positive("Target harus lebih besar dari nol."),
});

export const profileSchema = z.object({
  business_name: z.string().trim().min(2, "Nama usaha minimal 2 karakter.").max(120),
  address: z.string().max(240, "Alamat maksimal 240 karakter."),
  currency: z.literal("IDR"),
});