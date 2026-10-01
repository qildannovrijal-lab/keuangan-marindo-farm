"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  ChevronDown,
  CircleDollarSign,
  LayoutDashboard,
  Leaf,
  LogOut,
  Menu,
  Settings2,
  Sprout,
  Tags,
  WalletCards,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useFarmData } from "@/lib/farm-data";

const mainLinks = [
  { href: "/dashboard", label: "Ringkasan", icon: LayoutDashboard },
  { href: "/transaksi", label: "Transaksi", icon: ArrowLeftRight },
  { href: "/kategori", label: "Kategori", icon: Tags },
  { href: "/kandang", label: "Kandang & batch", icon: Sprout },
  { href: "/hutang-piutang", label: "Hutang & piutang", icon: WalletCards },
  { href: "/anggaran", label: "Anggaran", icon: CircleDollarSign },
  { href: "/laporan", label: "Laporan", icon: BarChart3 },
];

const pageNames: Record<string, string> = {
  "/dashboard": "Ringkasan usaha",
  "/transaksi": "Transaksi",
  "/kandang": "Kandang & kelompok ternak",
  "/hutang-piutang": "Hutang & piutang",
  "/anggaran": "Anggaran bulanan",
  "/laporan": "Laporan keuangan",
  "/pengaturan": "Pengaturan usaha",
};

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, ready, mode, data, error, logout } = useFarmData();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (ready && !user && !(mode === "local" && error)) window.location.replace("/login");
  }, [error, mode, ready, user]);

  if (mode === "local" && ready && !user && error) {
    return <div className="app-loading"><span className="form-alert error-alert" role="alert">Database tidak dapat dimuat: {error}</span><Link className="secondary-button" href="/">Coba lagi</Link></div>;
  }

  if (!ready || !user) {
    return (
      <div className="app-loading" role="status">
        <span className="loading-mark"><Sprout size={22} /></span>
        <span>Menyiapkan ruang usaha...</span>
      </div>
    );
  }

  const businessName = data.profile.business_name || user.businessName || "Marindo Farm";
  const currentTitle = pageNames[pathname] ?? "Keuangan Marindo Farm";

  const signOut = async () => {
    setLoggingOut(true);
    await logout();
    window.location.replace("/login");
  };

  return (
    <div className="app-frame">
      {mobileOpen && <button className="mobile-scrim" aria-label="Tutup navigasi" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <Link href="/dashboard" className="brand brand-sidebar" onClick={() => setMobileOpen(false)}>
          <span className="brand-mark brand-logo-mark"><Image src="/marindo-farm-mark.png" alt="" width={40} height={40} /></span>
          <span><strong>KEUANGAN</strong><small>MARINDO FARM</small></span>
        </Link>
        <div className="farm-switcher">
          <span className="farm-avatar">{businessName.slice(0, 1).toUpperCase()}</span>
          <span className="farm-switch-copy"><small>RUANG USAHA</small><strong>{businessName}</strong></span>
          <ChevronDown size={15} className="switch-chevron" />
        </div>
        <p className="nav-caption">MENU UTAMA</p>
        <nav className="side-nav" aria-label="Navigasi utama">
          {mainLinks.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
            return (
              <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={`side-link ${active ? "side-link-active" : ""}`} aria-current={active ? "page" : undefined}>
                <Icon size={18} strokeWidth={1.9} />
                <span>{label}</span>
                {href === "/transaksi" && <span className="nav-count">{data.transactions.filter((item) => !item.deleted_at).length}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-note">
          <div className="sidebar-note-icon"><Leaf size={16} /></div>
          <div><strong>Catatan tumbuh</strong><span>Keuangan tertata, usaha terjaga.</span></div>
        </div>
        <Link href="/pengaturan" className={`side-link settings-link ${pathname === "/pengaturan" ? "side-link-active" : ""}`} onClick={() => setMobileOpen(false)}>
          <Settings2 size={18} strokeWidth={1.9} /><span>Pengaturan</span>
        </Link>
        <div className="sidebar-user">
          <span className="user-avatar">{user.email.slice(0, 1).toUpperCase()}</span>
          <span className="user-copy"><strong>{user.email.split("@")[0]}</strong><small>{user.email}</small></span>
          <button className="logout-button" onClick={signOut} disabled={loggingOut} aria-label="Keluar" title="Keluar">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <button className="mobile-menu-button" onClick={() => setMobileOpen(true)} aria-label="Buka navigasi"><Menu size={21} /></button>
          <div className="topbar-title"><span className="topbar-overline">Keuangan Marindo Farm · {businessName}</span><h1>{currentTitle}</h1></div>
          <div className="topbar-actions">
            <span className="sync-status"><span />Data tersinkron</span>
            <button className="notification-button" aria-label="Notifikasi" title="Notifikasi"><Bell size={18} /><i /></button>
            <span className="topbar-avatar">{user.email.slice(0, 1).toUpperCase()}</span>
          </div>
        </header>
        {error && <div className="app-error" role="alert">{error}</div>}
        <main className="page-content">{children}</main>
        <footer className="app-footer"><span>© 2026 Keuangan Marindo Farm</span><span>Catat hari ini, rencanakan esok.</span></footer>
      </div>

      <nav className="mobile-nav" aria-label="Navigasi cepat">
        {mainLinks.slice(0, 4).map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return <Link key={href} href={href} className={active ? "mobile-link mobile-link-active" : "mobile-link"}><Icon size={19} /><span>{label === "Ringkasan" ? "Home" : label === "Hutang & piutang" ? "Hutang" : label}</span></Link>;
        })}
        <button className="mobile-link" onClick={() => setMobileOpen(true)}><Menu size={19} /><span>Lainnya</span></button>
      </nav>
    </div>
  );
}
