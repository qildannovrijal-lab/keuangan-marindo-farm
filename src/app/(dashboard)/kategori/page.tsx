"use client";

import { useState, type FormEvent } from "react";
import { ArrowDownLeft, ArrowUpRight, Check, CirclePlus, Pencil, Tags, Trash2, X } from "lucide-react";
import { useFarmData } from "@/lib/farm-data";
import type { TransactionKind } from "@/lib/domain";
import { categorySchema } from "@/lib/validation";

export default function CategoriesPage() {
  const { data, addCategory, updateCategory, deleteCategory } = useFarmData();
  const [kind, setKind] = useState<TransactionKind>("expense");
  const [editing, setEditing] = useState<{ id: string; kind: TransactionKind; name: string } | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const rows = data.categories.filter((category) => category.kind === kind && !category.deleted_at).sort((a, b) => a.name.localeCompare(b.name, "id"));

  const openCreate = () => {
    setEditing(null);
    setName("");
    setError("");
  };

  const openEdit = (category: { id: string; kind: TransactionKind; name: string }) => {
    setEditing(category);
    setKind(category.kind);
    setName(category.name);
    setError("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = categorySchema.safeParse({ kind: editing?.kind ?? kind, name });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Periksa nama kategori.");
      return;
    }
    const duplicate = data.categories.some((item) => !item.deleted_at && item.kind === parsed.data.kind && item.name.toLowerCase() === parsed.data.name.toLowerCase() && item.id !== editing?.id);
    if (duplicate) {
      setError("Kategori dengan nama tersebut sudah ada.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      if (editing) await updateCategory(editing.id, parsed.data.name);
      else await addCategory(parsed.data);
      setEditing(null);
      setName("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Kategori belum dapat disimpan.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (category: (typeof rows)[number]) => {
    if (!window.confirm(`Arsipkan kategori “${category.name}”? Transaksi lama tetap memakai kategori ini di laporan.`)) return;
    try {
      await deleteCategory(category.id);
    } catch (caught) {
      window.alert(caught instanceof Error ? caught.message : "Kategori belum dapat diarsipkan.");
    }
  };

  return (
    <div className="module-page">
      <div className="page-intro module-intro"><div><p className="eyebrow">PENGELOMPOKAN</p><h2>Kategori transaksi</h2><p>Kelompokkan pemasukan dan biaya agar laporan mudah dibaca.</p></div><button className="primary-button compact-button" onClick={openCreate}><CirclePlus size={17} />Tambah kategori</button></div>
      <div className="segmented-control category-switch" role="tablist" aria-label="Jenis kategori"><button className={kind === "expense" ? "segment-active segment-expense" : ""} onClick={() => { setKind("expense"); setEditing(null); }} role="tab" aria-selected={kind === "expense"}><ArrowUpRight size={16} />Pengeluaran<span>{data.categories.filter((item) => item.kind === "expense" && !item.deleted_at).length}</span></button><button className={kind === "income" ? "segment-active segment-income" : ""} onClick={() => { setKind("income"); setEditing(null); }} role="tab" aria-selected={kind === "income"}><ArrowDownLeft size={16} />Pemasukan<span>{data.categories.filter((item) => item.kind === "income" && !item.deleted_at).length}</span></button></div>
      <div className="category-layout">
        <section className="panel category-list-panel"><div className="panel-heading"><div><p className="eyebrow">{kind === "expense" ? "BIAYA USAHA" : "HASIL USAHA"}</p><h3>{kind === "expense" ? "Kategori pengeluaran" : "Kategori pemasukan"}</h3></div><span className="count-pill">{rows.length} kategori</span></div><div className="category-list">{rows.map((category) => <div className="category-row" key={category.id}><span className={kind === "expense" ? "category-row-icon expense-row-icon" : "category-row-icon income-row-icon"}>{kind === "expense" ? <ArrowUpRight size={17} /> : <ArrowDownLeft size={17} />}</span><span className="category-row-copy"><strong>{category.name}</strong><small>{category.is_default ? "Kategori bawaan" : "Kategori usaha"}</small></span><span className="category-transaction-count">{data.transactions.filter((item) => !item.deleted_at && item.category_id === category.id).length} transaksi</span><span className="row-actions"><button className="row-action" onClick={() => openEdit(category)} aria-label={`Ubah ${category.name}`} title="Ubah"><Pencil size={15} /></button><button className="row-action row-action-danger" onClick={() => void remove(category)} aria-label={`Arsipkan ${category.name}`} title="Arsipkan"><Trash2 size={15} /></button></span></div>)}{!rows.length && <div className="empty-row"><Tags size={19} />Belum ada kategori untuk jenis ini.</div>}</div></section>
        <aside className="category-editor panel"><div className="editor-icon"><Tags size={18} /></div><p className="eyebrow">KATEGORI USAHA</p><h3>{editing ? "Ubah nama" : "Tambah baru"}</h3><p className="editor-description">Buat kelompok yang sesuai dengan cara Marindo Farm mencatat usaha.</p><form className="stack-form" onSubmit={submit}><label className="field-label">Jenis transaksi<select value={editing?.kind ?? kind} disabled={Boolean(editing)} onChange={(event) => setKind(event.target.value as TransactionKind)}><option value="expense">Pengeluaran</option><option value="income">Pemasukan</option></select></label><label className="field-label">Nama kategori<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Kebersihan kandang" maxLength={80} required /></label>{error && <p className="form-alert error-alert" role="alert">{error}</p>}<div className="editor-actions">{editing && <button type="button" className="secondary-button" onClick={openCreate}><X size={15} />Batal</button>}<button className="primary-button" type="submit" disabled={busy}><Check size={16} />{busy ? "Menyimpan..." : editing ? "Simpan nama" : "Tambah kategori"}</button></div></form><div className="editor-tip">Kategori bawaan bisa disesuaikan. Mengarsipkan kategori tidak mengubah transaksi lama.</div></aside>
      </div>
    </div>
  );
}