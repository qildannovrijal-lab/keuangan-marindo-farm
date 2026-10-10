"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Calculator,
  CalendarDays,
  CirclePlus,
  Download,
  Ellipsis,
  Layers,
  PackageOpen,
  ReceiptText,
  Scale,
  Sparkles,
  Sprout,
  Wallet,
  WalletCards,
  Wheat,
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

const chartColors = [
  "#174b36",
  "#e6a342",
  "#54896e",
  "#8aa0a0",
  "#c3d58a",
  "#b9744d",
  "#536d5e",
  "#9dbaad",
];

type PeriodFilter = "this_month" | "last_month" | "three_months" | "this_year";

const keyOfMonth = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
const displayMonth = (date: Date) =>
  new Intl.DateTimeFormat("id-ID", { month: "short" }).format(date);

const transactionMonth = (value: string) => value.slice(0, 7);

function get12MonthData(transactions: FarmTransaction[]) {
  const now = new Date();
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1);
    const key = keyOfMonth(date);
    const monthTransactions = transactions.filter(
      (transaction) =>
        transactionMonth(transaction.transaction_date) === key && !transaction.deleted_at,
    );
    return {
      month: displayMonth(date),
      income: monthTransactions
        .filter((item) => item.kind === "income")
        .reduce((sum, item) => sum + Number(item.amount), 0),
      expense: monthTransactions
        .filter((item) => item.kind === "expense")
        .reduce((sum, item) => sum + Number(item.amount), 0),
    };
  });
}

export default function DashboardPage() {
  const { data } = useFarmData();
  const [period, setPeriod] = useState<PeriodFilter>("this_month");

  const now = new Date();
  const currentMonthKey = keyOfMonth(now);
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthKey = keyOfMonth(lastMonthDate);
  const threeMonthsAgoDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const threeMonthsAgoKey = keyOfMonth(threeMonthsAgoDate);
  const currentYearStr = String(now.getFullYear());

  // Filter transactions based on selected period
  const activeTransactions = data.transactions.filter((item) => {
    if (item.deleted_at) return false;
    const itemMonth = item.transaction_date.slice(0, 7);
    const itemYear = item.transaction_date.slice(0, 4);

    if (period === "this_month") return itemMonth === currentMonthKey;
    if (period === "last_month") return itemMonth === lastMonthKey;
    if (period === "three_months") return itemMonth >= threeMonthsAgoKey && itemMonth <= currentMonthKey;
    if (period === "this_year") return itemYear === currentYearStr;
    return true;
  });

  const income = activeTransactions
    .filter((item) => item.kind === "income")
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const expense = activeTransactions
    .filter((item) => item.kind === "expense")
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const net = income - expense;

  const categoryLookup = new Map(data.categories.map((item) => [item.id, item.name]));
  const penLookup = new Map(data.pens.map((item) => [item.id, item.name]));
  const monthData = get12MonthData(data.transactions);

  // Category expense breakdown for pie chart
  const expenseByCategory = new Map<string, number>();
  activeTransactions
    .filter((item) => item.kind === "expense")
    .forEach((item) => {
      const name = categoryLookup.get(item.category_id) ?? "Lain-lain";
      expenseByCategory.set(name, (expenseByCategory.get(name) ?? 0) + Number(item.amount));
    });

  const pieData = Array.from(expenseByCategory, ([name, value]) => ({ name, value })).sort(
    (a, b) => b.value - a.value,
  );

  // Feed cost ratio calculation (golden livestock metric)
  const feedExpenses = activeTransactions
    .filter((item) => {
      if (item.kind !== "expense") return false;
      const cat = categoryLookup.get(item.category_id)?.toLowerCase() ?? "";
      return cat.includes("pakan");
    })
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const feedCostRatio = expense > 0 ? (feedExpenses / expense) * 100 : 0;

  // Farm population and debts KPI
  const totalLivestockPopulation = data.pens
    .filter((p) => !p.deleted_at)
    .reduce((sum, p) => sum + Number(p.head_count), 0);

  const unpaidDebt = data.debts
    .filter((d) => d.kind === "payable" && d.status !== "paid")
    .reduce((sum, d) => sum + Math.max(0, Number(d.amount) - Number(d.paid_amount)), 0);

  const unpaidReceivable = data.debts
    .filter((d) => d.kind === "receivable" && d.status !== "paid")
    .reduce((sum, d) => sum + Math.max(0, Number(d.amount) - Number(d.paid_amount)), 0);

  // Upcoming due dates alert
  const sevenDaysLater = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const urgentDebts = data.debts.filter(
    (d) => d.status !== "paid" && d.due_date && d.due_date <= sevenDaysLater,
  );

  const recentTransactions = data.transactions
    .filter((item) => !item.deleted_at)
    .slice()
    .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date))
    .slice(0, 5);

  const budgetRows = data.budgets
    .filter((item) => item.period_month.slice(0, 7) === currentMonthKey)
    .map((budget) => {
      const actual = data.transactions
        .filter(
          (item) =>
            !item.deleted_at &&
            item.kind === "expense" &&
            item.category_id === budget.category_id &&
            item.transaction_date.slice(0, 7) === currentMonthKey,
        )
        .reduce((sum, item) => sum + Number(item.amount), 0);
      return {
        ...budget,
        actual,
        categoryName: categoryLookup.get(budget.category_id) ?? "Kategori",
      };
    });

  const periodLabels: Record<PeriodFilter, string> = {
    this_month: new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(now),
    last_month: new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(
      lastMonthDate,
    ),
    three_months: "3 Bulan Terakhir",
    this_year: `Tahun ${currentYearStr}`,
  };

  return (
    <div className="dashboard-page">
      <div className="page-intro dashboard-intro">
        <div>
          <p className="eyebrow">PANTAU USAHA PETERNAKAN</p>
          <h2>Usaha terjaga, angka terbaca.</h2>
          <p>Ringkasan menyeluruh kesehatan keuangan dan operasional Marindo Farm.</p>
        </div>
        <div className="intro-actions">
          {/* Period Filter Segmented Control */}
          <div className="period-filter-pill-group">
            <button
              type="button"
              className={period === "this_month" ? "period-pill-active" : ""}
              onClick={() => setPeriod("this_month")}
            >
              Bulan Ini
            </button>
            <button
              type="button"
              className={period === "last_month" ? "period-pill-active" : ""}
              onClick={() => setPeriod("last_month")}
            >
              Bulan Lalu
            </button>
            <button
              type="button"
              className={period === "three_months" ? "period-pill-active" : ""}
              onClick={() => setPeriod("three_months")}
            >
              3 Bulan
            </button>
            <button
              type="button"
              className={period === "this_year" ? "period-pill-active" : ""}
              onClick={() => setPeriod("this_year")}
            >
              Tahun Ini
            </button>
          </div>

          <Link className="primary-button compact-button" href="/transaksi">
            <CirclePlus size={17} />
            Catat transaksi
          </Link>
        </div>
      </div>

      {/* Urgent Debt Alert Banner */}
      {urgentDebts.length > 0 && (
        <div className="alert-notice-banner">
          <div className="alert-banner-left">
            <AlertTriangle size={18} className="text-amber" />
            <span>
              <strong>Perhatian Tagihan:</strong> Terdapat {urgentDebts.length} tagihan hutang/piutang yang mendekati atau telah melewati jatuh tempo.
            </span>
          </div>
          <Link href="/hutang-piutang" className="alert-banner-link">
            Periksa Sekarang <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* Quick Farm Operation KPI Row */}
      <section className="farm-kpi-bar" aria-label="Indikator Operasional Peternakan">
        <div className="farm-kpi-item">
          <span className="farm-kpi-icon icon-sprout">
            <Sprout size={16} />
          </span>
          <div>
            <small>Populasi Ternak</small>
            <strong>{totalLivestockPopulation.toLocaleString("id-ID")} <small>ekor</small></strong>
          </div>
        </div>

        <div className="farm-kpi-item">
          <span className="farm-kpi-icon icon-wheat">
            <Wheat size={16} />
          </span>
          <div>
            <small>Rasio Biaya Pakan</small>
            <strong title="Persentase biaya pakan dari total pengeluaran">{feedCostRatio.toFixed(1)}% <small>biaya</small></strong>
          </div>
        </div>

        <div className="farm-kpi-item">
          <span className="farm-kpi-icon icon-debt">
            <WalletCards size={16} />
          </span>
          <div>
            <small>Hutang Berjalan</small>
            <strong className="text-expense">{formatCurrency(unpaidDebt)}</strong>
          </div>
        </div>

        <div className="farm-kpi-item">
          <span className="farm-kpi-icon icon-receivable">
            <ArrowDownLeft size={16} />
          </span>
          <div>
            <small>Piutang Berjalan</small>
            <strong className="text-income">{formatCurrency(unpaidReceivable)}</strong>
          </div>
        </div>
      </section>

      {/* Main 4 Financial Summary Cards */}
      <section className="summary-grid" aria-label={`Ringkasan ${periodLabels[period]}`}>
        <article className="summary-card summary-income">
          <div className="summary-top">
            <span className="summary-icon">
              <ArrowDownLeft size={18} />
            </span>
            <span className="summary-label">Total pemasukan</span>
            <span className="period-tag">{periodLabels[period]}</span>
          </div>
          <strong className="summary-value">{formatCurrency(income)}</strong>
          <span className="summary-foot">Hasil penjualan & operasional</span>
        </article>

        <article className="summary-card summary-expense">
          <div className="summary-top">
            <span className="summary-icon">
              <ArrowUpRight size={18} />
            </span>
            <span className="summary-label">Total pengeluaran</span>
            <span className="period-tag">{periodLabels[period]}</span>
          </div>
          <strong className="summary-value">{formatCurrency(expense)}</strong>
          <span className="summary-foot">Biaya pakan, bibit, OVK, upah</span>
        </article>

        <article className="summary-card summary-net">
          <div className="summary-top">
            <span className="summary-icon">
              <Wallet size={18} />
            </span>
            <span className="summary-label">Laba / rugi bersih</span>
            <span
              className={
                net >= 0 ? "trend-pill trend-positive" : "trend-pill trend-negative"
              }
            >
              {net >= 0 ? "Surplus" : "Defisit"}
            </span>
          </div>
          <strong className="summary-value">{formatCurrency(net)}</strong>
          <span className="summary-foot">Pemasukan dikurangi pengeluaran</span>
        </article>

        <article className="summary-card summary-cash">
          <div className="summary-top">
            <span className="summary-icon">
              <Scale size={18} />
            </span>
            <span className="summary-label">Margin Laba</span>
            <span className="period-tag">
              {income > 0 ? `${((net / income) * 100).toFixed(1)}%` : "0%"}
            </span>
          </div>
          <strong className="summary-value">
            {income > 0 ? `${((net / income) * 100).toFixed(1)}%` : "0%"}
          </strong>
          <span className="summary-foot">Efisiensi keuntungan usaha</span>
        </article>
      </section>

      {/* Charts Section */}
      <section className="charts-grid">
        <article className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">TREN KEUANGAN</p>
              <h3>Pemasukan & pengeluaran</h3>
              <span className="panel-subtitle">Perbandingan 12 bulan terakhir</span>
            </div>
            <Link className="panel-link" href="/laporan">
              Lihat laporan <ArrowRight size={15} />
            </Link>
          </div>
          <div className="chart-legend">
            <span>
              <i className="legend-income" />
              Pemasukan
            </span>
            <span>
              <i className="legend-expense" />
              Pengeluaran
            </span>
          </div>
          <div className="bar-chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={monthData}
                margin={{ top: 8, right: 8, left: -15, bottom: 0 }}
                barGap={5}
              >
                <CartesianGrid vertical={false} stroke="#e8ede9" strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#7e8a83", fontSize: 11 }}
                  dy={8}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#7e8a83", fontSize: 10 }}
                  tickFormatter={(value: number) =>
                    value >= 1_000_000
                      ? `${Math.round(value / 1_000_000)}jt`
                      : `${Math.round(value / 1_000)}rb`
                  }
                />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value ?? 0))}
                  contentStyle={{
                    border: "1px solid #dfe6e0",
                    borderRadius: 10,
                    fontSize: 12,
                    boxShadow: "0 8px 24px rgba(23,40,32,.08)",
                  }}
                />
                <Bar
                  dataKey="income"
                  name="Pemasukan"
                  fill="#174b36"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={20}
                />
                <Bar
                  dataKey="expense"
                  name="Pengeluaran"
                  fill="#e6a342"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={20}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="panel chart-panel expense-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">ALOKASI BIAYA</p>
              <h3>Komposisi pengeluaran</h3>
              <span className="panel-subtitle">Berdasarkan {periodLabels[period]}</span>
            </div>
            <Link className="panel-link" href="/kalkulator">
              Simulasi <ArrowRight size={14} />
            </Link>
          </div>
          {pieData.length ? (
            <>
              <div className="pie-chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={67}
                      outerRadius={94}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {pieData.map((item, index) => (
                        <Cell
                          key={item.name}
                          fill={chartColors[index % chartColors.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value ?? 0))}
                      contentStyle={{
                        border: "1px solid #dfe6e0",
                        borderRadius: 10,
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pie-center">
                  <strong>{pieData.length}</strong>
                  <span>kategori</span>
                </div>
              </div>
              <div className="category-legend">
                {pieData.slice(0, 4).map((item, index) => (
                  <div className="category-legend-row" key={item.name}>
                    <span>
                      <i style={{ backgroundColor: chartColors[index % chartColors.length] }} />
                      {item.name}
                    </span>
                    <strong>{formatCurrency(item.value)}</strong>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-chart">
              <PackageOpen size={28} />
              <span>Belum ada data pengeluaran pada periode ini.</span>
            </div>
          )}
        </article>
      </section>

      {/* Lower Section: Recent Transactions & Budget Progress */}
      <section className="lower-grid">
        <article className="panel transaction-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">AKTIVITAS TERBARU</p>
              <h3>Transaksi terakhir</h3>
            </div>
            <Link className="panel-link" href="/transaksi">
              Semua transaksi <ArrowRight size={15} />
            </Link>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Transaksi</th>
                  <th>Tanggal</th>
                  <th>Kandang</th>
                  <th className="align-right">Nominal</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>
                      <span
                        className={
                          transaction.kind === "income"
                            ? "table-icon table-icon-income"
                            : "table-icon table-icon-expense"
                        }
                      >
                        {transaction.kind === "income" ? (
                          <ArrowDownLeft size={16} />
                        ) : (
                          <ArrowUpRight size={16} />
                        )}
                      </span>
                      <span className="transaction-cell">
                        <strong>{transaction.description}</strong>
                        <small>
                          {categoryLookup.get(transaction.category_id) ?? "Lain-lain"}
                        </small>
                      </span>
                    </td>
                    <td className="date-cell">{formatDate(transaction.transaction_date)}</td>
                    <td className="pen-cell">
                      {transaction.pen_id ? penLookup.get(transaction.pen_id) ?? "-" : "Umum"}
                    </td>
                    <td
                      className={
                        transaction.kind === "income"
                          ? "align-right amount-income"
                          : "align-right amount-expense"
                      }
                    >
                      {transaction.kind === "income" ? "+ " : "− "}
                      {formatCurrency(Number(transaction.amount))}
                    </td>
                  </tr>
                ))}
                {!recentTransactions.length && (
                  <tr>
                    <td colSpan={4} className="empty-row">
                      <ReceiptText size={19} />
                      Belum ada transaksi. Catat transaksi pertama Anda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel budget-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">PAGU BULANAN</p>
              <h3>Pantau anggaran ({periodLabels.this_month})</h3>
            </div>
            <Link
              className="quiet-icon report-icon"
              href="/anggaran"
              aria-label="Buka anggaran"
              title="Buka anggaran"
            >
              <Ellipsis size={18} />
            </Link>
          </div>
          {budgetRows.length ? (
            <div className="budget-list">
              {budgetRows.slice(0, 4).map((budget) => {
                const percent = Math.round(
                  (budget.actual / Number(budget.target_amount)) * 100,
                );
                const alertLevel =
                  percent >= 100
                    ? "budget-danger"
                    : percent >= 80
                      ? "budget-warning"
                      : "";
                return (
                  <div className="budget-row" key={budget.id}>
                    <div className="budget-label">
                      <strong>{budget.categoryName}</strong>
                      <span>{percent}%</span>
                    </div>
                    <div className="budget-track">
                      <i
                        className={alertLevel}
                        style={{ width: `${Math.min(percent, 100)}%` }}
                      />
                    </div>
                    <div className="budget-values">
                      <span>{formatCurrency(budget.actual)}</span>
                      <span>dari {formatCurrency(Number(budget.target_amount))}</span>
                    </div>
                    {percent >= 80 && (
                      <p
                        className={
                          percent >= 100
                            ? "budget-alert alert-danger"
                            : "budget-alert alert-warning"
                        }
                      >
                        {percent >= 100
                          ? "Anggaran terlampaui"
                          : "Mendekati batas anggaran"}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-budget">
              <span>Belum ada target anggaran bulan ini.</span>
              <Link href="/anggaran">
                Atur anggaran <ArrowRight size={14} />
              </Link>
            </div>
          )}
          <Link className="budget-footer-link" href="/anggaran">
            Kelola semua anggaran <ArrowRight size={14} />
          </Link>
        </article>
      </section>

      <div className="dashboard-bottom-note">
        <span>
          <Download size={15} />
          Catatan tersimpan otomatis
        </span>
        <span>Ringkasan mengikuti transaksi aktif Marindo Farm.</span>
      </div>
    </div>
  );
}
