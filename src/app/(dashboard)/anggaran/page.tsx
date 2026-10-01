"use client";

import { useState, type FormEvent } from "react";
import { AlertTriangle, ArrowUpRight, Check, CirclePlus, Gauge, Pencil, X } from "lucide-react";
import { useFarmData } from "@/lib/farm-data";
import { formatCurrency } from "@/lib/format";
import { budgetSchema } from "@/lib/validation";

const monthInputValue = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};
const firstDay = (month: string) => `${month}-01`;

export default function BudgetsPage() {
  const { data, addBudget } = useFarmData();
  const [month, setMonth] = useState(monthInputValue);
  const [modalOpen, setModalOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [target, setTarget] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const categories = data.categories.filter((item) => item.kind === "expense" && !item.deleted_at);
  const monthRows = data.budgets.filter((item) => item.period_month.slice(0, 7) === month).map((budget) => {
    const actual = data.transactions.filter((item) => !item.deleted_at && item.kind === "expense" && item.category_id === budget.category_id && item.transaction_date.slice(0, 7) === month).reduce((sum, item) => sum + Number(item.amount), 0);
    const category = data.categories.find((item) => item.id === budget.category_id);
    return { ...budget, actual, categoryName: category?.name ?? "Kategori diarsipkan", progress: Number(budget.target_amount) > 0 ? (actual / Number(budget.target_amount)) * 100 : 0 };
  }).sort((a, b) => b.progress - a.progress);
  const totalTarget = monthRows.reduce((sum, item) => sum + Number(item.target_amount), 0);
  const totalActual = monthRows.reduce((sum, item) => sum + item.actual, 0);
  const warningCount = monthRows.filter((item) => item.progress >= 80).length;

  const openBudget = (budget?: (typeof monthRows)[number]) => {
    setCategoryId(budget?.category_id ?? categories[0]?.id ?? "");
    setTarget(budget ? String(budget.target_amount) : "");
    setError("");
    setModalOpen(true);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = budgetSchema.safeParse({ category_id: categoryId, period_month: firstDay(month), target_amount: target });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Periksa target anggaran."); return; }
    setBusy(true); setError("");
    try {
      await addBudget({ ...parsed.data, target_amount: Number(parsed.data.target_amount) });
      setModalOpen(false);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Anggaran belum dapat disimpan."); }
    finally { setBusy(false); }
  };

  return (
    <div className="module-page">
      <div className="page-intro module-intro"><div><p className="eyebrow">RENCANA BIAYA</p><h2>Anggaran bulanan</h2><p>Tetapkan batas pengeluaran per kategori dan pantau realisasinya.</p></div><button className="primary-button compact-button" onClick={() => openBudget()}><CirclePlus size={17} />Atur kategori</button></div>
      <div className="budget-period-bar"><label className="field-label">Periode<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label><span className="period-caption">Peringatan muncul saat realisasi mencapai 80% dan 100% dari target.</span></div>
      <section className="budget-overview-grid"><article className="budget-overview-card"><span className="budget-overview-icon"><Gauge size={18} /></span><span><small>Target bulan ini</small><strong>{formatCurrency(totalTarget)}</strong></span></article><article className="budget-overview-card"><span className="budget-overview-icon budget-actual-icon"><ArrowUpRight size={18} /></span><span><small>Realisasi bulan ini</small><strong>{formatCurrency(totalActual)}</strong></span></article><article className={`budget-overview-card ${warningCount ? "budget-warning-card" : ""}`}><span className="budget-overview-icon budget-warning-icon"><AlertTriangle size={18} /></span><span><small>Kategori perlu perhatian</small><strong>{warningCount} <small>dari {monthRows.length} kategori</small></strong></span></article></section>
      <section className="panel budget-detail-panel"><div className="panel-heading"><div><p className="eyebrow">REALISASI PER KATEGORI</p><h3>Rencana vs. aktual</h3></div><span className="count-pill">{monthRows.length} kategori</span></div>
        {monthRows.length ? <div className="budget-detail-list">{monthRows.map((item) => {
          const level = item.progress >= 100 ? "over" : item.progress >= 80 ? "near" : "safe";
          return <article className="budget-detail-row" key={item.id}><div className="budget-detail-top"><div><strong>{item.categoryName}</strong><span>{level === "over" ? <i className="budget-alert-label alert-danger"><AlertTriangle size={13} />Melewati anggaran</i> : level === "near" ? <i className="budget-alert-label alert-warning"><AlertTriangle size={13} />Mendekati batas</i> : <i className="budget-alert-label alert-safe">Dalam batas</i>}</span></div><button className="row-action" onClick={() => openBudget(item)} aria-label={`Ubah target ${item.categoryName}`} title="Ubah target"><Pencil size={15} /></button></div><div className="budget-detail-values"><strong>{formatCurrency(item.actual)}</strong><span>dari {formatCurrency(Number(item.target_amount))}</span><b>{Math.round(item.progress)}%</b></div><div className="budget-detail-track"><i className={`budget-progress-${level}`} style={{ width: `${Math.min(item.progress, 100)}%` }} /></div></article>;
        })}</div> : <div className="empty-row"><Gauge size={19} />Belum ada target untuk periode ini. Tambahkan kategori biaya untuk mulai memantau.</div>}
      </section>
      <div className="page-note"><span>Peringatan bersifat pengingat, bukan pembatas transaksi.</span><span>Realisasi dihitung dari transaksi pengeluaran yang aktif.</span></div>
      {modalOpen && <div className="modal-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false); }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="budget-modal-title"><div className="modal-heading"><div><p className="eyebrow">ANGGARAN {month}</p><h2 id="budget-modal-title">Atur target kategori</h2><p>Target berlaku untuk satu kategori pada bulan yang dipilih.</p></div><button className="icon-button modal-close" aria-label="Tutup" onClick={() => setModalOpen(false)}><X size={19} /></button></div><form className="modal-form" onSubmit={submit}><div className="form-grid"><label className="field-label form-span">Kategori pengeluaran<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required><option value="">Pilih kategori</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field-label form-span">Target anggaran (Rp)<input type="number" min="1" inputMode="numeric" value={target} onChange={(event) => setTarget(event.target.value)} placeholder="Contoh: 2500000" required /></label></div>{error && <p className="form-alert error-alert" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setModalOpen(false)}>Batal</button><button className="primary-button" type="submit" disabled={busy}><Check size={16} />{busy ? "Menyimpan..." : "Simpan target"}</button></div></form></section></div>}
    </div>
  );
}
