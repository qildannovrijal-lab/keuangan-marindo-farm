"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("Memverifikasi email Anda…");
  const [failed, setFailed] = useState(false);

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
      if (authError) {
        if (active) {
          setMessage("Tautan konfirmasi tidak dapat digunakan. Coba masuk atau minta tautan konfirmasi baru.");
          setFailed(true);
        }
        return;
      }

      const code = params.get("code");
      if (code) {
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
      const destination = nextPath === "/reset-password" ? nextPath : "/dashboard";
      window.location.replace(destination);
    };

    void completeSignIn();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="auth-layout">
      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-heading">
            <p className="eyebrow">KEUANGAN MARINDO FARM</p>
            <h2>{failed ? "Konfirmasi belum selesai" : "Konfirmasi email"}</h2>
            <p className="auth-intro" role={failed ? "alert" : "status"}>{message}</p>
          </div>
          {failed && <div className="auth-switch"><Link href="/login">Ke halaman masuk</Link></div>}
        </div>
      </section>
    </main>
  );
}
