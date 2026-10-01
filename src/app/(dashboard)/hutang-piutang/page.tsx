"use client";

import { useState, type FormEvent } from "react";
import { ArrowDownLeft, ArrowUpRight, CalendarClock, Check, ChevronDown, CirclePlus, Clock3, HandCoins, History, WalletCards, X } from "lucide-react";
import { useFarmData } from "@/lib/farm-data";
import { formatCurrency, formatDate, toDateInputValue } from "@/lib/format";
import type { Debt, DebtKind, PaymentMethod } from "@/lib/domain";
import { debtPaymentSchema, debtSchema } from "@/lib/validation";

type DebtForm = { kind: DebtKind; party_name: string; description: string; amount: string; due_date: string };
type PaymentForm = { payment_date: string; amount: string; payment_method: PaymentMethod; note: string };
const blankDebt = (kind: DebtKind = "payable"): DebtForm => ({ kind, party_name: "", description: "", amount: "", due_date: "" });
const blankPayment = (): PaymentForm => ({ payment_date: toDateInputValue(new Date()), amount: "", payment_method: "transfer", note: "" });

const paymentLabels: Record<PaymentMethod, string> = { cash: "Tunai", transfer: "Transfer", qris: "QRIS" };

export default function DebtPage() {
  const { data, addDebt, addDebtPayment } = useFarmData();
  const [filter, setFilter] = useState<"all" | DebtKind>("all");
  const [debtModalOpen, setDebtModalOpen] = useState(false);
  const [paymentDebt, setPaymentDebt] = useState<Debt | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [debtForm, setDebtForm] = useState<DebtForm>(blankDebt());
  const [paymentForm, setPaymentForm] = useState<PaymentForm>(blankPayment());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const today = toDateInputValue(new Date());
  const activeDebts = data.debts.slice().sort((a, b) => (a.due_date ?? "9999-12-31").localeCompare(b.due_date ?? "9999-12-31"));
  const visibleDebts = filter === "all" ? activeDebts : activeDebts.filter((item) => item.kind === filter);
  const outstandingPayable = activeDebts.filter((item) => item.kind === "payable").reduce((sum, item) => sum + Math.max(0, Number(item.amount) - Number(item.paid_amount)), 0);
  const outstandingReceivable = activeDebts.filter((item) => item.kind === "receivable").reduce((sum, item) => sum + Math.max(0, Number(item.amount) - Number(item.paid_amount)), 0);
  const overdueCount = activeDebts.filter((item) => item.status !== "paid" && item.due_date && item.due_date < today).length;
  const paymentsForDebt = (debtId: string) => data.debtPayments.filter((payment) => payment.debt_id === debtId).sort((a, b) => b.payment_date.localeCompare(a.payment_date));
  const overdueIds = new Set(activeDebts.filter((item) => item.status !== "paid" && item.due_date && item.due_date < today).map((item) => item.id));

  const submitDebt = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = debtSchema.safeParse({ ...debtForm, amount: debtForm.amount, due_date: debtForm.due_date || null });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Periksa data hutang/piutang."); return; }
    setBusy(true); setError("");
    try {
      await addDebt({ ...parsed.data, amount: Number(parsed.data.amount) });
      setDebtModalOpen(false);
      setDebtForm(blankDebt());
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Catatan belum dapat disimpan."); }
    finally { setBusy(false); }
  };

  const submitPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!paymentDebt) return;
    const parsed = debtPaymentSchema.safeParse(paymentForm);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Periksa data pembayaran."); return; }
    const remaining = Number(paymentDebt.amount) - Number(paymentDebt.paid_amount);
    if (Number(parsed.data.amount) > remaining) { setError(`Pembayaran melebihi sisa ${formatCurrency(remaining)}.`); return; }
    setBusy(true); setError("");
    try {
      await addDebtPayment({ ...parsed.data, amount: Number(parsed.data.amount), debt_id: paymentDebt.id, note: parsed.data.note ?? "" });
      setPaymentDebt(null);
      setPaymentForm(blankPayment());
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Pembayaran belum dapat disimpan."); }
    finally { setBusy(false); }
  };

  const statusInfo = (debt: Debt) => {
    if (debt.status === "paid") return { label: "Lunas", className: "status-paid" };
    if (overdueIds.has(debt.id)) return { label: "Terlambat", className: "status-overdue" };
    if (debt.status === "partial") return { label: "Sebagian", className: "status-partial" };
    return { label: "Belum lunas", className: "status-unpaid" };
  };

  const openDebtModal = (kind: DebtKind) => { setDebtForm(blankDebt(kind)); setError(""); setDebtModalOpen(true); };
  const openPayment = (debt: Debt) => { setPaymentDebt(debt); setPaymentForm(blankPayment()); setError(""); };

  return (
    <div className="module-page">
      <div className="page-intro module-intro"><div><p className="eyebrow">TAGIHAN USAHA</p><h2>Hutang & piutang</h2><p>Ketahui sisa kewajiban dan tagihan yang perlu ditindaklanjuti.</p></div><div className="intro-actions"><button className="secondary-button" onClick={() => openDebtModal("receivable")}><ArrowDownLeft size={16} />Catat piutang</button><button className="primary-button compact-button" onClick={() => openDebtModal("payable")}><CirclePlus size={17} />Catat hutang</button></div></div>

      <section className="debt-summary-grid"><article className="debt-summary-card"><span className="debt-summary-icon payable-icon"><ArrowUpRight size={18} /></span><span><small>Sisa hutang ke pemasok</small><strong>{formatCurrency(outstandingPayable)}</strong></span></article><article className="debt-summary-card"><span className="debt-summary-icon receivable-icon"><ArrowDownLeft size={18} /></span><span><small>Piutang belum diterima</small><strong>{formatCurrency(outstandingReceivable)}</strong></span></article><article className={`debt-summary-card ${overdueCount ? "debt-summary-alert" : ""}`}><span className="debt-summary-icon overdue-icon"><CalendarClock size={18} /></span><span><small>Perlu ditindaklanjuti</small><strong>{overdueCount} <small>terlambat</small></strong></span></article></section>

      <section className="panel debt-list-panel"><div className="debt-toolbar"><div className="debt-tabs" role="tablist" aria-label="Filter hutang piutang"><button className={filter === "all" ? "debt-tab-active" : ""} onClick={() => setFilter("all")}>Semua <span>{activeDebts.length}</span></button><button className={filter === "payable" ? "debt-tab-active" : ""} onClick={() => setFilter("payable")}>Hutang <span>{activeDebts.filter((item) => item.kind === "payable").length}</span></button><button className={filter === "receivable" ? "debt-tab-active" : ""} onClick={() => setFilter("receivable")}>Piutang <span>{activeDebts.filter((item) => item.kind === "receivable").length}</span></button></div><span className="debt-list-hint"><Clock3 size={15} />Urut dari jatuh tempo terdekat</span></div>
        <div className="debt-rows">{visibleDebts.map((debt) => {
          const remaining = Math.max(0, Number(debt.amount) - Number(debt.paid_amount));
          const status = statusInfo(debt);
          const isExpanded = expanded === debt.id;
          const payments = paymentsForDebt(debt.id);
          return <article className={`debt-row ${overdueIds.has(debt.id) ? "debt-row-overdue" : ""}`} key={debt.id}><div className="debt-row-main"><span className={`debt-party-icon ${debt.kind === "payable" ? "party-payable" : "party-receivable"}`}>{debt.kind === "payable" ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}</span><div className="debt-party-copy"><div className="debt-party-title"><strong>{debt.party_name}</strong><span className={`status-pill ${status.className}`}>{status.label}</span></div><span>{debt.description}</span><small>Dicatat {formatDate(debt.created_at)}</small></div><div className="debt-due"><small>Jatuh tempo</small><strong className={overdueIds.has(debt.id) ? "due-late" : ""}>{debt.due_date ? formatDate(debt.due_date) : "Belum ditentukan"}</strong></div><div className="debt-remaining"><small>Sisa tagihan</small><strong>{formatCurrency(remaining)}</strong><span>dari {formatCurrency(Number(debt.amount))}</span></div><div className="debt-row-actions">{debt.status !== "paid" && <button className="secondary-button payment-button" onClick={() => openPayment(debt)}><HandCoins size={15} />Bayar</button>}<button className="row-action" aria-label={`Riwayat pembayaran ${debt.party_name}`} title="Riwayat pembayaran" onClick={() => setExpanded(isExpanded ? null : debt.id)}><ChevronDown size={17} className={isExpanded ? "rotate-icon" : ""} /></button></div></div>{isExpanded && <div className="payment-history"><div className="payment-history-heading"><History size={15} />Riwayat pembayaran <span>{payments.length}</span></div>{payments.length ? payments.map((payment) => <div className="payment-history-row" key={payment.id}><span>{formatDate(payment.payment_date)} · {paymentLabels[payment.payment_method]}</span><strong>{formatCurrency(Number(payment.amount))}</strong><small>{payment.note || "-"}</small></div>) : <p>Belum ada pembayaran tercatat.</p>}</div>}</article>;
        })}{!visibleDebts.length && <div className="empty-row"><WalletCards size={19} />Belum ada catatan pada kelompok ini.</div>}</div>
      </section>

      {debtModalOpen && <div className="modal-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDebtModalOpen(false); }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="debt-modal-title"><div className="modal-heading"><div><p className="eyebrow">TAGIHAN USAHA</p><h2 id="debt-modal-title">{debtForm.kind === "payable" ? "Catat hutang" : "Catat piutang"}</h2><p>Simpan nominal, pihak terkait, dan jatuh tempo.</p></div><button className="icon-button modal-close" aria-label="Tutup" onClick={() => setDebtModalOpen(false)}><X size={19} /></button></div><form className="modal-form" onSubmit={submitDebt}><div className="segmented-control" role="group" aria-label="Jenis tagihan"><button type="button" className={debtForm.kind === "payable" ? "segment-active segment-expense" : ""} onClick={() => setDebtForm({ ...debtForm, kind: "payable" })}><ArrowUpRight size={16} />Hutang</button><button type="button" className={debtForm.kind === "receivable" ? "segment-active segment-income" : ""} onClick={() => setDebtForm({ ...debtForm, kind: "receivable" })}><ArrowDownLeft size={16} />Piutang</button></div><div className="form-grid"><label className="field-label form-span">{debtForm.kind === "payable" ? "Nama pemasok" : "Nama pembeli"}<input value={debtForm.party_name} onChange={(event) => setDebtForm({ ...debtForm, party_name: event.target.value })} placeholder={debtForm.kind === "payable" ? "Contoh: Koperasi pakan" : "Contoh: Rumah Makan Lestari"} required /></label><label className="field-label form-span">Keterangan<input value={debtForm.description} onChange={(event) => setDebtForm({ ...debtForm, description: event.target.value })} placeholder="Contoh: Pembelian pakan bulan ini" required /></label><label className="field-label">Nominal (Rp)<input type="number" min="1" inputMode="numeric" value={debtForm.amount} onChange={(event) => setDebtForm({ ...debtForm, amount: event.target.value })} required /></label><label className="field-label">Jatuh tempo <span className="optional-label">Opsional</span><input type="date" value={debtForm.due_date} onChange={(event) => setDebtForm({ ...debtForm, due_date: event.target.value })} /></label></div>{error && <p className="form-alert error-alert" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setDebtModalOpen(false)}>Batal</button><button className="primary-button" type="submit" disabled={busy}><Check size={16} />{busy ? "Menyimpan..." : "Simpan catatan"}</button></div></form></section></div>}

      {paymentDebt && <div className="modal-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPaymentDebt(null); }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="payment-modal-title"><div className="modal-heading"><div><p className="eyebrow">PEMBAYARAN</p><h2 id="payment-modal-title">Catat pembayaran</h2><p>{paymentDebt.party_name} · Sisa {formatCurrency(Number(paymentDebt.amount) - Number(paymentDebt.paid_amount))}</p></div><button className="icon-button modal-close" aria-label="Tutup" onClick={() => setPaymentDebt(null)}><X size={19} /></button></div><form className="modal-form" onSubmit={submitPayment}><div className="form-grid"><label className="field-label">Tanggal pembayaran<input type="date" value={paymentForm.payment_date} onChange={(event) => setPaymentForm({ ...paymentForm, payment_date: event.target.value })} required /></label><label className="field-label">Nominal (Rp)<input type="number" min="1" max={Number(paymentDebt.amount) - Number(paymentDebt.paid_amount)} inputMode="numeric" value={paymentForm.amount} onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })} required /></label><label className="field-label form-span">Metode pembayaran<select value={paymentForm.payment_method} onChange={(event) => setPaymentForm({ ...paymentForm, payment_method: event.target.value as PaymentMethod })}><option value="cash">Tunai</option><option value="transfer">Transfer</option><option value="qris">QRIS</option></select></label><label className="field-label form-span">Catatan<input value={paymentForm.note} onChange={(event) => setPaymentForm({ ...paymentForm, note: event.target.value })} placeholder="Catatan pembayaran" /></label></div>{error && <p className="form-alert error-alert" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setPaymentDebt(null)}>Batal</button><button className="primary-button" type="submit" disabled={busy}><Check size={16} />{busy ? "Menyimpan..." : "Simpan pembayaran"}</button></div></form></section></div>}
    </div>
  );
}