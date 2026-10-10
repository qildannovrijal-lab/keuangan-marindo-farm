"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeftRight,
  BarChart3,
  Bell,
  Calculator,
  ChevronDown,
  CircleDollarSign,
  Cloud,
  Database,
  LayoutDashboard,
  Leaf,
  LogOut,
  Menu,
  Settings2,
  Sprout,
  Tags,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFarmData } from "@/lib/farm-data";
import { formatCurrency, formatDate } from "@/lib/format";

const mainLinks = [
  { href: "/dashboard", label: "Ringkasan", icon: LayoutDashboard },
  { href: "/transaksi", label: "Transaksi", icon: ArrowLeftRight },
  { href: "/kategori", label: "Kategori", icon: Tags },
  { href: "/kandang", label: "Kandang & batch", icon: Sprout },
  { href: "/hutang-piutang", label: "Hutang & piutang", icon: WalletCards },
  { href: "/anggaran", label: "Anggaran", icon: CircleDollarSign },
  { href: "/laporan", label: "Laporan", icon: BarChart3 },
  { href: "/kalkulator", label: "Kalkulator & Proyeksi", icon: Calculator },
];

const pageNames: Record<string, string> = {
  "/dashboard": "Ringkasan usaha",
  "/transaksi": "Transaksi",
  "/kandang": "Kandang & kelompok ternak",
  "/hutang-piutang": "Hutang & piutang",
  "/anggaran": "Anggaran bulanan",
  "/laporan": "Laporan keuangan",
  "/kalkulator": "Kalkulator & Proyeksi Peternakan",
  "/pengaturan": "Pengaturan usaha",
};

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, ready, mode, data, error, logout, switchMode } = useFarmData();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ready && !user && !(mode === "local" && error)) window.location.replace("/login");
  }, [error, mode, ready, user]);

  // Click outside to close notification popover
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    };
    if (notifOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [notifOpen]);

  if (mode === "local" && ready && !user && error) {
    return (
      <div className="app-loading">
        <span className="form-alert error-alert" role="alert">
          Database tidak dapat dimuat: {error}
        </span>
        <Link className="secondary-button" href="/">
          Coba lagi
        </Link>
      </div>
    );
  }

  if (!ready || !user) {
    return (
      <div className="app-loading" role="status">
        <span className="loading-mark">
          <Image src="/marindo-farm-mark.png" alt="" width={38} height={38} />
        </span>
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

  // Calculate Real-time Notification Items
  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysLater = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const dueDebts = data.debts.filter(
    (d) =>
      d.status !== "paid" &&
      d.due_date &&
      d.due_date <= sevenDaysLater,
  );

  const currentMonthKey = today.slice(0, 7);
  const monthTransactions = data.transactions.filter(
    (t) => !t.deleted_at && t.transaction_date.slice(0, 7) === currentMonthKey,
  );

  const budgetAlerts = data.budgets
    .filter((b) => b.period_month.slice(0, 7) === currentMonthKey)
    .map((b) => {
      const actual = monthTransactions
        .filter((t) => t.kind === "expense" && t.category_id === b.category_id)
        .reduce((sum, t) => sum + Number(t.amount), 0);
      const category = data.categories.find((c) => c.id === b.category_id);
      const pct = Number(b.target_amount) > 0 ? (actual / Number(b.target_amount)) * 100 : 0;
      return {
        ...b,
        actual,
        categoryName: category?.name ?? "Kategori",
        pct,
      };
    })
    .filter((b) => b.pct >= 80);

  const totalAlerts = dueDebts.length + budgetAlerts.length;

  return (
    <div className="app-frame">
      {mobileOpen && (
        <button
          className="mobile-scrim"
          aria-label="Tutup navigasi"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <Link href="/dashboard" className="brand brand-sidebar" onClick={() => setMobileOpen(false)}>
          <span className="brand-mark brand-logo-mark">
            <Image src="/marindo-farm-mark.png" alt="" width={40} height={40} />
          </span>
          <span>
            <strong>KEUANGAN</strong>
            <small>MARINDO FARM</small>
          </span>
        </Link>

        <details className="farm-switcher-menu">
          <summary className="farm-switcher">
            <span className="farm-avatar">
              <Image src="/marindo-farm-mark.png" alt="" width={34} height={34} />
            </span>
            <span className="farm-switch-copy">
              <small>RUANG USAHA</small>
              <strong>{businessName}</strong>
            </span>
            <ChevronDown size={15} className="switch-chevron" />
          </summary>
          <div className="farm-switcher-popover">
            <div className="farm-switcher-account">
              <span className="farm-switcher-role-label">Masuk sebagai</span>
              <strong>{user.email}</strong>
            </div>
            <div className="farm-switcher-cloud-badge">
              <span className="cloud-dot"></span>
              <Cloud size={13} />
              <span>Supabase Cloud Aktif</span>
            </div>
            <button
              className="farm-switcher-logout"
              onClick={() => void signOut()}
              disabled={loggingOut}
            >
              <LogOut size={15} />
              {loggingOut ? "Keluar..." : "Keluar dari akun"}
            </button>
          </div>
        </details>

        <p className="nav-caption">MENU UTAMA</p>
        <nav className="side-nav" aria-label="Navigasi utama">
          {mainLinks.map(({ href, label, icon: Icon }) => {
            const active =
              pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={`side-link ${active ? "side-link-active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={18} strokeWidth={1.9} />
                <span>{label}</span>
                {href === "/transaksi" && (
                  <span className="nav-count">
                    {data.transactions.filter((item) => !item.deleted_at).length}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-spacer" />
        <div className="sidebar-note">
          <div className="sidebar-note-icon">
            <Leaf size={16} />
          </div>
          <div>
            <strong>Catatan tumbuh</strong>
            <span>Keuangan tertata, usaha terjaga.</span>
          </div>
        </div>

        <Link
          href="/pengaturan"
          className={`side-link settings-link ${pathname === "/pengaturan" ? "side-link-active" : ""}`}
          onClick={() => setMobileOpen(false)}
        >
          <Settings2 size={18} strokeWidth={1.9} />
          <span>Pengaturan</span>
        </Link>

        <div className="sidebar-user">
          <span className="user-avatar">{user.email.slice(0, 1).toUpperCase()}</span>
          <span className="user-copy">
            <strong>{user.email.split("@")[0]}</strong>
            <small>{user.email}</small>
          </span>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <button
            className="mobile-menu-button"
            onClick={() => setMobileOpen(true)}
            aria-label="Buka navigasi"
          >
            <Menu size={21} />
          </button>
          <div className="topbar-title">
            <span className="topbar-overline">Keuangan Marindo Farm â€¢ {businessName}</span>
            <h1>{currentTitle}</h1>
          </div>
          <div className="topbar-actions">
            <div className="cloud-status-indicator" title="Tersambung ke Supabase Cloud">
              <span className="cloud-status-dot" />
              <Cloud size={13} />
              <span>Supabase Cloud</span>
            </div>

            {/* Notification Bell with Dropdown */}
            <div className="notification-wrapper" ref={notifRef}>
              <button
                className="notification-button"
                aria-label="Notifikasi"
                title="Notifikasi"
                onClick={() => setNotifOpen(!notifOpen)}
              >
                <Bell size={18} />
                {totalAlerts > 0 && <i className="notif-badge-dot" />}
              </button>

              {notifOpen && (
                <div className="notification-popover">
                  <div className="notif-header">
                    <div className="notif-title">
                      <strong>Pemberitahuan Usaha</strong>
                      {totalAlerts > 0 && <span className="notif-count-badge">{totalAlerts}</span>}
                    </div>
                    <button
                      className="notif-close-btn"
                      onClick={() => setNotifOpen(false)}
                      aria-label="Tutup"
                    >
                      <X size={15} />
                    </button>
                  </div>

                  <div className="notif-body">
                    {totalAlerts === 0 ? (
                      <div className="notif-empty">
                        <Leaf size={20} className="text-forest" />
                        <p>Semua indikator keuangan dalam kondisi aman.</p>
                      </div>
                    ) : (
                      <div className="notif-list">
                        {dueDebts.map((debt) => (
                          <Link
                            key={debt.id}
                            href="/hutang-piutang"
                            onClick={() => setNotifOpen(false)}
                            className="notif-item"
                          >
                            <span className="notif-item-icon notif-icon-debt">
                              <AlertTriangle size={15} />
                            </span>
                            <div className="notif-item-text">
                              <strong>
                                {debt.kind === "payable" ? "Hutang" : "Piutang"}: {debt.party_name}
                              </strong>
                              <span>
                                Sisa {formatCurrency(Number(debt.amount) - Number(debt.paid_amount))} â€¢ Jatuh tempo{" "}
                                {debt.due_date ? formatDate(debt.due_date) : "-"}
                              </span>
                            </div>
                          </Link>
                        ))}

                        {budgetAlerts.map((b) => (
                          <Link
                            key={b.id}
                            href="/anggaran"
                            onClick={() => setNotifOpen(false)}
                            className="notif-item"
                          >
                            <span className="notif-item-icon notif-icon-budget">
                              <AlertTriangle size={15} />
                            </span>
                            <div className="notif-item-text">
                              <strong>Anggaran: {b.categoryName}</strong>
                              <span>
                                Terpakai {Math.round(b.pct)}% ({formatCurrency(b.actual)} dari{" "}
                                {formatCurrency(Number(b.target_amount))})
                              </span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <span className="topbar-avatar">{user.email.slice(0, 1).toUpperCase()}</span>
          </div>
        </header>

        {error && (
          <div className="app-error" role="alert">
            {error}
          </div>
        )}
        <main className="page-content">{children}</main>
        <footer className="app-footer">
          <span>Â© 2026 Keuangan Marindo Farm</span>
          <span>Catat hari ini, rencanakan esok.</span>
        </footer>
      </div>

      <nav className="mobile-nav" aria-label="Navigasi cepat">
        {mainLinks.slice(0, 5).map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={active ? "mobile-link mobile-link-active" : "mobile-link"}
            >
              <Icon size={19} />
              <span>
                {label === "Ringkasan"
                  ? "Home"
                  : label === "Hutang & piutang"
                    ? "Hutang"
                    : label === "Kandang & batch"
                      ? "Kandang"
                      : label === "Kalkulator & Proyeksi"
                        ? "Kalkulator"
                        : label}
              </span>
            </Link>
          );
        })}
        <button className="mobile-link" onClick={() => setMobileOpen(true)}>
          <Menu size={19} />
          <span>Lainnya</span>
        </button>
      </nav>
    </div>
  );
}
