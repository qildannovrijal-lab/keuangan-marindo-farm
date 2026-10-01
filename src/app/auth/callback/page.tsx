"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("Memverifikasi email Anda…");
  const [failed, setFailed] = useState(false);
  const [email, setEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  useEffect(() => {
    let active = true;

    const completeSignIn = async () => {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        if (active) {
          setMessage("Konfigurasi login belum tersedia. Buka aplikasi dari alamat publik yang benar.");
          setFailed(true);
        }
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const authError = params.get("error_description") ?? params.get("error");
      const tokenHash = params.get("token_hash");
      const otpType = params.get("type");
      if (authError) {
        if (active) {
          setMessage("Tautan konfirmasi tidak dapat digunakan. Coba masuk atau minta tautan konfirmasi baru.");
          setFailed(true);
        }
        return;
      }

      if (tokenHash && (otpType === "email" || otpType === "recovery")) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: otpType as EmailOtpType,
        });
        if (error) {
          if (active) {
            setMessage("Tautan konfirmasi sudah kedaluwarsa atau pernah digunakan. Minta tautan baru di bawah.");
            setFailed(true);
          }
          return;
        }
      }

      const code = params.get("code");
      if (!tokenHash && code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          if (active) {
            setMessage("Tautan konfirmasi sudah kedaluwarsa atau pernah digunakan. Masuk atau daftar ulang untuk menerima tautan baru.");
            setFailed(true);
          }
          return;
        }
      }

      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        if (active) {
          setMessage("Sesi konfirmasi tidak ditemukan. Coba masuk; jika belum bisa, minta tautan konfirmasi baru.");
          setFailed(true);
        }
        return;
      }

      const nextPath = params.get("next");
      const destination = nextPath === "/reset-password" || otpType === "recovery" ? "/reset-password" : "/dashboard";
      window.location.replace(destination);
    };

    void completeSignIn();
    return () => {
      active = false;
    };
  }, []);

  const resendConfirmation = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setResending(true);
    setResendMessage("");
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setResendMessage("Layanan login belum tersedia. Coba lagi nanti.");
      setResending(false);
      return;
    }

    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setResendMessage(error ? "Tautan belum bisa dikirim. Periksa alamat email lalu coba lagi." : "Jika akun belum dikonfirmasi, tautan baru segera dikirim. Periksa kotak masuk dan folder spam.");
    setResending(false);
  };

  return (
    <main className="auth-layout">
      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-heading">
            <p className="eyebrow">KEUANGAN MARINDO FARM</p>
            <h2>{failed ? "Konfirmasi belum selesai" : "Konfirmasi email"}</h2>
            <p className="auth-intro" role={failed ? "alert" : "status"}>{message}</p>
          </div>
          {failed && <>
            <form className="auth-form" onSubmit={resendConfirmation}>
              <label className="field-label">Email pendaftaran
                <span className="input-wrap"><input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@email.com" /></span>
              </label>
              {resendMessage && <p className="form-alert success-alert" role="status">{resendMessage}</p>}
              <button className="primary-button auth-submit" type="submit" disabled={resending}>{resending ? "Mengirim..." : "Kirim ulang tautan konfirmasi"}</button>
            </form>
            <div className="auth-switch"><Link href="/login">Ke halaman masuk</Link></div>
          </>}
        </div>
      </section>
    </main>
  );
}
