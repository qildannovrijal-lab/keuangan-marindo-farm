"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Leaf, LockKeyhole, Mail, Sprout } from "lucide-react";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { loginSchema, signUpSchema } from "@/lib/validation";

type AuthMode = "login" | "signup" | "forgot" | "reset";

const copy: Record<AuthMode, { eyebrow: string; title: string; description: string; button: string }> = {
  login: {
    eyebrow: "SELAMAT DATANG KEMBALI",
    title: "Panen rapi,\nkeuangan terkendali.",
    description: "Catat hasil usaha Marindo Farm hari ini, dan lihat perkembangannya dengan jelas.",
    button: "Masuk ke akun",
  },
  signup: {
    eyebrow: "MULAI MENCATAT",
    title: "Usaha tumbuh,\ncatatan ikut tertata.",
    description: "Buat akun untuk menyimpan transaksi, kandang, dan laporan usaha Anda.",
    button: "Buat akun",
  },
  forgot: {
    eyebrow: "PEMULIHAN AKUN",
    title: "Kita pulihkan\naksesnya.",
    description: "Masukkan email akun Anda. Kami akan mengirimkan tautan untuk mengatur ulang kata sandi.",
    button: "Kirim tautan pemulihan",
  },
  reset: {
    eyebrow: "KATA SANDI BARU",
    title: "Akses aman,\nlanjutkan usaha.",
    description: "Gunakan kata sandi yang kuat dan mudah Anda ingat.",
    button: "Simpan kata sandi",
  },
};

type ConfirmationNotice = "confirmed" | "link";

export function AuthForm({ mode, confirmationNotice = null }: { mode: AuthMode; confirmationNotice?: ConfirmationNotice | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("Marindo Farm");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState(confirmationNotice === "confirmed"
    ? "Email sudah dikonfirmasi. Silakan masuk dengan email dan kata sandi Anda."
    : confirmationNotice === "link"
      ? "Tautan tidak berlaku atau sudah pernah dibuka. Coba masuk dahulu; jika belum bisa, kirim tautan baru."
      : "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmationPending, setConfirmationPending] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  useEffect(() => {
    if (!confirmationPending || resendCountdown <= 0) return;
    const timer = window.setTimeout(() => setResendCountdown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [confirmationPending, resendCountdown]);

  const resendConfirmation = async () => {
    setError("");
    setBusy(true);
    const parsed = loginSchema.shape.email.safeParse(email);
    if (!parsed.success) {
      setError("Masukkan alamat email yang digunakan saat mendaftar.");
      setBusy(false);
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Layanan login belum tersedia. Coba lagi nanti.");
      setBusy(false);
      return;
    }
    const { error: authError } = await supabase.auth.resend({
      type: "signup",
      email: parsed.data,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (authError) {
      setError("Tautan belum bisa dikirim. Periksa alamat email lalu coba lagi.");
    } else {
      setMessage("Jika akun belum dikonfirmasi, tautan baru segera dikirim. Periksa kotak masuk dan folder spam.");
      if (confirmationPending) setResendCountdown(60);
    }
    setBusy(false);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!isSupabaseConfigured) {
      if (mode === "login" && process.env.NODE_ENV !== "production") {
        window.location.assign(new URL("/dashboard", window.location.origin));
        return;
      }
      setError("Login online belum aktif. Konfigurasikan Supabase sebelum menjalankan aplikasi publik.");
      return;
    }

    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    setBusy(true);

    try {
      if (mode === "login") {
        const parsed = loginSchema.safeParse({ email, password });
        if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Periksa data masuk.");
        const { error: authError } = await supabase.auth.signInWithPassword(parsed.data);
        if (authError) throw authError;
        window.location.assign(new URL("/dashboard", window.location.origin));
      } else if (mode === "signup") {
        const parsed = signUpSchema.safeParse({ email, password, businessName });
        if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Periksa data pendaftaran.");
        const { data: signUpData, error: authError } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            data: { business_name: parsed.data.businessName },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (authError) throw authError;
        if (signUpData.session) {
          window.location.assign(new URL("/dashboard", window.location.origin));
          return;
        }
        setConfirmationPending(true);
        setResendCountdown(60);
        setMessage(`Tautan konfirmasi sudah dikirim ke ${parsed.data.email}. Buka email tersebut untuk mengaktifkan akun. Setelah konfirmasi berhasil, Anda akan diarahkan ke aplikasi.`);
      } else if (mode === "forgot") {
        const parsed = loginSchema.shape.email.safeParse(email);
        if (!parsed.success) throw new Error("Masukkan email yang valid.");
        const { error: authError } = await supabase.auth.resetPasswordForEmail(parsed.data, {
          redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
        });
        if (authError) throw authError;
        setMessage("Jika email terdaftar, tautan pemulihan akan segera dikirim.");
      } else {
        const parsed = zPassword.safeParse(password);
        if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Kata sandi belum valid.");
        const { error: authError } = await supabase.auth.updateUser({ password: parsed.data });
        if (authError) throw authError;
        setMessage("Kata sandi berhasil diperbarui. Anda dapat masuk kembali.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Terjadi kesalahan. Coba lagi.");
    } finally {
      setBusy(false);
    }
  };

  const text = copy[mode];
  const localMode = !isSupabaseConfigured;
  const localDevelopment = localMode && process.env.NODE_ENV !== "production";
  const needsPassword = mode !== "forgot" && (!localMode || !localDevelopment);

  return (
    <main className="auth-layout">
      <section className="auth-story" aria-label="Keuangan Marindo Farm">
        <Link href="/login" className="brand brand-light" onClick={(event) => { if (confirmationPending) event.preventDefault(); }} aria-disabled={confirmationPending}>
          <span className="brand-mark brand-logo-mark"><Image src="/marindo-farm-mark.png" alt="" width={40} height={40} /></span>
          <span><strong>KEUANGAN</strong><small>MARINDO FARM</small></span>
        </Link>
        <div className="story-copy">
          <p className="eyebrow">{text.eyebrow}</p>
          <h1>{text.title.split("\n").map((line) => <span key={line}>{line}</span>)}</h1>
          <p>{text.description}</p>
        </div>
        <div className="story-foot"><span className="story-dot" />Dibuat untuk usaha yang terus bertumbuh</div>
        <div className="story-orbit orbit-one" />
        <div className="story-orbit orbit-two" />
        <Leaf className="story-leaf" size={126} strokeWidth={0.7} />
      </section>

      <section className="auth-panel">
        <div className="auth-topline">
          {confirmationPending ? <span /> : <Link href="/" className="back-link"><ArrowLeft size={16} /> Beranda</Link>}
          <span className="secure-label"><LockKeyhole size={13} /> Ruang usaha pribadi</span>
        </div>
        <div className="auth-card">
          <div className="auth-heading">
            <div className="auth-icon"><Image src="/marindo-farm-mark.png" alt="" width={40} height={40} /></div>
            <p className="eyebrow">KEUANGAN MARINDO FARM</p>
            <h2>{confirmationPending ? "Konfirmasi email" : localDevelopment && mode === "login" ? "Buka ruang usaha" : mode === "login" ? "Masuk ke akun" : mode === "signup" ? "Daftar usaha" : mode === "forgot" ? "Lupa kata sandi?" : "Atur ulang kata sandi"}</h2>
            <p className="auth-intro">{confirmationPending ? "Selesaikan konfirmasi untuk mengaktifkan akun." : localDevelopment && mode === "login" ? "Database SQLite lokal untuk penggunaan di komputer ini." : mode === "signup" ? "Buat ruang pencatatan khusus untuk usaha Anda." : mode === "login" ? "Lanjutkan mengelola catatan usaha Anda." : text.description}</p>
          </div>

          {confirmationPending && mode === "signup" ? (
            <div className="confirmation-pending" role="status" aria-live="polite">
              <div className="confirmation-email-icon"><Mail size={22} /></div>
              <h3>Buka tautan konfirmasi</h3>
              <p>{message}</p>
              <button className="primary-button auth-submit" type="button" onClick={() => void resendConfirmation()} disabled={busy || resendCountdown > 0}>
                {busy ? "Mengirim tautan..." : resendCountdown > 0 ? `Kirim ulang dalam ${String(Math.floor(resendCountdown / 60)).padStart(2, "0")}:${String(resendCountdown % 60).padStart(2, "0")}` : "Kirim ulang konfirmasi"}
              </button>
              {error && <p className="form-alert error-alert" role="alert">{error}</p>}
              <p className="confirmation-help">Buka tautan dari email untuk menyelesaikan pendaftaran. Periksa juga folder spam.</p>
            </div>
          ) : <form className="auth-form" onSubmit={submit}>
            {mode === "signup" && (
              <label className="field-label">Nama usaha
                <span className="input-wrap"><Sprout size={17} /><input autoComplete="organization" value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="Marindo Farm" /></span>
              </label>
            )}
            {mode !== "reset" && (!localMode || !localDevelopment) && (
              <label className="field-label">Email
                <span className="input-wrap"><Mail size={17} /><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@email.com" /></span>
              </label>
            )}
            {needsPassword && (
              <label className="field-label">Kata sandi
                <span className="input-wrap"><LockKeyhole size={17} /><input type={showPassword ? "text" : "password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimal 8 karakter" /><button type="button" className="icon-button" aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"} onClick={() => setShowPassword((shown) => !shown)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span>
              </label>
            )}
            {mode === "login" && (!localMode || !localDevelopment) && <Link className="forgot-link" href="/lupa-password">Lupa kata sandi?</Link>}
            {mode === "login" && confirmationNotice === "link" && <button className="forgot-link" type="button" onClick={() => void resendConfirmation()} disabled={busy}>Kirim ulang tautan konfirmasi</button>}
            {error && <p className="form-alert error-alert" role="alert">{error}</p>}
            {message && <p className="form-alert success-alert" role="status">{message}</p>}
            <button className="primary-button auth-submit" type="submit" disabled={busy || (localMode && !localDevelopment)}>
              {busy ? "Memproses..." : localDevelopment && mode === "login" ? "Buka ruang usaha" : text.button}<ArrowRight size={17} />
            </button>
            {localDevelopment && mode === "login" && <p className="demo-note">Database SQLite tersimpan di komputer ini. Untuk login dan akses dari mana saja, hubungkan Supabase.</p>}
            {localMode && !localDevelopment && <p className="form-alert error-alert" role="status">Aplikasi publik memerlukan Supabase. Set URL dan publishable key Supabase, lalu terapkan migration.</p>}
          </form>}

          {!confirmationPending && <div className="auth-switch">
            {localDevelopment ? mode !== "login" && <Link href="/login">Kembali ke halaman database lokal</Link> : mode === "login" ? <>Belum punya akun? <Link href="/daftar">Daftar sekarang</Link></> : mode === "signup" ? <>Sudah memiliki akun? <Link href="/login">Masuk</Link></> : <Link href="/login">Kembali ke halaman masuk</Link>}
          </div>}
        </div>
        <footer className="auth-footer"><span>© 2026 Keuangan Marindo Farm</span><span>Data usaha Anda, kendali Anda.</span></footer>
      </section>
    </main>
  );
}

const zPassword = loginSchema.shape.password;
