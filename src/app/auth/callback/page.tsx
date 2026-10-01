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
      const isRecovery = params.get("next") === "/reset-password" || otpType === "recovery";
      if (authError) {
        if (!isRecovery) {
          window.location.replace("/login?confirmation=link");
          return;
        }
        if (active) {
          setMessage("Tautan konfirmasi ini sudah kedaluwarsa atau pernah dibuka. Coba masuk ke akun; jika berhasil, akun siap digunakan dan Anda tidak perlu tautan baru.");
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
          if (otpType === "email") {
            window.location.replace("/login?confirmation=link");
            return;
          }
          if (active) {
            setMessage("Tautan konfirmasi ini sudah kedaluwarsa atau pernah dibuka. Coba masuk ke akun; jika berhasil, akun siap digunakan dan Anda tidak perlu tautan baru.");
            setFailed(true);
          }
          return;
        }
      }

      const code = params.get("code");
      if (!tokenHash && code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          if (!isRecovery) {
            // Supabase has already verified the email before redirecting with this code.
            // A PKCE verifier may be missing when the link was opened on another device.
            window.location.replace("/login?confirmation=confirmed");
            return;
          }
          if (active) {
            setMessage("Tautan konfirmasi ini sudah kedaluwarsa, pernah dibuka, atau dibuka di perangkat lain. Coba masuk ke akun; jika berhasil, akun siap digunakan dan Anda tidak perlu tautan baru.");
            setFailed(true);
          }
          return;
        }
      }

      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        if (!isRecovery && (code || (tokenHash && otpType === "email"))) {
          window.location.replace("/login?confirmation=confirmed");
          return;
        }
        if (active) {
          setMessage("Sesi tidak terbentuk dari tautan ini. Coba masuk ke akun; jika berhasil, akun siap digunakan. Jika belum, minta tautan konfirmasi baru.");
          setFailed(true);
        }
        return;
      }

      const destination = isRecovery ? "/reset-password" : "/dashboard";
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
            <h2>{failed ? "Tautan konfirmasi lama" : "Konfirmasi email"}</h2>
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
