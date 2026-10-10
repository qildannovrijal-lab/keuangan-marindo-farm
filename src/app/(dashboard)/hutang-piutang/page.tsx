"use client";

import { useState, type FormEvent } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  CirclePlus,
  Clock3,
  Download,
  HandCoins,
  History,
  Printer,
  Search,
  WalletCards,
  X,
} from "lucide-react";
import { useFarmData } from "@/lib/farm-data";
import { formatCurrency, formatDate, toDateInputValue } from "@/lib/format";
import type { Debt, DebtKind, DebtPayment, PaymentMethod } from "@/lib/domain";
import { debtPaymentSchema, debtSchema } from "@/lib/validation";
import { downloadDebtReceiptPdf } from "@/lib/report-export";

type DebtFilter = "all" | "payable" | "receivable";
type StatusFilter = "all" | "unpaid" | "partial" | "paid";

type DebtForm = {
  kind: DebtKind;
  party_name: string;
  description: string;
  amount: string;
  due_date: string;
};

type PaymentForm = {
  payment_date: string;
  amount: string;
  payment_method: PaymentMethod;
  note: string;
};

const blankDebtForm = (): DebtForm => ({
  kind: "payable",
  party_name: "",
  description: "",
  amount: "",
  due_date: "",
});

const blankPaymentForm = (): PaymentForm => ({
  payment_date: toDateInputValue(new Date()),
  amount: "",
  payment_method: "transfer",
  note: "",
});

const paymentLabels: Record<PaymentMethod, string> = {
  cash: "Tunai",
  transfer: "Transfer",
  qris: "QRIS",
};

export default function DebtsPage() {
  const { data, addDebt, addDebtPayment } = useFarmData();
  const [filter, setFilter] = useState<DebtFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [debtModalOpen, setDebtModalOpen] = useState(false);
  const [paymentDebt, setPaymentDebt] = useState<Debt | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [debtForm, setDebtForm] = useState<DebtForm>(blankDebtForm);
  const [paymentForm, setPaymentForm] = useState<PaymentForm>(blankPaymentForm);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const today = toDateInputValue(new Date());
  const activeDebts = data.debts;

  const totalPayable = activeDebts
    .filter((item) => item.kind === "payable" && item.status !== "paid")
    .reduce((sum, item) => sum + Math.max(0, Number(item.amount) - Number(item.paid_amount)), 0);

  const totalReceivable = activeDebts
    .filter((item) => item.kind === "receivable" && item.status !== "paid")
    .reduce((sum, item) => sum + Math.max(0, Number(item.amount) - Number(item.paid_amount)), 0);

  const overdueDebts = activeDebts.filter(
    (item) => item.status !== "paid" && item.due_date && item.due_date < today,
  );
  const overdueIds = new Set(overdueDebts.map((item) => item.id));

  const query = search.trim().toLowerCase();
  const visibleDebts = activeDebts
    .filter((item) => {
      if (filter !== "all" && item.kind !== filter) return false;
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (
        query &&
        !`${item.party_name} ${item.description}`.toLowerCase().includes(query)
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (a.status === "paid" && b.status !== "paid") return 1;
      if (a.status !== "paid" && b.status === "paid") return -1;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    });

  const openPayment = (debt: Debt) => {
    setPaymentDebt(debt);
    const remaining = Math.max(0, Number(debt.amount) - Number(debt.paid_amount));
    setPaymentForm({ ...blankPaymentForm(), amount: String(remaining) });
    setError("");
  };

  const submitDebt = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = debtSchema.safeParse({
      ...debtForm,
      due_date: debtForm.due_date || null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Periksa data hutang/piutang.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await addDebt({
        ...parsed.data,
        due_date: parsed.data.due_date ?? null,
      });
      setDebtModalOpen(false);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Catatan hutang/piutang belum dapat disimpan.",
      );
    } finally {
      setBusy(false);
    }
  };

  const submitPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!paymentDebt) return;
    const remaining = Math.max(0, Number(paymentDebt.amount) - Number(paymentDebt.paid_amount));
    const parsed = debtPaymentSchema.safeParse(paymentForm);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Periksa pembayaran.");
      return;
    }
    if (Number(parsed.data.amount) > remaining) {
      setError(`Nominal melebihi sisa tagihan (${formatCurrency(remaining)}).`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await addDebtPayment({
        debt_id: paymentDebt.id,
        payment_date: parsed.data.payment_date,
        amount: Number(parsed.data.amount),
        payment_method: parsed.data.payment_method,
        note: parsed.data.note ?? "",
      });
      setPaymentDebt(null);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Pembayaran belum dapat dicatat.",
      );
    } finally {
      setBusy(false);
    }
  };

  const paymentsForDebt = (debtId: string) =>
    data.debtPayments
      .filter((item) => item.debt_id === debtId)
      .sort((a, b) => b.payment_date.localeCompare(a.payment_date));

  const statusInfo = (debt: Debt) => {
    if (debt.status === "paid") {
      return { label: "Lunas", className: "status-paid" };
    }
    if (debt.status === "partial") {
      return { label: "Dicicil", className: "status-partial" };
    }
    return { label: "Belum lunas", className: "status-unpaid" };
  };

  return (
    <div className="module-page">
      <div className="page-intro module-intro">
        <div>
          <p className="eyebrow">PEMANTAUAN TAGIHAN</p>
          <h2>Hutang & piutang</h2>
          <p>Kendalikan kewajiban bayar ke pemasok dan tagihan penjualan ke pembeli.</p>
        </div>
        <button
          className="primary-button compact-button"
          onClick={() => {
            setDebtForm(blankDebtForm());
            setError("");
            setDebtModalOpen(true);
          }}
        >
          <CirclePlus size={17} />
          Catat tagihan baru
        </button>
      </div>

      <section className="debt-overview-grid">
        <article className="debt-overview-card debt-card-payable">
          <span className="debt-overview-icon">
            <ArrowUpRight size={18} />
          </span>
          <div>
            <small>Total kewajiban hutang</small>
            <strong>{formatCurrency(totalPayable)}</strong>
            <span className="debt-card-sub">Tagihan pemasok belum lunas</span>
          </div>
        </article>

        <article className="debt-overview-card debt-card-receivable">
          <span className="debt-overview-icon">
            <ArrowDownLeft size={18} />
          </span>
          <div>
            <small>Total hak piutang</small>
            <strong>{formatCurrency(totalReceivable)}</strong>
            <span className="debt-card-sub">Tagihan pembeli belum diterima</span>
          </div>
        </article>

        <article className={`debt-overview-card ${overdueDebts.length ? "debt-card-warning" : ""}`}>
          <span className="debt-overview-icon debt-warning-icon">
            <Clock3 size={18} />
          </span>
          <div>
            <small>Perlu perhatian</small>
            <strong>{overdueDebts.length} catatan</strong>
            <span className="debt-card-sub">Melewati tanggal jatuh tempo</span>
          </div>
        </article>
      </section>

      <section className="panel debt-list-panel">
        <div className="debt-toolbar">
          <div className="debt-tabs" role="tablist" aria-label="Filter hutang piutang">
            <button
              className={filter === "all" ? "debt-tab-active" : ""}
              onClick={() => setFilter("all")}
            >
              Semua <span>{activeDebts.length}</span>
            </button>
            <button
              className={filter === "payable" ? "debt-tab-active" : ""}
              onClick={() => setFilter("payable")}
            >
              Hutang <span>{activeDebts.filter((item) => item.kind === "payable").length}</span>
            </button>
            <button
              className={filter === "receivable" ? "debt-tab-active" : ""}
              onClick={() => setFilter("receivable")}
            >
              Piutang <span>{activeDebts.filter((item) => item.kind === "receivable").length}</span>
            </button>
          </div>

          <div className="debt-filters-right">
            <div className="search-wrap" style={{ maxWidth: "220px" }}>
              <Search size={14} />
              <input
                placeholder="Cari pihak / nama..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              aria-label="Filter status pelunasan"
            >
              <option value="all">Semua status</option>
              <option value="unpaid">Belum lunas</option>
              <option value="partial">Sebagian dicicil</option>
              <option value="paid">Sudah lunas</option>
            </select>
          </div>
        </div>

        <div className="debt-rows">
          {visibleDebts.map((debt) => {
            const remaining = Math.max(0, Number(debt.amount) - Number(debt.paid_amount));
            const status = statusInfo(debt);
            const isExpanded = expanded === debt.id;
            const payments = paymentsForDebt(debt.id);
            const progress =
              Number(debt.amount) > 0 ? (Number(debt.paid_amount) / Number(debt.amount)) * 100 : 0;

            return (
              <article
                className={`debt-row ${overdueIds.has(debt.id) ? "debt-row-overdue" : ""}`}
                key={debt.id}
              >
                <div className="debt-row-main">
                  <span
                    className={`debt-party-icon ${
                      debt.kind === "payable" ? "party-payable" : "party-receivable"
                    }`}
                  >
                    {debt.kind === "payable" ? (
                      <ArrowUpRight size={18} />
                    ) : (
                      <ArrowDownLeft size={18} />
                    )}
                  </span>
                  <div className="debt-party-copy">
                    <div className="debt-party-title">
                      <strong>{debt.party_name}</strong>
                      <span className={`status-pill ${status.className}`}>
                        {status.label}
                      </span>
                    </div>
                    <span>{debt.description}</span>
                    <small>Dicatat {formatDate(debt.created_at)}</small>
                  </div>

                  <div className="debt-due">
                    <small>Jatuh tempo</small>
                    <strong className={overdueIds.has(debt.id) ? "due-late" : ""}>
                      {debt.due_date ? formatDate(debt.due_date) : "Belum ditentukan"}
                    </strong>
                  </div>

                  <div className="debt-remaining">
                    <small>Sisa tagihan</small>
                    <strong>{formatCurrency(remaining)}</strong>
                    <div className="debt-progress-wrap">
                      <div className="debt-progress-track">
                        <div
                          className="debt-progress-fill"
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                      </div>
                      <span>{Math.round(progress)}% terbayar</span>
                    </div>
                  </div>

                  <div className="debt-row-actions">
                    {debt.status !== "paid" && (
                      <button
                        className="secondary-button payment-button"
                        onClick={() => openPayment(debt)}
                      >
                        <HandCoins size={15} />
                        Bayar
                      </button>
                    )}
                    <button
                      className="row-action"
                      aria-label={`Riwayat pembayaran ${debt.party_name}`}
                      title="Riwayat pembayaran"
                      onClick={() => setExpanded(isExpanded ? null : debt.id)}
                    >
                      <ChevronDown
                        size={17}
                        className={isExpanded ? "rotate-icon" : ""}
                      />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="payment-history">
                    <div className="payment-history-heading">
                      <History size={15} />
                      Riwayat pembayaran <span>{payments.length}</span>
                    </div>
                    {payments.length ? (
                      payments.map((payment) => (
                        <div className="payment-history-row" key={payment.id}>
                          <span>
                            {formatDate(payment.payment_date)} •{" "}
                            {paymentLabels[payment.payment_method]}
                          </span>
                          <strong>{formatCurrency(Number(payment.amount))}</strong>
                          <small>{payment.note || "-"}</small>
                          <button
                            type="button"
                            className="quiet-icon kwitansi-btn"
                            title="Unduh kwitansi bukti pembayaran (PDF)"
                            onClick={() =>
                              downloadDebtReceiptPdf(
                                data.profile.business_name,
                                debt,
                                payment,
                              )
                            }
                          >
                            <Download size={13} /> Kwitansi
                          </button>
                        </div>
                      ))
                    ) : (
                      <p>Belum ada pembayaran tercatat.</p>
                    )}
                  </div>
                )}
              </article>
            );
          })}

          {!visibleDebts.length && (
            <div className="empty-row">
              <WalletCards size={19} />
              Belum ada catatan tagihan yang sesuai dengan filter pencarian.
            </div>
          )}
        </div>
      </section>

      {/* Modal Add Debt */}
      {debtModalOpen && (
        <div
          className="modal-scrim"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDebtModalOpen(false);
          }}
        >
          <section
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="debt-modal-title"
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">TAGIHAN USAHA</p>
                <h2 id="debt-modal-title">
                  {debtForm.kind === "payable" ? "Catat hutang" : "Catat piutang"}
                </h2>
                <p>Simpan nominal, pihak terkait, dan jatuh tempo.</p>
              </div>
              <button
                className="icon-button modal-close"
                aria-label="Tutup"
                onClick={() => setDebtModalOpen(false)}
              >
                <X size={19} />
              </button>
            </div>
            <form className="modal-form" onSubmit={submitDebt}>
              <div className="segmented-control" role="group" aria-label="Jenis tagihan">
                <button
                  type="button"
                  className={
                    debtForm.kind === "payable" ? "segment-active segment-expense" : ""
                  }
                  onClick={() => setDebtForm({ ...debtForm, kind: "payable" })}
                >
                  <ArrowUpRight size={16} />
                  Hutang (Kewajiban)
                </button>
                <button
                  type="button"
                  className={
                    debtForm.kind === "receivable" ? "segment-active segment-income" : ""
                  }
                  onClick={() => setDebtForm({ ...debtForm, kind: "receivable" })}
                >
                  <ArrowDownLeft size={16} />
                  Piutang (Hak Tagih)
                </button>
              </div>

              <div className="form-grid">
                <label className="field-label form-span">
                  {debtForm.kind === "payable" ? "Nama pemasok / rekanan" : "Nama pembeli / pelanggan"}
                  <input
                    value={debtForm.party_name}
                    onChange={(event) =>
                      setDebtForm({ ...debtForm, party_name: event.target.value })
                    }
                    placeholder={
                      debtForm.kind === "payable"
                        ? "Contoh: Koperasi Pakan Sejahtera"
                        : "Contoh: Rumah Makan Lestari"
                    }
                    required
                  />
                </label>
                <label className="field-label form-span">
                  Keterangan
                  <input
                    value={debtForm.description}
                    onChange={(event) =>
                      setDebtForm({ ...debtForm, description: event.target.value })
                    }
                    placeholder="Contoh: Pembelian pakan konsentrat 20 sak"
                    required
                  />
                </label>
                <label className="field-label">
                  Nominal Total (Rp)
                  <input
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={debtForm.amount}
                    onChange={(event) =>
                      setDebtForm({ ...debtForm, amount: event.target.value })
                    }
                    required
                  />
                </label>
                <label className="field-label">
                  Jatuh tempo <span className="optional-label">Opsional</span>
                  <input
                    type="date"
                    value={debtForm.due_date}
                    onChange={(event) =>
                      setDebtForm({ ...debtForm, due_date: event.target.value })
                    }
                  />
                </label>
              </div>

              {error && (
                <p className="form-alert error-alert" role="alert">
                  {error}
                </p>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setDebtModalOpen(false)}
                >
                  Batal
                </button>
                <button className="primary-button" type="submit" disabled={busy}>
                  <Check size={16} />
                  {busy ? "Menyimpan..." : "Simpan catatan"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Modal Pay Debt */}
      {paymentDebt && (
        <div
          className="modal-scrim"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPaymentDebt(null);
          }}
        >
          <section
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-modal-title"
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">PEMBAYARAN TAGIHAN</p>
                <h2 id="payment-modal-title">Catat pembayaran</h2>
                <p>
                  {paymentDebt.party_name} — Sisa tagihan:{" "}
                  {formatCurrency(
                    Number(paymentDebt.amount) - Number(paymentDebt.paid_amount),
                  )}
                </p>
              </div>
              <button
                className="icon-button modal-close"
                aria-label="Tutup"
                onClick={() => setPaymentDebt(null)}
              >
                <X size={19} />
              </button>
            </div>
            <form className="modal-form" onSubmit={submitPayment}>
              <div className="form-grid">
                <label className="field-label">
                  Tanggal pembayaran
                  <input
                    type="date"
                    value={paymentForm.payment_date}
                    onChange={(event) =>
                      setPaymentForm({
                        ...paymentForm,
                        payment_date: event.target.value,
                      })
                    }
                    required
                  />
                </label>
                <label className="field-label">
                  Nominal Dibayar (Rp)
                  <input
                    type="number"
                    min="1"
                    max={Number(paymentDebt.amount) - Number(paymentDebt.paid_amount)}
                    inputMode="numeric"
                    value={paymentForm.amount}
                    onChange={(event) =>
                      setPaymentForm({ ...paymentForm, amount: event.target.value })
                    }
                    required
                  />
                </label>
                <label className="field-label form-span">
                  Metode pembayaran
                  <select
                    value={paymentForm.payment_method}
                    onChange={(event) =>
                      setPaymentForm({
                        ...paymentForm,
                        payment_method: event.target.value as PaymentMethod,
                      })
                    }
                  >
                    <option value="cash">Tunai</option>
                    <option value="transfer">Transfer Bank</option>
                    <option value="qris">QRIS</option>
                  </select>
                </label>
                <label className="field-label form-span">
                  Catatan pembayaran
                  <input
                    value={paymentForm.note}
                    onChange={(event) =>
                      setPaymentForm({ ...paymentForm, note: event.target.value })
                    }
                    placeholder="Contoh: Pembayaran cicilan tahap 1 via BCA"
                  />
                </label>
              </div>

              {error && (
                <p className="form-alert error-alert" role="alert">
                  {error}
                </p>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setPaymentDebt(null)}
                >
                  Batal
                </button>
                <button className="primary-button" type="submit" disabled={busy}>
                  <Check size={16} />
                  {busy ? "Menyimpan..." : "Simpan pembayaran"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
