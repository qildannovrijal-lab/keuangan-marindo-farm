"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import Image from "next/image";
import { Building2, Check, CloudDownload, ImagePlus, MapPin, ShieldCheck, Upload, X } from "lucide-react";
import { useFarmData } from "@/lib/farm-data";
import { formatDate } from "@/lib/format";
import type { FarmData, Profile } from "@/lib/domain";
import { profileSchema } from "@/lib/validation";
import type { ExportTable } from "@/lib/report-export";

function createBackupTables(data: FarmData): Record<string, ExportTable> {
  return {
    Profil: { title: "Profil", columns: ["ID", "Nama usaha", "Alamat", "Logo", "Mata uang"], rows: [[data.profile.id, data.profile.business_name, data.profile.address, data.profile.logo_path ?? "", data.profile.currency]] },
    Kategori: { title: "Kategori", columns: ["ID", "Jenis", "Nama", "Bawaan", "Diarsipkan"], rows: data.categories.map((item) => [item.id, item.kind, item.name, item.is_default ? "Ya" : "Tidak", item.deleted_at ?? ""]) },
    Kandang: { title: "Kandang", columns: ["ID", "Nama", "Jenis ternak", "Ekor", "Mulai", "Diarsipkan"], rows: data.pens.map((item) => [item.id, item.name, item.livestock_type, item.head_count, item.start_date, item.deleted_at ?? ""]) },
    Transaksi: { title: "Transaksi", columns: ["ID", "Tanggal", "Jenis", "Kategori ID", "Nominal", "Deskripsi", "Metode", "Kandang ID", "Lampiran", "Catatan", "Diarsipkan", "Dibuat"], rows: data.transactions.map((item) => [item.id, item.transaction_date, item.kind, item.category_id, item.amount, item.description, item.payment_method, item.pen_id ?? "", item.attachment_path ?? "", item.note, item.deleted_at ?? "", item.created_at]) },
    HutangPiutang: { title: "Hutang Piutang", columns: ["ID", "Jenis", "Pihak", "Keterangan", "Nominal", "Terbayar", "Jatuh tempo", "Status", "Dibuat"], rows: data.debts.map((item) => [item.id, item.kind, item.party_name, item.description, item.amount, item.paid_amount, item.due_date ?? "", item.status, item.created_at]) },
    Pembayaran: { title: "Pembayaran", columns: ["ID", "Hutang ID", "Tanggal", "Nominal", "Metode", "Catatan"], rows: data.debtPayments.map((item) => [item.id, item.debt_id, item.payment_date, item.amount, item.payment_method, item.note]) },
    Anggaran: { title: "Anggaran", columns: ["ID", "Bulan", "Kategori ID", "Target"], rows: data.budgets.map((item) => [item.id, item.period_month, item.category_id, item.target_amount]) },
  };
}

function SettingsForm({ profile }: { profile: Profile }) {
  const { data, updateProfile, uploadAsset, getAssetUrl } = useFarmData();
  const [businessName, setBusinessName] = useState(profile.business_name);
  const [address, setAddress] = useState(profile.address);
  const [logoPath, setLogoPath] = useState(profile.logo_path ?? "");
  const [currency, setCurrency] = useState<"IDR">(profile.currency);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(logoPath.startsWith("data:image/") ? logoPath : null);

  useEffect(() => {
    if (!logoPath || logoPath.startsWith("data:image/")) return;
    void getAssetUrl(logoPath).then(setLogoUrl);
  }, [getAssetUrl, logoPath]);

  const selectLogo = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    try {
      if (file.size > 5 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
        throw new Error("Logo harus berupa JPG, PNG, atau WebP dengan ukuran maksimal 5 MB.");
      }
      const nextLogoPath = await uploadAsset(file, "logos");
      setLogoPath(nextLogoPath);
      setLogoUrl(await getAssetUrl(nextLogoPath));
      setMessage("Logo siap disimpan bersama profil usaha.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Logo belum dapat diproses."); }
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(""); setMessage("");
    const parsed = profileSchema.safeParse({ business_name: businessName, address, currency });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Periksa data profil usaha."); return; }
    setBusy(true);
    try {
      await updateProfile({ ...parsed.data, logo_path: logoPath || null });
      setMessage("Profil usaha berhasil disimpan.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Profil belum dapat disimpan."); }
    finally { setBusy(false); }
  };

  const downloadBackup = async () => {
    setBackupBusy(true); setError(""); setMessage("");
    try {
      const { downloadBackupExcel } = await import("@/lib/report-export");
      await downloadBackupExcel(data.profile.business_name, createBackupTables(data));
      setMessage(`Backup dibuat pada ${formatDate(new Date())}.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Backup belum dapat diunduh."); }
    finally { setBackupBusy(false); }
  };

  return (
  <div className="settings-content">
      <section className="panel settings-section"><div className="settings-section-heading"><div className="settings-section-icon"><Building2 size={18} /></div><div><h3>Profil usaha</h3><p>Informasi ini muncul di dashboard dan kop laporan.</p></div></div><form className="settings-form" onSubmit={saveProfile}><label className="field-label">Nama usaha<input value={businessName} onChange={(event) => setBusinessName(event.target.value)} required maxLength={120} /></label><label className="field-label">Alamat usaha<span className="input-wrap"><MapPin size={16} /><input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Alamat kandang atau kantor" maxLength={240} /></span></label><label className="field-label">Mata uang<select value={currency} onChange={(event) => setCurrency(event.target.value as "IDR")}><option value="IDR">Rupiah (IDR)</option></select><small>Format laporan menggunakan Rupiah.</small></label><div className="field-label logo-field">Logo usaha<span className="optional-label">Opsional Â· JPG, PNG, WebP Â· maks. 5 MB</span><div className="logo-upload-row">{(logoPath.startsWith("data:image/") ? logoPath : logoUrl) ? <Image className="logo-preview" src={(logoPath.startsWith("data:image/") ? logoPath : logoUrl)!} alt="Logo Marindo Farm" width={56} height={56} unoptimized /> : <span className="logo-placeholder"><Building2 size={23} /><small>{logoPath ? "Logo tersimpan" : "MF"}</small></span>}<label className="secondary-button upload-logo-button"><ImagePlus size={16} />Pilih logo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void selectLogo(event)} /></label>{logoPath && <button type="button" className="row-action row-action-danger" onClick={() => { setLogoPath(""); setLogoUrl(null); }} aria-label="Hapus logo" title="Hapus logo"><X size={16} /></button>}</div></div>{error && <p className="form-alert error-alert" role="alert">{error}</p>}{message && <p className="form-alert success-alert" role="status">{message}</p>}<div className="settings-save-row"><span><ShieldCheck size={15} />Perubahan hanya berlaku untuk akun ini.</span><button className="primary-button" type="submit" disabled={busy}><Check size={16} />{busy ? "Menyimpan..." : "Simpan profil"}</button></div></form></section>
      <section className="panel settings-section backup-section"><div className="settings-section-heading"><div className="settings-section-icon backup-icon"><CloudDownload size={18} /></div><div><h3>Backup data</h3><p>Unduh salinan data usaha sebelum tutup buku atau pindah perangkat.</p></div></div><div className="backup-copy"><div><strong>Semua catatan Marindo Farm</strong><span>Profil, kategori, kandang, transaksi, hutang/piutang, pembayaran, dan anggaran.</span></div><button className="secondary-button" onClick={() => void downloadBackup()} disabled={backupBusy}><Upload size={15} />{backupBusy ? "Menyiapkan..." : "Unduh backup Excel"}</button></div><p className="backup-note">File Excel mencakup kolom ID untuk rekonsiliasi/pemulihan. Simpan file di tempat aman.</p></section>
    </div>
  );
}

export default function SettingsPage() {
  const { data } = useFarmData();
  return <div className="module-page"><div className="page-intro module-intro"><div><p className="eyebrow">PREFERENSI</p><h2>Pengaturan usaha</h2><p>Atur identitas dan cadangan data Marindo Farm.</p></div></div><SettingsForm key={`${data.profile.id}-${data.profile.business_name}-${data.profile.address}`} profile={data.profile} /></div>;
}
