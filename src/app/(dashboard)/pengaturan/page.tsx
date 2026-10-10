"use client";

import { useState, useEffect, type ChangeEvent, type FormEvent } from "react";
import Image from "next/image";
import {
  Building2,
  Check,
  Cloud,
  CloudDownload,
  Database,
  FileCode,
  FileSpreadsheet,
  ImagePlus,
  MapPin,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { useFarmData } from "@/lib/farm-data";
import { formatDate } from "@/lib/format";
import type { FarmData, Profile } from "@/lib/domain";
import { profileSchema } from "@/lib/validation";
import type { ExportTable } from "@/lib/report-export";

function createBackupTables(data: FarmData): Record<string, ExportTable> {
  return {
    Profil: {
      title: "Profil",
      columns: ["ID", "Nama Usaha", "Alamat", "Mata Uang"],
      rows: [[data.profile.id, data.profile.business_name, data.profile.address, data.profile.currency]],
    },
    Kategori: {
      title: "Kategori",
      columns: ["ID", "Jenis", "Nama", "Bawaan", "Diarsipkan"],
      rows: data.categories.map((item) => [
        item.id,
        item.kind,
        item.name,
        item.is_default ? "Ya" : "Tidak",
        item.deleted_at ?? "",
      ]),
    },
    Kandang: {
      title: "Kandang",
      columns: ["ID", "Nama", "Jenis ternak", "Ekor", "Mulai", "Diarsipkan"],
      rows: data.pens.map((item) => [
        item.id,
        item.name,
        item.livestock_type,
        item.head_count,
        item.start_date,
        item.deleted_at ?? "",
      ]),
    },
    Transaksi: {
      title: "Transaksi",
      columns: [
        "ID",
        "Tanggal",
        "Jenis",
        "Kategori ID",
        "Nominal",
        "Deskripsi",
        "Metode",
        "Kandang ID",
        "Lampiran",
        "Catatan",
        "Diarsipkan",
        "Dibuat",
      ],
      rows: data.transactions.map((item) => [
        item.id,
        item.transaction_date,
        item.kind,
        item.category_id,
        item.amount,
        item.description,
        item.payment_method,
        item.pen_id ?? "",
        item.attachment_path ?? "",
        item.note,
        item.deleted_at ?? "",
        item.created_at,
      ]),
    },
    HutangPiutang: {
      title: "Hutang Piutang",
      columns: [
        "ID",
        "Jenis",
        "Pihak",
        "Keterangan",
        "Nominal",
        "Terbayar",
        "Jatuh tempo",
        "Status",
        "Dibuat",
      ],
      rows: data.debts.map((item) => [
        item.id,
        item.kind,
        item.party_name,
        item.description,
        item.amount,
        item.paid_amount,
        item.due_date ?? "",
        item.status,
        item.created_at,
      ]),
    },
    Pembayaran: {
      title: "Pembayaran",
      columns: ["ID", "Hutang ID", "Tanggal", "Nominal", "Metode", "Catatan"],
      rows: data.debtPayments.map((item) => [
        item.id,
        item.debt_id,
        item.payment_date,
        item.amount,
        item.payment_method,
        item.note,
      ]),
    },
    Anggaran: {
      title: "Anggaran",
      columns: ["ID", "Bulan", "Kategori ID", "Target"],
      rows: data.budgets.map((item) => [
        item.id,
        item.period_month,
        item.category_id,
        item.target_amount,
      ]),
    },
  };
}

function SettingsForm({ profile }: { profile: Profile }) {
  const { data, mode, updateProfile, uploadAsset, getAssetUrl, switchMode, importBackupData, resetToDemoData } =
    useFarmData();
  const [businessName, setBusinessName] = useState(profile.business_name);
  const [address, setAddress] = useState(profile.address);
  const [logoPath, setLogoPath] = useState(profile.logo_path ?? "");
  const [currency, setCurrency] = useState<"IDR">(profile.currency);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(
    logoPath.startsWith("data:image/") ? logoPath : null,
  );

  useEffect(() => {
    if (!logoPath || logoPath.startsWith("data:image/")) return;
    void getAssetUrl(logoPath).then(setLogoUrl);
  }, [getAssetUrl, logoPath]);

  const selectLogo = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    try {
      if (
        file.size > 5 * 1024 * 1024 ||
        !["image/png", "image/jpeg", "image/webp"].includes(file.type)
      ) {
        throw new Error("Logo harus berupa JPG, PNG, atau WebP dengan ukuran maksimal 5 MB.");
      }
      const nextLogoPath = await uploadAsset(file, "logos");
      setLogoPath(nextLogoPath);
      setLogoUrl(await getAssetUrl(nextLogoPath));
      setMessage("Logo siap disimpan bersama profil usaha.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Logo belum dapat diproses.");
    }
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    const parsed = profileSchema.safeParse({ business_name: businessName, address, currency });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Periksa data profil usaha.");
      return;
    }
    setBusy(true);
    try {
      await updateProfile({ ...parsed.data, logo_path: logoPath || null });
      setMessage("Profil usaha berhasil disimpan.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Profil belum dapat disimpan.");
    } finally {
      setBusy(false);
    }
  };

  const downloadBackupExcelFile = async () => {
    setBackupBusy(true);
    setError("");
    setMessage("");
    try {
      const { downloadBackupExcel } = await import("@/lib/report-export");
      await downloadBackupExcel(data.profile.business_name, createBackupTables(data));
      setMessage(`Backup Excel dibuat pada ${formatDate(new Date())}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Backup belum dapat diunduh.");
    } finally {
      setBackupBusy(false);
    }
  };

  const downloadBackupJsonFile = () => {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `backup-${data.profile.business_name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("Cadangan data JSON berhasil diunduh.");
  };

  const handleImportJson = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as FarmData;
        if (!parsed.categories || !parsed.transactions) {
          throw new Error("Format file JSON cadangan tidak sesuai.");
        }
        if (
          !window.confirm(
            `Pulihkan data dari cadangan ini? Data saat ini akan digantikan dengan ${parsed.transactions.length} transaksi dan ${parsed.pens.length} kandang dari file cadangan.`,
          )
        ) {
          return;
        }
        await importBackupData(parsed);
        setMessage("Data berhasil dipulihkan dari cadangan JSON!");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal membaca file cadangan.");
      }
    };
    reader.readAsText(file);
  };

  const handleResetDemo = async () => {
    if (
      !window.confirm(
        "Muat ulang data sampel resmi Marindo Farm? Ini akan mengisi data simulasi kandang broiler, layer, kambing, transaksi, dan anggaran 3 bulan untuk pengujian.",
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await resetToDemoData();
      setMessage("Data sampel Marindo Farm berhasil dimuat!");
    } catch (err) {
      setError("Gagal memuat data sampel.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="settings-content">
      {/* 1. Profile Section */}
      <section className="panel settings-section">
        <div className="settings-section-heading">
          <div className="settings-section-icon">
            <Building2 size={18} />
          </div>
          <div>
            <h3>Profil usaha</h3>
            <p>Informasi ini muncul di dashboard, kop kwitansi, dan dokumen laporan.</p>
          </div>
        </div>

        <form className="settings-form" onSubmit={saveProfile}>
          <label className="field-label">
            Nama usaha
            <input
              value={businessName}
              onChange={(event) => setBusinessName(event.target.value)}
              required
              maxLength={120}
            />
          </label>

          <label className="field-label">
            Alamat usaha
            <span className="input-wrap">
              <MapPin size={16} />
              <input
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="Alamat kandang atau kantor peternakan"
                maxLength={240}
              />
            </span>
          </label>

          <label className="field-label">
            Mata uang
            <select
              value={currency}
              onChange={(event) => setCurrency(event.target.value as "IDR")}
            >
              <option value="IDR">Rupiah (IDR)</option>
            </select>
            <small>Format laporan dan kwitansi menggunakan standar Rupiah Indonesia.</small>
          </label>

          <div className="field-label logo-field">
            Logo usaha
            <span className="optional-label">Opsional â€¢ JPG, PNG, WebP â€¢ maks. 5 MB</span>
            <div className="logo-upload-row">
              {(logoPath.startsWith("data:image/") ? logoPath : logoUrl) ? (
                <Image
                  className="logo-preview"
                  src={(logoPath.startsWith("data:image/") ? logoPath : logoUrl)!}
                  alt="Logo Marindo Farm"
                  width={56}
                  height={56}
                  unoptimized
                />
              ) : (
                <Image
                  className="logo-preview"
                  src="/marindo-farm-mark.png"
                  alt="Logo Marindo Farm"
                  width={56}
                  height={56}
                />
              )}
              <label className="secondary-button upload-logo-button">
                <ImagePlus size={16} />
                Pilih logo
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => void selectLogo(event)}
                />
              </label>
              {logoPath && (
                <button
                  type="button"
                  className="row-action row-action-danger"
                  onClick={() => {
                    setLogoPath("");
                    setLogoUrl(null);
                  }}
                  aria-label="Hapus logo"
                  title="Hapus logo"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {error && (
            <p className="form-alert error-alert" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="form-alert success-alert" role="status">
              {message}
            </p>
          )}

          <div className="settings-save-row">
            <span>
              <ShieldCheck size={15} />
              Perubahan tersimpan aman ke database aktif.
            </span>
            <button className="primary-button" type="submit" disabled={busy}>
              <Check size={16} />
              {busy ? "Menyimpan..." : "Simpan profil"}
            </button>
          </div>
        </form>
      </section>

      {/* 2. Cloud Database Status Section */}
      <section className="panel settings-section">
        <div className="settings-section-heading">
          <div className="settings-section-icon icon-storage">
            <Cloud size={18} />
          </div>
          <div>
            <h3>Database & Sinkronisasi Cloud (Supabase)</h3>
            <p>Data tersimpan di Supabase Cloud secara aman dan dapat diakses dari mana saja.</p>
          </div>
        </div>

        <div className="storage-mode-box">
          <div className="mode-status-line">
            <span>Status Cloud:</span>
            <strong className="status-pill status-paid">
              Supabase Cloud (Online & Tersinkronisasi)
            </strong>
          </div>
          <p className="editor-description">
            Semua catatan keuangan, transaksi, kandang, hutang-piutang, dan profil usaha Marindo Farm otomatis tersimpan aman di cloud Supabase secara real-time dan terlindungi autentikasi.
          </p>
        </div>
      </section>

      {/* 3. Backup & Restore Section */}
      <section className="panel settings-section backup-section">
        <div className="settings-section-heading">
          <div className="settings-section-icon backup-icon">
            <CloudDownload size={18} />
          </div>
          <div>
            <h3>Cadangan & Pemulihan Data (Backup & Restore)</h3>
            <p>Unduh salinan data usaha atau pulihkan data saat pindah komputer.</p>
          </div>
        </div>

        <div className="backup-action-grid">
          <div className="backup-tile">
            <h4>Ekspor Cadangan</h4>
            <p>Unduh seluruh data usaha (transaksi, kandang, hutang, anggaran) untuk arsip aman.</p>
            <div className="tile-btn-row">
              <button
                type="button"
                className="secondary-button"
                onClick={() => void downloadBackupExcelFile()}
                disabled={backupBusy}
              >
                <FileSpreadsheet size={15} />
                {backupBusy ? "Menyiapkan..." : "Unduh Excel (.xlsx)"}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={downloadBackupJsonFile}
              >
                <FileCode size={15} />
                Unduh JSON (.json)
              </button>
            </div>
          </div>

          <div className="backup-tile">
            <h4>Pulihkan Data Cadangan</h4>
            <p>Unggah file JSON cadangan yang pernah Anda unduh untuk memulihkan seluruh catatan.</p>
            <label className="secondary-button upload-backup-btn">
              <Upload size={15} />
              Pilih File Cadangan JSON
              <input type="file" accept=".json,application/json" onChange={handleImportJson} />
            </label>
          </div>
        </div>

        <div className="demo-reset-box">
          <div>
            <strong>Ingin uji coba dengan data simulasi lengkap?</strong>
            <span>Muat ulang data sampel Marindo Farm (broiler, layer, kambing, transaksi 3 bulan).</span>
          </div>
          <button
            type="button"
            className="secondary-button text-forest"
            onClick={handleResetDemo}
            disabled={busy}
          >
            <RotateCcw size={14} />
            Muat Data Sampel Demo
          </button>
        </div>
      </section>
    </div>
  );
}

export default function SettingsPage() {
  const { data } = useFarmData();
  return (
    <div className="module-page">
      <div className="page-intro module-intro">
        <div>
          <p className="eyebrow">PREFERENSI & CADANGAN</p>
          <h2>Pengaturan usaha</h2>
          <p>Atur identitas, mode penyimpanan, dan cadangan data Marindo Farm.</p>
        </div>
      </div>
      <SettingsForm
        key={`${data.profile.id}-${data.profile.business_name}-${data.profile.address}`}
        profile={data.profile}
      />
    </div>
  );
}
