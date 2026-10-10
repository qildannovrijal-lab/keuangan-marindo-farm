"use client";

import { useState, type FormEvent } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Calculator,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  FileImage,
  FileSpreadsheet,
  FileText,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Wallet,
  Wheat,
  X,
} from "lucide-react";
import { useFarmData } from "@/lib/farm-data";
import { formatCurrency, formatDate, toDateInputValue } from "@/lib/format";
import type { FarmTransaction, PaymentMethod, TransactionKind } from "@/lib/domain";
import { transactionSchema } from "@/lib/validation";
import { downloadTransactionsExcel, downloadTransactionsPdf } from "@/lib/report-export";

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

const paymentNames: Record<PaymentMethod, string> = {
  cash: "Tunai",
  transfer: "Transfer",
  qris: "QRIS",
};
const pageSize = 10;

export default function TransactionsPage() {
  const { data, addTransaction, updateTransaction, deleteTransaction, uploadAsset, openAsset } =
    useFarmData();
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

  // Unit calculator helper inside modal
  const [useUnitCalc, setUseUnitCalc] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [unitType, setUnitType] = useState("kg");
  const [unitPrice, setUnitPrice] = useState("");

  const categories = data.categories.filter((item) => !item.deleted_at);
  const pens = data.pens.filter((item) => !item.deleted_at);
  const categoryLookup = new Map(data.categories.map((item) => [item.id, item.name]));
  const penLookup = new Map(data.pens.map((item) => [item.id, item.name]));

  const query = search.trim().toLowerCase();
  const filtered = data.transactions
    .filter((item) => {
      if (item.deleted_at) return false;
      if (
        query &&
        !`${item.description} ${item.note} ${categoryLookup.get(item.category_id) ?? ""}`
          .toLowerCase()
          .includes(query)
      ) {
        return false;
      }
      if (kindFilter !== "all" && item.kind !== kindFilter) return false;
      if (categoryFilter !== "all" && item.category_id !== categoryFilter) return false;
      if (penFilter !== "all" && item.pen_id !== penFilter) return false;
      if (dateFrom && item.transaction_date < dateFrom) return false;
      if (dateTo && item.transaction_date > dateTo) return false;
      return true;
    })
    .sort((a, b) => {
      if (sort === "oldest") return a.transaction_date.localeCompare(b.transaction_date);
      if (sort === "highest") return Number(b.amount) - Number(a.amount);
      return b.transaction_date.localeCompare(a.transaction_date);
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visibleRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const filteredIncome = filtered
    .filter((item) => item.kind === "income")
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const filteredExpense = filtered
    .filter((item) => item.kind === "expense")
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const filteredNet = filteredIncome - filteredExpense;

  const openCreate = () => {
    setEditing(null);
    setForm(blankForm());
    setReceipt(null);
    setFormError("");
    setUseUnitCalc(false);
    setQuantity("");
    setUnitPrice("");
    setModalOpen(true);
  };

  const openPreset = (presetKind: "panen_ayam" | "telur" | "pakan" | "obat" | "upah") => {
    setEditing(null);
    setReceipt(null);
    setFormError("");

    let kind: TransactionKind = "expense";
    let catName = "";
    let desc = "";
    let defaultUnit = "kg";

    if (presetKind === "panen_ayam") {
      kind = "income";
      catName = "Penjualan Ternak";
      desc = "Penjualan Ayam Panen";
      defaultUnit = "kg";
    } else if (presetKind === "telur") {
      kind = "income";
      catName = "Penjualan Telur";
      desc = "Penjualan Telur Segar";
      defaultUnit = "kg";
    } else if (presetKind === "pakan") {
      kind = "expense";
      catName = "Pakan";
      desc = "Pembelian Pakan Ternak";
      defaultUnit = "sak";
    } else if (presetKind === "obat") {
      kind = "expense";
      catName = "Obat dan Vitamin";
      desc = "Pembelian Obat & Vitamin Ternak";
      defaultUnit = "paket";
    } else if (presetKind === "upah") {
      kind = "expense";
      catName = "Tenaga Kerja";
      desc = "Upah Tenaga Kerja Kandang";
      defaultUnit = "hari";
    }

    const matchedCat = categories.find(
      (c) =>
        c.kind === kind &&
        c.name.toLowerCase().includes(catName.toLowerCase()),
    ) ?? categories.find((c) => c.kind === kind);

    setForm({
      ...blankForm(),
      kind,
      category_id: matchedCat?.id ?? "",
      description: desc,
    });
    setUseUnitCalc(true);
    setUnitType(defaultUnit);
    setQuantity("");
    setUnitPrice("");
    setModalOpen(true);
  };

  const handleUnitCalculation = (qtyVal: string, priceVal: string) => {
    const q = parseFloat(qtyVal) || 0;
    const p = parseFloat(priceVal) || 0;
    if (q > 0 && p > 0) {
      setForm((prev) => ({ ...prev, amount: String(Math.round(q * p)) }));
    }
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
    setUseUnitCalc(false);
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
      setFormError(parsed.error.issues[0]?.message ?? "Periksa isian formulir.");
      return;
    }

    setSaving(true);
    try {
      let attachmentPath = form.attachment_path;
      if (receipt) {
        attachmentPath = await uploadAsset(receipt, "receipts");
      }
      const payload = {
        ...parsed.data,
        amount: Number(parsed.data.amount),
        pen_id: parsed.data.pen_id ?? null,
        note: form.note || "",
        attachment_path: attachmentPath,
      };

      if (editing) {
        await updateTransaction(editing.id, payload);
      } else {
        await addTransaction(payload);
      }
      setModalOpen(false);
    } catch (caught) {
      setFormError(
        caught instanceof Error ? caught.message : "Transaksi belum dapat disimpan.",
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async (transaction: FarmTransaction) => {
    if (!window.confirm(`Hapus transaksi "${transaction.description}"? Data ini akan dipindahkan ke arsip.`)) {
      return;
    }
    try {
      await deleteTransaction(transaction.id);
    } catch (caught) {
      window.alert(caught instanceof Error ? caught.message : "Transaksi belum dapat dihapus.");
    }
  };

  const handleExportExcel = async () => {
    await downloadTransactionsExcel(
      data.profile.business_name,
      filtered,
      categoryLookup,
      penLookup,
    );
  };

  const handleExportPdf = () => {
    downloadTransactionsPdf(
      data.profile.business_name,
      filtered,
      categoryLookup,
      penLookup,
    );
  };

  return (
    <div className="module-page">
      <div className="page-intro module-intro">
        <div>
          <p className="eyebrow">BUKU KAS HARIAN</p>
          <h2>Catatan transaksi</h2>
          <p>Kelola seluruh pemasukan, biaya operasional, dan arus kas usaha Marindo Farm.</p>
        </div>
        <div className="intro-actions">
          <button
            type="button"
            className="secondary-button compact-button btn-export-excel"
            onClick={handleExportExcel}
            title="Unduh data terfilter ke format Excel"
          >
            <FileSpreadsheet size={16} />
            Ekspor Excel
          </button>
          <button
            type="button"
            className="secondary-button compact-button btn-export-pdf"
            onClick={handleExportPdf}
            title="Unduh data terfilter ke format PDF"
          >
            <FileText size={16} />
            Ekspor PDF
          </button>
          <button className="primary-button compact-button" onClick={openCreate}>
            <CirclePlus size={17} />
            Catat transaksi
          </button>
        </div>
      </div>

      {/* Quick Preset Buttons for Common Farm Transactions */}
      <div className="quick-presets-bar">
        <span className="preset-bar-title">
          <Sparkles size={14} className="text-forest" />
          Template Cepat:
        </span>
        <button
          type="button"
          className="preset-btn btn-panen"
          onClick={() => openPreset("panen_ayam")}
        >
          🐔 Penjualan Ayam
        </button>
        <button
          type="button"
          className="preset-btn btn-telur"
          onClick={() => openPreset("telur")}
        >
          🥚 Penjualan Telur
        </button>
        <button
          type="button"
          className="preset-btn btn-pakan"
          onClick={() => openPreset("pakan")}
        >
          🌾 Beli Pakan
        </button>
        <button
          type="button"
          className="preset-btn btn-obat"
          onClick={() => openPreset("obat")}
        >
          💊 Vaksin & Obat
        </button>
        <button
          type="button"
          className="preset-btn btn-upah"
          onClick={() => openPreset("upah")}
        >
          👷 Upah Harian
        </button>
      </div>

      {/* Filtered KPI Summary Bar */}
      <div className="transaction-kpi-row">
        <div className="trans-kpi-card kpi-income">
          <span className="trans-kpi-icon">
            <ArrowDownLeft size={16} />
          </span>
          <div>
            <small>Pemasukan (Terfilter)</small>
            <strong>{formatCurrency(filteredIncome)}</strong>
          </div>
        </div>
        <div className="trans-kpi-card kpi-expense">
          <span className="trans-kpi-icon">
            <ArrowUpRight size={16} />
          </span>
          <div>
            <small>Pengeluaran (Terfilter)</small>
            <strong>{formatCurrency(filteredExpense)}</strong>
          </div>
        </div>
        <div className="trans-kpi-card kpi-net">
          <span className="trans-kpi-icon">
            <Wallet size={16} />
          </span>
          <div>
            <small>Arus Kas Bersih</small>
            <strong className={filteredNet >= 0 ? "text-income" : "text-expense"}>
              {formatCurrency(filteredNet)}
            </strong>
          </div>
        </div>
      </div>

      {/* Filters and Search Toolbar */}
      <section className="panel transaction-panel">
        <div className="transaction-toolbar">
          <div className="search-wrap">
            <Search size={16} />
            <input
              placeholder="Cari transaksi, nota, atau keterangan..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
            {search && (
              <button
                type="button"
                className="quiet-icon"
                onClick={() => setSearch("")}
                aria-label="Hapus pencarian"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="filter-group">
            <select
              aria-label="Filter jenis transaksi"
              value={kindFilter}
              onChange={(event) => {
                setKindFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">Semua jenis</option>
              <option value="income">Hanya pemasukan</option>
              <option value="expense">Hanya pengeluaran</option>
            </select>
            <select
              aria-label="Filter kategori"
              value={categoryFilter}
              onChange={(event) => {
                setCategoryFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">Semua kategori</option>
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter kandang"
              value={penFilter}
              onChange={(event) => {
                setPenFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">Semua kandang</option>
              <option value="">Tanpa kandang (Umum)</option>
              {pens.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Urutkan transaksi"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="newest">Terbaru</option>
              <option value="oldest">Terlama</option>
              <option value="highest">Nominal terbesar</option>
            </select>
          </div>
        </div>

        <div className="date-filter-row">
          <span>
            <CalendarDays size={15} />
            Rentang tanggal:
          </span>
          <input
            aria-label="Tanggal dari"
            type="date"
            value={dateFrom}
            onChange={(event) => {
              setDateFrom(event.target.value);
              setPage(1);
            }}
          />
          <span>sampai</span>
          <input
            aria-label="Tanggal sampai"
            type="date"
            value={dateTo}
            onChange={(event) => {
              setDateTo(event.target.value);
              setPage(1);
            }}
          />
          {(dateFrom || dateTo) && (
            <button
              className="text-button"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
              }}
            >
              Hapus rentang
            </button>
          )}
        </div>

        <div className="table-scroll">
          <table className="data-table transactions-table">
            <thead>
              <tr>
                <th>Transaksi</th>
                <th>Tanggal</th>
                <th>Metode</th>
                <th>Kandang</th>
                <th className="align-right">Nominal</th>
                <th aria-label="Aksi" />
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((transaction) => (
                <tr key={transaction.id}>
                  <td>
                    <span
                      className={
                        transaction.kind === "income"
                          ? "table-icon table-icon-income"
                          : "table-icon table-icon-expense"
                      }
                    >
                      {transaction.kind === "income" ? (
                        <ArrowDownLeft size={16} />
                      ) : (
                        <ArrowUpRight size={16} />
                      )}
                    </span>
                    <span className="transaction-cell">
                      <strong>{transaction.description}</strong>
                      <small>
                        {categoryLookup.get(transaction.category_id) ?? "Lain-lain"}
                        {transaction.attachment_path && (
                          <button
                            className="text-button"
                            type="button"
                            onClick={() =>
                              void openAsset(transaction.attachment_path!).catch((caught) =>
                                window.alert(
                                  caught instanceof Error
                                    ? caught.message
                                    : "Lampiran belum dapat dibuka.",
                                ),
                              )
                            }
                            aria-label={`Buka lampiran ${transaction.description}`}
                            title="Buka lampiran"
                          >
                            <FileImage size={13} /> nota
                          </button>
                        )}
                      </small>
                    </span>
                  </td>
                  <td className="date-cell">{formatDate(transaction.transaction_date)}</td>
                  <td>
                    <span className="method-badge">
                      {paymentNames[transaction.payment_method]}
                    </span>
                  </td>
                  <td className="pen-cell">
                    {transaction.pen_id ? penLookup.get(transaction.pen_id) ?? "-" : "Umum"}
                  </td>
                  <td
                    className={
                      transaction.kind === "income"
                        ? "align-right amount-income"
                        : "align-right amount-expense"
                    }
                  >
                    {transaction.kind === "income" ? "+ " : "− "}
                    {formatCurrency(Number(transaction.amount))}
                  </td>
                  <td>
                    <span className="row-actions">
                      <button
                        className="row-action"
                        onClick={() => openEdit(transaction)}
                        aria-label={`Ubah ${transaction.description}`}
                        title="Ubah"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        className="row-action row-action-danger"
                        onClick={() => void remove(transaction)}
                        aria-label={`Hapus ${transaction.description}`}
                        title="Hapus"
                      >
                        <Trash2 size={15} />
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
              {!visibleRows.length && (
                <tr>
                  <td colSpan={6} className="empty-row">
                    <Search size={18} />
                    Tidak ada transaksi yang cocok dengan filter pencarian.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="pagination-row">
          <span>
            Menampilkan {filtered.length ? (page - 1) * pageSize + 1 : 0}–
            {Math.min(page * pageSize, filtered.length)} dari {filtered.length} transaksi
          </span>
          <div>
            <button
              className="pagination-button"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              aria-label="Halaman sebelumnya"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="page-number">
              {page} / {totalPages}
            </span>
            <button
              className="pagination-button"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              aria-label="Halaman selanjutnya"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* Modal Catat/Ubah Transaksi */}
      {modalOpen && (
        <div
          className="modal-scrim"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setModalOpen(false);
          }}
        >
          <section
            className="modal-card transaction-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="transaction-modal-title"
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">BUKU KAS MARINDO</p>
                <h2 id="transaction-modal-title">
                  {editing ? "Ubah transaksi" : "Catat transaksi"}
                </h2>
                <p>Isi data transaksi dengan teliti.</p>
              </div>
              <button
                className="icon-button modal-close"
                aria-label="Tutup"
                onClick={() => setModalOpen(false)}
              >
                <X size={19} />
              </button>
            </div>

            <form className="modal-form" onSubmit={submit}>
              <div className="segmented-control" role="group" aria-label="Jenis transaksi">
                <button
                  type="button"
                  className={form.kind === "income" ? "segment-active segment-income" : ""}
                  onClick={() =>
                    setForm((current) => ({ ...current, kind: "income", category_id: "" }))
                  }
                >
                  <ArrowDownLeft size={16} />
                  Pemasukan
                </button>
                <button
                  type="button"
                  className={form.kind === "expense" ? "segment-active segment-expense" : ""}
                  onClick={() =>
                    setForm((current) => ({ ...current, kind: "expense", category_id: "" }))
                  }
                >
                  <ArrowUpRight size={16} />
                  Pengeluaran
                </button>
              </div>

              {/* Quantity x Price Calculator Toggle */}
              <div className="unit-calc-box">
                <label className="checkbox-toggle">
                  <input
                    type="checkbox"
                    checked={useUnitCalc}
                    onChange={(e) => setUseUnitCalc(e.target.checked)}
                  />
                  <span>
                    <Calculator size={14} /> Hitung otomatis dari Kuantitas × Harga Satuan
                  </span>
                </label>

                {useUnitCalc && (
                  <div className="unit-calc-grid">
                    <label className="field-compact">
                      Kuantitas
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="Contoh: 50"
                        value={quantity}
                        onChange={(e) => {
                          setQuantity(e.target.value);
                          handleUnitCalculation(e.target.value, unitPrice);
                        }}
                      />
                    </label>
                    <label className="field-compact">
                      Satuan
                      <select
                        value={unitType}
                        onChange={(e) => setUnitType(e.target.value)}
                      >
                        <option value="kg">kg (Kilogram)</option>
                        <option value="ekor">ekor</option>
                        <option value="sak">sak (Karung)</option>
                        <option value="butir">butir</option>
                        <option value="hari">hari (HOK)</option>
                        <option value="paket">paket</option>
                        <option value="liter">liter</option>
                      </select>
                    </label>
                    <label className="field-compact">
                      Harga per Satuan (Rp)
                      <input
                        type="number"
                        min="0"
                        placeholder="Contoh: 21500"
                        value={unitPrice}
                        onChange={(e) => {
                          setUnitPrice(e.target.value);
                          handleUnitCalculation(quantity, e.target.value);
                        }}
                      />
                    </label>
                  </div>
                )}
              </div>

              <div className="form-grid">
                <label className="field-label">
                  Tanggal
                  <input
                    required
                    type="date"
                    value={form.transaction_date}
                    onChange={(event) =>
                      setForm({ ...form, transaction_date: event.target.value })
                    }
                  />
                </label>
                <label className="field-label">
                  Nominal Total (Rp)
                  <input
                    required
                    min="1"
                    type="number"
                    inputMode="numeric"
                    value={form.amount}
                    onChange={(event) => setForm({ ...form, amount: event.target.value })}
                    placeholder="Contoh: 250000"
                  />
                </label>
                <label className="field-label form-span">
                  Deskripsi Transaksi
                  <input
                    required
                    maxLength={180}
                    value={form.description}
                    onChange={(event) =>
                      setForm({ ...form, description: event.target.value })
                    }
                    placeholder="Contoh: Pembelian pakan konsentrat 10 sak"
                  />
                </label>
                <label className="field-label">
                  Kategori
                  <select
                    required
                    value={form.category_id}
                    onChange={(event) =>
                      setForm({ ...form, category_id: event.target.value })
                    }
                  >
                    <option value="">Pilih kategori</option>
                    {categories
                      .filter((item) => item.kind === form.kind)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="field-label">
                  Metode pembayaran
                  <select
                    value={form.payment_method}
                    onChange={(event) =>
                      setForm({ ...form, payment_method: event.target.value as PaymentMethod })
                    }
                  >
                    <option value="cash">Tunai</option>
                    <option value="transfer">Transfer Bank</option>
                    <option value="qris">QRIS</option>
                  </select>
                </label>
                <label className="field-label form-span">
                  Kandang / kelompok ternak <span className="optional-label">Opsional</span>
                  <select
                    value={form.pen_id}
                    onChange={(event) => setForm({ ...form, pen_id: event.target.value })}
                  >
                    <option value="">Transaksi umum (Tanpa kandang)</option>
                    {pens.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} • {item.livestock_type} ({item.head_count} ekor)
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field-label form-span">
                  Lampiran foto nota / bukti transfer{" "}
                  <span className="optional-label">Opsional, maks. 5 MB</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => setReceipt(event.target.files?.[0] ?? null)}
                  />
                </label>
                <label className="field-label form-span">
                  Catatan tambahan
                  <textarea
                    rows={2}
                    maxLength={500}
                    value={form.note}
                    onChange={(event) => setForm({ ...form, note: event.target.value })}
                    placeholder="Catatan nomor faktur, suplier, atau detail lainnya..."
                  />
                </label>
              </div>

              {formError && (
                <p className="form-alert error-alert" role="alert">
                  {formError}
                </p>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setModalOpen(false)}
                >
                  Batal
                </button>
                <button className="primary-button" type="submit" disabled={saving}>
                  <Check size={16} />
                  {saving
                    ? "Menyimpan..."
                    : editing
                      ? "Simpan perubahan"
                      : "Simpan transaksi"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
