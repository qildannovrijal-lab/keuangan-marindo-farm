"use client";

import { useState, type FormEvent } from "react";
import { CalendarDays, Check, CirclePlus, MoreHorizontal, Pencil, Sprout, Trash2, X } from "lucide-react";
import { useFarmData } from "@/lib/farm-data";
import { formatCurrency, formatDate, toDateInputValue } from "@/lib/format";
import type { FarmTransaction, Pen } from "@/lib/domain";
import { penSchema } from "@/lib/validation";

type PenForm = { name: string; livestock_type: string; head_count: string; start_date: string };
const emptyForm = (): PenForm => ({ name: "", livestock_type: "", head_count: "0", start_date: toDateInputValue(new Date()) });

const totalsForPen = (transactions: FarmTransaction[], penId: string) => {
  const rows = transactions.filter((item) => !item.deleted_at && item.pen_id === penId);
  return {
    income: rows.filter((item) => item.kind === "income").reduce((sum, item) => sum + Number(item.amount), 0),
    expense: rows.filter((item) => item.kind === "expense").reduce((sum, item) => sum + Number(item.amount), 0),
    count: rows.length,
  };
};

export default function PensPage() {
  const { data, addPen, updatePen, deletePen } = useFarmData();
  const [editing, setEditing] = useState<Pen | null>(null);
  const [form, setForm] = useState<PenForm>(emptyForm);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const pens = data.pens.filter((pen) => !pen.deleted_at);
  const totalHeads = pens.reduce((sum, pen) => sum + Number(pen.head_count), 0);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setError(""); setModalOpen(true); };
  const openEdit = (pen: Pen) => { setEditing(pen); setForm({ name: pen.name, livestock_type: pen.livestock_type, head_count: String(pen.head_count), start_date: pen.start_date }); setError(""); setModalOpen(true); };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = penSchema.safeParse(form);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Periksa data kandang."); return; }
    if (pens.some((pen) => pen.name.toLowerCase() === parsed.data.name.toLowerCase() && pen.id !== editing?.id)) { setError("Nama kandang atau batch tersebut sudah digunakan."); return; }
    setBusy(true);
    setError("");
    try {
      const input = { ...parsed.data, head_count: Number(parsed.data.head_count) };
      if (editing) await updatePen(editing.id, input);
      else await addPen(input);
      setModalOpen(false);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Data kandang belum dapat disimpan."); }
    finally { setBusy(false); }
  };

  const remove = async (pen: Pen) => {
    if (!window.confirm(`Arsipkan “${pen.name}”? Transaksi lama tetap tersimpan.`)) return;
    try { await deletePen(pen.id); }
    catch (caught) { window.alert(caught instanceof Error ? caught.message : "Kandang belum dapat diarsipkan."); }
  };

  return (
    <div className="module-page">
      <div className="page-intro module-intro"><div><p className="eyebrow">OPERASIONAL TERNAK</p><h2>Kandang & kelompok ternak</h2><p>Telusuri jumlah ternak, siklus, dan hasil keuangan tiap kelompok.</p></div><button className="primary-button compact-button" onClick={openCreate}><CirclePlus size={17} />Tambah kandang</button></div>
      <section className="pen-summary-row"><div className="pen-summary"><span className="pen-summary-icon"><Sprout size={18} /></span><span><small>Kandang aktif</small><strong>{pens.length}</strong></span></div><div className="pen-summary"><span className="pen-summary-icon pen-summary-lime"><span className="head-count-mark">#</span></span><span><small>Total populasi</small><strong>{new Intl.NumberFormat("id-ID").format(totalHeads)} <small>ekor</small></strong></span></div><div className="pen-summary"><span className="pen-summary-icon pen-summary-amber"><CalendarDays size={17} /></span><span><small>Transaksi terhubung</small><strong>{data.transactions.filter((item) => !item.deleted_at && item.pen_id).length}</strong></span></div></section>
      <section className="pen-card-grid">{pens.map((pen) => {
        const totals = totalsForPen(data.transactions, pen.id);
        const profit = totals.income - totals.expense;
        const unitCost = pen.head_count > 0 ? totals.expense / pen.head_count : 0;
        return <article className="pen-card" key={pen.id}><div className="pen-card-top"><span className="pen-illustration"><Sprout size={24} /></span><span className="pen-active-badge"><i />Aktif</span><div className="pen-menu"><button className="row-action" aria-label={`Ubah ${pen.name}`} onClick={() => openEdit(pen)} title="Ubah"><Pencil size={15} /></button><button className="row-action row-action-danger" aria-label={`Arsipkan ${pen.name}`} onClick={() => void remove(pen)} title="Arsipkan"><Trash2 size={15} /></button><MoreHorizontal size={16} /></div></div><div className="pen-card-heading"><h3>{pen.name}</h3><span>{pen.livestock_type}</span></div><div className="pen-meta"><span><strong>{new Intl.NumberFormat("id-ID").format(pen.head_count)}</strong> ekor</span><span>Mulai {formatDate(pen.start_date)}</span></div><div className="pen-card-divider" /><div className="pen-finance-grid"><div><small>Pemasukan</small><strong>{formatCurrency(totals.income)}</strong></div><div><small>Pengeluaran</small><strong>{formatCurrency(totals.expense)}</strong></div><div><small>Laba / rugi</small><strong className={profit >= 0 ? "amount-income" : "amount-expense"}>{formatCurrency(profit)}</strong></div><div><small>Biaya / ekor</small><strong>{formatCurrency(unitCost)}</strong></div></div><div className="pen-card-foot"><span>{totals.count} transaksi terkait</span><span className="pen-foot-dot" /></div></article>;
      })}{!pens.length && <div className="empty-panel"><Sprout size={24} /><strong>Belum ada kandang</strong><span>Tambahkan kandang atau batch untuk melacak biaya per ekor.</span><button className="primary-button" onClick={openCreate}><CirclePlus size={16} />Tambah kandang</button></div>}</section>
      <div className="page-note"><span>Biaya per ekor dihitung dari total pengeluaran kandang dibagi populasi saat ini.</span><span>Nilai histori mengikuti transaksi yang belum diarsipkan.</span></div>

      {modalOpen && <div className="modal-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false); }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="pen-modal-title"><div className="modal-heading"><div><p className="eyebrow">KELOMPOK TERNAK</p><h2 id="pen-modal-title">{editing ? "Ubah kandang" : "Tambah kandang"}</h2><p>Catat identitas kelompok ternak.</p></div><button className="icon-button modal-close" aria-label="Tutup" onClick={() => setModalOpen(false)}><X size={19} /></button></div><form className="modal-form" onSubmit={submit}><div className="form-grid"><label className="field-label form-span">Nama kandang / batch<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Contoh: Kandang Broiler A" required /></label><label className="field-label">Jenis ternak<input value={form.livestock_type} onChange={(event) => setForm({ ...form, livestock_type: event.target.value })} placeholder="Contoh: Ayam broiler" required /></label><label className="field-label">Jumlah ekor<input type="number" min="0" step="1" value={form.head_count} onChange={(event) => setForm({ ...form, head_count: event.target.value })} required /></label><label className="field-label form-span">Tanggal mulai<input type="date" value={form.start_date} onChange={(event) => setForm({ ...form, start_date: event.target.value })} required /></label></div>{error && <p className="form-alert error-alert" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setModalOpen(false)}>Batal</button><button className="primary-button" type="submit" disabled={busy}><Check size={16} />{busy ? "Menyimpan..." : editing ? "Simpan perubahan" : "Simpan kandang"}</button></div></form></section></div>}
    </div>
  );
}