"use client";

import { useState, type FormEvent } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  FileImage,
  Pencil,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { useFarmData } from "@/lib/farm-data";
import { formatCurrency, formatDate, toDateInputValue } from "@/lib/format";
import type { FarmTransaction, PaymentMethod, TransactionKind } from "@/lib/domain";
import { transactionSchema } from "@/lib/validation";

type FormState = {
  transaction_date: string;
  kind: TransactionKind;
  category_id: string;
  amount: string;
  description: string;
  payment_method: PaymentMethod;
  pen_id: string;
  note: string;
  attachment_path: string | null;
};

const blankForm = (): FormState => ({
  transaction_date: toDateInputValue(new Date()),
  kind: "expense",
  category_id: "",
  amount: "",
  description: "",
  payment_method: "transfer",
  pen_id: "",
  note: "",
  attachment_path: null,
});

const paymentNames: Record<PaymentMethod, string> = { cash: "Tunai", transfer: "Transfer", qris: "QRIS" };
const pageSize = 8;

export default function TransactionsPage() {
  const { data, addTransaction, updateTransaction, deleteTransaction, uploadAsset, openAsset } = useFarmData();
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [penFilter, setPenFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FarmTransaction | null>(null);
  const [form, setForm] = useState<FormState>(blankForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState<File | null>(null);

  const categories = data.categories.filter((item) => !item.deleted_at);
  const pens = data.pens.filter((item) => !item.deleted_at);
  const categoryLookup = new Map(data.categories.map((item) => [item.id, item.name]));
  const penLookup = new Map(data.pens.map((item) => [item.id, item.name]));

  const query = search.trim().toLowerCase();
  const filtered = data.transactions.filter((item) => {
    if (item.deleted_at) return false;
    if (query && !`${item.description} ${item.note} ${categoryLookup.get(item.category_id) ?? ""}`.toLowerCase().includes(query)) return false;
    if (kindFilter !== "all" && item.kind !== kindFilter) return false;
    if (categoryFilter !== "all" && item.category_id !== categoryFilter) return false;
    if (penFilter !== "all" && item.pen_id !== penFilter) return false;
    if (dateFrom && item.transaction_date < dateFrom) return false;
    if (dateTo && item.transaction_date > dateTo) return false;
    return true;
  }).sort((a, b) => {
    if (sort === "oldest") return a.transaction_date.localeCompare(b.transaction_date);
    if (sort === "highest") return Number(b.amount) - Number(a.amount);
    return b.transaction_date.localeCompare(a.transaction_date);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visibleRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const filteredIncome = filtered.filter((item) => item.kind === "income").reduce((sum, item) => sum + Number(item.amount), 0);
  const filteredExpense = filtered.filter((item) => item.kind === "expense").reduce((sum, item) => sum + Number(item.amount), 0);

  const openCreate = () => {
    setEditing(null);
    setForm(blankForm());
    setReceipt(null);
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (transaction: FarmTransaction) => {
    setEditing(transaction);
    setForm({
      transaction_date: transaction.transaction_date,
      kind: transaction.kind,
      category_id: transaction.category_id,
      amount: String(transaction.amount),
      description: transaction.description,
      payment_method: transaction.payment_method,
      pen_id: transaction.pen_id ?? "",
      note: transaction.note,
      attachment_path: transaction.attachment_path,
    });
    setReceipt(null);
    setFormError("");
    setModalOpen(true);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    const parsed = transactionSchema.safeParse({
      ...form,
      amount: form.amount,
      pen_id: form.pen_id || null,
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Periksa kembali data transaksi.");
      return;
    }

    setSaving(true);
    try {
      const attachmentPath = receipt ? await uploadAsset(receipt, "receipts") : form.attachment_path;
      const input = {
        ...parsed.data,
        amount: Number(parsed.data.amount),
        pen_id: parsed.data.pen_id || null,
        attachment_path: attachmentPath,
        note: parsed.data.note ?? "",
      };
      if (editing) await updateTransaction(editing.id, input);
      else await addTransaction(input);
      setModalOpen(false);
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Transaksi belum dapat disimpan.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (transaction: FarmTransaction) => {
    const confirmed = window.confirm(`Hapus transaksi “${transaction.description}”? Data akan disembunyikan dari laporan, tetapi tidak dihapus permanen.`);
    if (!confirmed) return;
    try {
      await deleteTransaction(transaction.id);
    } catch (caught) {
      window.alert(caught instanceof Error ? caught.message : "Transaksi belum dapat dihapus.");
    }
  };

  return (
    <div className="module-page">
      <div className="page-intro module-intro">
        <div><p className="eyebrow">BUKU KAS</p><h2>Semua transaksi</h2><p>Catat uang masuk dan keluar dari setiap kandang.</p></div>
        <button className="primary-button compact-button" onClick={openCreate}><CirclePlus size={17} />Catat transaksi</button>
      </div>

      <section className="transaction-overview">
        <div><span className="overview-label"><ArrowDownLeft size={15} />Pemasukan terfilter</span><strong className="overview-income">{formatCurrency(filteredIncome)}</strong></div>
        <div><span className="overview-label"><ArrowUpRight size={15} />Pengeluaran terfilter</span><strong className="overview-expense">{formatCurrency(filteredExpense)}</strong></div>
        <div><span className="overview-label"><SlidersHorizontal size={15} />Transaksi ditemukan</span><strong>{filtered.length} <small>catatan</small></strong></div>
      </section>

      <section className="panel transaction-list-panel">
        <div className="filter-toolbar">
          <label className="search-field"><Search size={17} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Cari deskripsi atau kategori..." aria-label="Cari transaksi" /></label>
          <div className="filter-controls">
            <select aria-label="Filter jenis transaksi" value={kindFilter} onChange={(event) => { setKindFilter(event.target.value); setPage(1); }}><option value="all">Semua jenis</option><option value="income">Pemasukan</option><option value="expense">Pengeluaran</option></select>
            <select aria-label="Filter kategori" value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setPage(1); }}><option value="all">Semua kategori</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
            <select aria-label="Filter kandang" value={penFilter} onChange={(event) => { setPenFilter(event.target.value); setPage(1); }}><option value="all">Semua kandang</option><option value="">Tanpa kandang</option>{pens.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
            <select aria-label="Urutkan transaksi" value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Terbaru</option><option value="oldest">Terlama</option><option value="highest">Nominal terbesar</option></select>
          </div>
        </div>
        <div className="date-filter-row"><span><CalendarDays size={15} />Rentang tanggal</span><input aria-label="Tanggal dari" type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} /><span>sampai</span><input aria-label="Tanggal sampai" type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} />{(dateFrom || dateTo) && <button className="text-button" onClick={() => { setDateFrom(""); setDateTo(""); }}>Hapus rentang</button>}</div>
        <div className="table-scroll"><table className="data-table transactions-table"><thead><tr><th>Transaksi</th><th>Tanggal</th><th>Metode</th><th>Kandang</th><th className="align-right">Nominal</th><th aria-label="Aksi" /></tr></thead><tbody>
          {visibleRows.map((transaction) => <tr key={transaction.id}><td><span className={transaction.kind === "income" ? "table-icon table-icon-income" : "table-icon table-icon-expense"}>{transaction.kind === "income" ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</span><span className="transaction-cell"><strong>{transaction.description}</strong><small>{categoryLookup.get(transaction.category_id) ?? "Lain-lain"}{transaction.attachment_path && <button className="text-button" type="button" onClick={() => void openAsset(transaction.attachment_path!).catch((caught) => window.alert(caught instanceof Error ? caught.message : "Lampiran belum dapat dibuka."))} aria-label={`Buka lampiran ${transaction.description}`} title="Buka lampiran"><FileImage size={13} /> nota</button>}</small></span></td><td className="date-cell">{formatDate(transaction.transaction_date)}</td><td><span className="method-badge">{paymentNames[transaction.payment_method]}</span></td><td className="pen-cell">{transaction.pen_id ? penLookup.get(transaction.pen_id) ?? "-" : "Umum"}</td><td className={transaction.kind === "income" ? "align-right amount-income" : "align-right amount-expense"}>{transaction.kind === "income" ? "+ " : "− "}{formatCurrency(Number(transaction.amount))}</td><td><span className="row-actions"><button className="row-action" onClick={() => openEdit(transaction)} aria-label={`Ubah ${transaction.description}`} title="Ubah"><Pencil size={15} /></button><button className="row-action row-action-danger" onClick={() => void remove(transaction)} aria-label={`Hapus ${transaction.description}`} title="Hapus"><Trash2 size={15} /></button></span></td></tr>)}
          {!visibleRows.length && <tr><td colSpan={6} className="empty-row"><Search size={18} />Tidak ada transaksi yang cocok dengan filter.</td></tr>}
        </tbody></table></div>
        <div className="pagination-row"><span>Menampilkan {filtered.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filtered.length)} dari {filtered.length} transaksi</span><div><button className="pagination-button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} aria-label="Halaman sebelumnya"><ChevronLeft size={16} /></button><span className="page-number">{page} / {totalPages}</span><button className="pagination-button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} aria-label="Halaman selanjutnya"><ChevronRight size={16} /></button></div></div>
      </section>

      {modalOpen && <div className="modal-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false); }}><section className="modal-card transaction-modal" role="dialog" aria-modal="true" aria-labelledby="transaction-modal-title">
        <div className="modal-heading"><div><p className="eyebrow">BUKU KAS MARINDO</p><h2 id="transaction-modal-title">{editing ? "Ubah transaksi" : "Catat transaksi"}</h2><p>Isi data transaksi dengan teliti.</p></div><button className="icon-button modal-close" aria-label="Tutup" onClick={() => setModalOpen(false)}><X size={19} /></button></div>
        <form className="modal-form" onSubmit={submit}>
          <div className="segmented-control" role="group" aria-label="Jenis transaksi"><button type="button" className={form.kind === "income" ? "segment-active segment-income" : ""} onClick={() => setForm((current) => ({ ...current, kind: "income", category_id: "" }))}><ArrowDownLeft size={16} />Pemasukan</button><button type="button" className={form.kind === "expense" ? "segment-active segment-expense" : ""} onClick={() => setForm((current) => ({ ...current, kind: "expense", category_id: "" }))}><ArrowUpRight size={16} />Pengeluaran</button></div>
          <div className="form-grid">
            <label className="field-label">Tanggal<input required type="date" value={form.transaction_date} onChange={(event) => setForm({ ...form, transaction_date: event.target.value })} /></label>
            <label className="field-label">Nominal (Rp)<input required min="1" type="number" inputMode="numeric" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="Contoh: 250000" /></label>
            <label className="field-label form-span">Deskripsi<input required maxLength={180} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Contoh: Pembelian pakan 10 karung" /></label>
            <label className="field-label">Kategori<select required value={form.category_id} onChange={(event) => setForm({ ...form, category_id: event.target.value })}><option value="">Pilih kategori</option>{categories.filter((item) => item.kind === form.kind).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="field-label">Metode pembayaran<select value={form.payment_method} onChange={(event) => setForm({ ...form, payment_method: event.target.value as PaymentMethod })}><option value="cash">Tunai</option><option value="transfer">Transfer</option><option value="qris">QRIS</option></select></label>
            <label className="field-label form-span">Kandang / kelompok ternak <span className="optional-label">Opsional</span><select value={form.pen_id} onChange={(event) => setForm({ ...form, pen_id: event.target.value })}><option value="">Transaksi umum</option>{pens.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.livestock_type}</option>)}</select></label>
            <label className="field-label form-span">Lampiran foto nota <span className="optional-label">Opsional, maks. 5 MB</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setReceipt(event.target.files?.[0] ?? null)} /></label>
            <label className="field-label form-span">Catatan<textarea rows={2} maxLength={500} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Catatan tambahan" /></label>
          </div>
          {formError && <p className="form-alert error-alert" role="alert">{formError}</p>}
          <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setModalOpen(false)}>Batal</button><button className="primary-button" type="submit" disabled={saving}><Check size={16} />{saving ? "Menyimpan..." : editing ? "Simpan perubahan" : "Simpan transaksi"}</button></div>
        </form>
      </section></div>}
    </div>
  );
}
