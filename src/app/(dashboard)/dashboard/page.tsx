"use client";

import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CirclePlus,
  Download,
  Ellipsis,
  PackageOpen,
  ReceiptText,
  Wallet,
} from "lucide-react";
import {
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
  BarChart,
} from "recharts";
import { useFarmData } from "@/lib/farm-data";
import { formatCurrency, formatDate } from "@/lib/format";
import type { FarmTransaction } from "@/lib/domain";

const chartColors = ["#174b36", "#e6a342", "#54896e", "#8aa0a0", "#c3d58a", "#b9744d", "#536d5e", "#9dbaad"];

const monthStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const keyOfMonth = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
const displayMonth = (date: Date) => new Intl.DateTimeFormat("id-ID", { month: "short" }).format(date);

const transactionMonth = (value: string) => value.slice(0, 7);

function getMonthData(transactions: FarmTransaction[]) {
  const now = new Date();
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1);
    const key = keyOfMonth(date);
    const monthTransactions = transactions.filter((transaction) => transactionMonth(transaction.transaction_date) === key && !transaction.deleted_at);
    return {
      month: displayMonth(date),
      income: monthTransactions.filter((item) => item.kind === "income").reduce((sum, item) => sum + Number(item.amount), 0),
      expense: monthTransactions.filter((item) => item.kind === "expense").reduce((sum, item) => sum + Number(item.amount), 0),
    };
  });
}

export default function DashboardPage() {
  const { data } = useFarmData();
  const now = new Date();
  const monthKey = keyOfMonth(monthStart(now));
  const monthTransactions = data.transactions.filter((item) => !item.deleted_at && transactionMonth(item.transaction_date) === monthKey);
  const income = monthTransactions.filter((item) => item.kind === "income").reduce((sum, item) => sum + Number(item.amount), 0);
  const expense = monthTransactions.filter((item) => item.kind === "expense").reduce((sum, item) => sum + Number(item.amount), 0);
  const net = income - expense;
  const categoryLookup = new Map(data.categories.map((item) => [item.id, item.name]));
  const penLookup = new Map(data.pens.map((item) => [item.id, item.name]));
  const monthData = getMonthData(data.transactions);
  const expenseByCategory = new Map<string, number>();
  monthTransactions.filter((item) => item.kind === "expense").forEach((item) => {
    const name = categoryLookup.get(item.category_id) ?? "Lain-lain";
    expenseByCategory.set(name, (expenseByCategory.get(name) ?? 0) + Number(item.amount));
  });
  const pieData = Array.from(expenseByCategory, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const recentTransactions = data.transactions.filter((item) => !item.deleted_at).slice().sort((a, b) => b.transaction_date.localeCompare(a.transaction_date)).slice(0, 5);
  const budgetRows = data.budgets.filter((item) => item.period_month.slice(0, 7) === monthKey).map((budget) => {
    const actual = monthTransactions.filter((item) => item.kind === "expense" && item.category_id === budget.category_id).reduce((sum, item) => sum + Number(item.amount), 0);
    return { ...budget, actual, categoryName: categoryLookup.get(budget.category_id) ?? "Kategori" };
  });

  return (
    <div className="dashboard-page">
      <div className="page-intro dashboard-intro">
        <div><p className="eyebrow">PANTAU USAHA</p><h2>Usaha terjaga, angka terbaca.</h2><p>Ringkasan arus keuangan Marindo Farm bulan ini.</p></div>
        <div className="intro-actions"><span className="period-pill"><CalendarDays size={15} />{new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(now)}</span><Link className="primary-button compact-button" href="/transaksi?baru=1"><CirclePlus size={17} />Catat transaksi</Link></div>
      </div>

      <section className="summary-grid" aria-label="Ringkasan bulan ini">
        <article className="summary-card summary-income">
          <div className="summary-top"><span className="summary-icon"><ArrowDownLeft size={18} /></span><span className="summary-label">Total pemasukan</span><button className="quiet-icon" aria-label="Info pemasukan" title="Transaksi pemasukan bulan ini"><Ellipsis size={17} /></button></div>
          <strong className="summary-value">{formatCurrency(income)}</strong><span className="summary-foot"><i>+</i> Hasil usaha bulan ini</span>
        </article>
        <article className="summary-card summary-expense">
          <div className="summary-top"><span className="summary-icon"><ArrowUpRight size={18} /></span><span className="summary-label">Total pengeluaran</span><button className="quiet-icon" aria-label="Info pengeluaran" title="Transaksi pengeluaran bulan ini"><Ellipsis size={17} /></button></div>
          <strong className="summary-value">{formatCurrency(expense)}</strong><span className="summary-foot">Biaya operasional bulan ini</span>
        </article>
        <article className="summary-card summary-net">
          <div className="summary-top"><span className="summary-icon"><Wallet size={18} /></span><span className="summary-label">Laba / rugi bersih</span><span className={net >= 0 ? "trend-pill trend-positive" : "trend-pill trend-negative"}>{net >= 0 ? "Surplus" : "Defisit"}</span></div>
          <strong className="summary-value">{formatCurrency(net)}</strong><span className="summary-foot">Pemasukan dikurangi pengeluaran</span>
        </article>
        <article className="summary-card summary-cash">
          <div className="summary-top"><span className="summary-icon"><CirclePlus size={18} /></span><span className="summary-label">Saldo kas bulan ini</span><button className="quiet-icon" aria-label="Info saldo" title="Arus kas bersih bulan berjalan"><Ellipsis size={17} /></button></div>
          <strong className="summary-value">{formatCurrency(net)}</strong><span className="summary-foot">Arus kas bersih berjalan</span>
        </article>
      </section>

      <section className="charts-grid">
        <article className="panel chart-panel">
          <div className="panel-heading"><div><p className="eyebrow">ARUS KEUANGAN</p><h3>Pemasukan & pengeluaran</h3><span className="panel-subtitle">Perbandingan 12 bulan terakhir</span></div><Link className="panel-link" href="/laporan">Lihat laporan <ArrowRight size={15} /></Link></div>
          <div className="chart-legend"><span><i className="legend-income" />Pemasukan</span><span><i className="legend-expense" />Pengeluaran</span></div>
          <div className="bar-chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthData} margin={{ top: 8, right: 8, left: -15, bottom: 0 }} barGap={5}>
                <CartesianGrid vertical={false} stroke="#e8ede9" strokeDasharray="3 3" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#7e8a83", fontSize: 11 }} dy={8} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#7e8a83", fontSize: 10 }} tickFormatter={(value: number) => value >= 1_000_000 ? `${Math.round(value / 1_000_000)}jt` : `${Math.round(value / 1_000)}rb`} />
                <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} contentStyle={{ border: "1px solid #dfe6e0", borderRadius: 10, fontSize: 12, boxShadow: "0 8px 24px rgba(23,40,32,.08)" }} />
                <Bar dataKey="income" name="Pemasukan" fill="#174b36" radius={[4, 4, 0, 0]} maxBarSize={20} />
                <Bar dataKey="expense" name="Pengeluaran" fill="#e6a342" radius={[4, 4, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="panel chart-panel expense-panel">
          <div className="panel-heading"><div><p className="eyebrow">ALOKASI BIAYA</p><h3>Komposisi pengeluaran</h3><span className="panel-subtitle">Berdasarkan kategori bulan ini</span></div><Link className="quiet-icon report-icon" href="/laporan" aria-label="Lihat laporan" title="Lihat laporan"><Ellipsis size={18} /></Link></div>
          {pieData.length ? (
            <>
              <div className="pie-chart-wrap">
                <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pieData} dataKey="value" nameKey="name" innerRadius={67} outerRadius={94} paddingAngle={3} stroke="none">{pieData.map((item, index) => <Cell key={item.name} fill={chartColors[index % chartColors.length]} />)}</Pie><Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} contentStyle={{ border: "1px solid #dfe6e0", borderRadius: 10, fontSize: 12 }} /></PieChart></ResponsiveContainer>
                <div className="pie-center"><strong>{pieData.length}</strong><span>kategori</span></div>
              </div>
              <div className="category-legend">{pieData.slice(0, 4).map((item, index) => <div className="category-legend-row" key={item.name}><span><i style={{ backgroundColor: chartColors[index % chartColors.length] }} />{item.name}</span><strong>{formatCurrency(item.value)}</strong></div>)}</div>
            </>
          ) : <div className="empty-chart"><PackageOpen size={28} /><span>Belum ada pengeluaran bulan ini.</span></div>}
        </article>
      </section>

      <section className="lower-grid">
        <article className="panel transaction-panel">
          <div className="panel-heading"><div><p className="eyebrow">AKTIVITAS TERBARU</p><h3>Transaksi terakhir</h3></div><Link className="panel-link" href="/transaksi">Semua transaksi <ArrowRight size={15} /></Link></div>
          <div className="table-scroll"><table className="data-table"><thead><tr><th>Transaksi</th><th>Tanggal</th><th>Kandang</th><th className="align-right">Nominal</th></tr></thead><tbody>
            {recentTransactions.map((transaction) => <tr key={transaction.id}><td><span className={transaction.kind === "income" ? "table-icon table-icon-income" : "table-icon table-icon-expense"}>{transaction.kind === "income" ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</span><span className="transaction-cell"><strong>{transaction.description}</strong><small>{categoryLookup.get(transaction.category_id) ?? "Lain-lain"}</small></span></td><td className="date-cell">{formatDate(transaction.transaction_date)}</td><td className="pen-cell">{transaction.pen_id ? penLookup.get(transaction.pen_id) ?? "-" : "Umum"}</td><td className={transaction.kind === "income" ? "align-right amount-income" : "align-right amount-expense"}>{transaction.kind === "income" ? "+ " : "− "}{formatCurrency(Number(transaction.amount))}</td></tr>)}
            {!recentTransactions.length && <tr><td colSpan={4} className="empty-row"><ReceiptText size={19} />Belum ada transaksi. Catat transaksi pertama Anda.</td></tr>}
          </tbody></table></div>
        </article>

        <article className="panel budget-panel">
          <div className="panel-heading"><div><p className="eyebrow">PAGU BULANAN</p><h3>Pantau anggaran</h3></div><Link className="quiet-icon report-icon" href="/anggaran" aria-label="Buka anggaran" title="Buka anggaran"><Ellipsis size={18} /></Link></div>
          {budgetRows.length ? <div className="budget-list">{budgetRows.slice(0, 4).map((budget) => {
            const percent = Math.round((budget.actual / Number(budget.target_amount)) * 100);
            const alertLevel = percent >= 100 ? "budget-danger" : percent >= 80 ? "budget-warning" : "";
            return <div className="budget-row" key={budget.id}><div className="budget-label"><strong>{budget.categoryName}</strong><span>{percent}%</span></div><div className="budget-track"><i className={alertLevel} style={{ width: `${Math.min(percent, 100)}%` }} /></div><div className="budget-values"><span>{formatCurrency(budget.actual)}</span><span>dari {formatCurrency(Number(budget.target_amount))}</span></div>{percent >= 80 && <p className={percent >= 100 ? "budget-alert alert-danger" : "budget-alert alert-warning"}>{percent >= 100 ? "Anggaran terlampaui" : "Mendekati batas anggaran"}</p>}</div>;
          })}</div> : <div className="empty-budget"><span>Belum ada anggaran bulan ini.</span><Link href="/anggaran">Atur anggaran <ArrowRight size={14} /></Link></div>}
          <Link className="budget-footer-link" href="/anggaran">Kelola semua anggaran <ArrowRight size={14} /></Link>
        </article>
      </section>
      <div className="dashboard-bottom-note"><span><Download size={15} />Catatan tersimpan otomatis</span><span>Ringkasan mengikuti tanggal transaksi aktif.</span></div>
    </div>
  );
}