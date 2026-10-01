"use client";

import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, FileSpreadsheet, FileText, Printer } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useFarmData } from "@/lib/farm-data";
import { formatCurrency, formatDate } from "@/lib/format";
import type { ExportTable } from "@/lib/report-export";
import type { FarmTransaction } from "@/lib/domain";

type PeriodType = "month" | "quarter" | "year";
const localMonthValue = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};
const transactionMonth = (value: string) => value.slice(0, 7);
const periods = ["Bulan", "Kuartal", "Tahun"] as const;

const getMonthRows = (transactions: FarmTransaction[], start: Date, monthCount: number) =>
  Array.from({ length: monthCount }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth() + index, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const rows = transactions.filter((item) => !item.deleted_at && transactionMonth(item.transaction_date) === key);
    const income = rows.filter((item) => item.kind === "income").reduce((sum, item) => sum + Number(item.amount), 0);
    const expense = rows.filter((item) => item.kind === "expense").reduce((sum, item) => sum + Number(item.amount), 0);
    return { month: new Intl.DateTimeFormat("id-ID", { month: "short", year: "2-digit" }).format(date), income, expense, net: income - expense };
  });

export default function ReportsPage() {
  const { data } = useFarmData();
  const [periodType, setPeriodType] = useState<PeriodType>("month");
  const [month, setMonth] = useState(localMonthValue);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [quarter, setQuarter] = useState(String(Math.floor(new Date().getMonth() / 3) + 1));
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const safeMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : localMonthValue();
  const safeYear = Number.isInteger(Number(year)) && Number(year) >= 2000 && Number(year) <= 2100 ? Number(year) : new Date().getFullYear();
  const safeQuarter = ["1", "2", "3", "4"].includes(quarter) ? Number(quarter) : Math.floor(new Date().getMonth() / 3) + 1;
  const selectedYear = periodType === "month" ? Number(safeMonth.slice(0, 4)) : safeYear;
  const startMonth = periodType === "month" ? Number(safeMonth.slice(5, 7)) - 1 : periodType === "quarter" ? (safeQuarter - 1) * 3 : 0;
  const monthCount = periodType === "month" ? 1 : periodType === "quarter" ? 3 : 12;
  const rangeStart = new Date(selectedYear, startMonth, 1);
  const rangeEnd = new Date(selectedYear, startMonth + monthCount, 0);
  const startDate = `${rangeStart.getFullYear()}-${String(rangeStart.getMonth() + 1).padStart(2, "0")}-01`;
  const endDate = `${rangeEnd.getFullYear()}-${String(rangeEnd.getMonth() + 1).padStart(2, "0")}-${String(rangeEnd.getDate()).padStart(2, "0")}`;
  const periodLabel = periodType === "month"
    ? new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(rangeStart)
    : periodType === "quarter"
      ? `Kuartal ${safeQuarter} ${selectedYear}`
      : `Tahun ${selectedYear}`;
  const transactions = data.transactions.filter((item) => !item.deleted_at && item.transaction_date >= startDate && item.transaction_date <= endDate);
  const income = transactions.filter((item) => item.kind === "income").reduce((sum, item) => sum + Number(item.amount), 0);
  const expense = transactions.filter((item) => item.kind === "expense").reduce((sum, item) => sum + Number(item.amount), 0);
  const net = income - expense;
  const categories = new Map(data.categories.map((item) => [item.id, item.name]));
  const cashflowRows = getMonthRows(transactions, rangeStart, monthCount);
  const categoryTotals = new Map<string, { kind: string; name: string; amount: number }>();
  transactions.forEach((item) => {
    const name = categories.get(item.category_id) ?? "Kategori diarsipkan";
    const key = `${item.kind}-${item.category_id}`;
    const existing = categoryTotals.get(key);
    categoryTotals.set(key, { kind: item.kind === "income" ? "Pemasukan" : "Pengeluaran", name, amount: (existing?.amount ?? 0) + Number(item.amount) });
  });
  const categoryRows = Array.from(categoryTotals.values()).sort((a, b) => a.kind.localeCompare(b.kind) || b.amount - a.amount);
  const penRows = data.pens.filter((pen) => !pen.deleted_at).map((pen) => {
    const rows = transactions.filter((item) => item.pen_id === pen.id);
    const penIncome = rows.filter((item) => item.kind === "income").reduce((sum, item) => sum + Number(item.amount), 0);
    const penExpense = rows.filter((item) => item.kind === "expense").reduce((sum, item) => sum + Number(item.amount), 0);
    return { pen, income: penIncome, expense: penExpense, net: penIncome - penExpense, perHead: pen.head_count > 0 ? penExpense / pen.head_count : 0 };
  }).sort((a, b) => b.net - a.net);

  const tables: ExportTable[] = [
    {
      title: "Laba Rugi",
      columns: ["Jenis", "Kategori", "Nominal (Rp)"],
      rows: [
        ...categoryRows.map((item) => [item.kind, item.name, item.amount] as (string | number)[]),
        ["Ringkasan", "Total pemasukan", income],
        ["Ringkasan", "Total pengeluaran", expense],
        ["Ringkasan", "Laba / rugi bersih", net],
      ],
    },
    {
      title: "Arus Kas",
      columns: ["Bulan", "Pemasukan (Rp)", "Pengeluaran (Rp)", "Arus kas bersih (Rp)"],
      rows: cashflowRows.map((item) => [item.month, item.income, item.expense, item.net]),
    },
    {
      title: "Per Kandang",
      columns: ["Kandang", "Jenis ternak", "Ekor", "Pendapatan (Rp)", "Biaya (Rp)", "Laba / rugi (Rp)", "Biaya / ekor (Rp)"],
      rows: penRows.map(({ pen, income: penIncome, expense: penExpense, net: penNet, perHead }) => [pen.name, pen.livestock_type, pen.head_count, penIncome, penExpense, penNet, perHead]),
    },
  ];

  const exportFile = async (kind: "excel" | "pdf") => {
    setExporting(true); setExportError("");
    try {
      const report = { businessName: data.profile.business_name, period: periodLabel, title: "Laporan Keuangan", tables };
      if (kind === "excel") {
        const { downloadReportExcel } = await import("@/lib/report-export");
        await downloadReportExcel(report);
      } else {
        const { downloadReportPdf } = await import("@/lib/report-export");
        downloadReportPdf(report);
      }
    } catch (caught) {
      setExportError(caught instanceof Error ? caught.message : "Laporan belum dapat diunduh.");
    } finally { setExporting(false); }
  };

  return (
    <div className="module-page report-page">
      <div className="page-intro module-intro"><div><p className="eyebrow">ANALISIS USAHA</p><h2>Laporan keuangan</h2><p>Laba-rugi, arus kas, dan biaya per kelompok ternak.</p></div><div className="intro-actions"><button className="secondary-button" onClick={() => void exportFile("excel")} disabled={exporting}><FileSpreadsheet size={16} />Excel</button><button className="primary-button compact-button" onClick={() => void exportFile("pdf")} disabled={exporting}><FileText size={16} />PDF</button></div></div>
      <section className="panel report-filter-panel"><div className="period-tabs" role="tablist" aria-label="Jenis periode laporan">{periods.map((label, index) => { const value: PeriodType = ["month", "quarter", "year"][index] as PeriodType; return <button key={value} className={periodType === value ? "period-tab-active" : ""} onClick={() => setPeriodType(value)} role="tab" aria-selected={periodType === value}>{label}</button>; })}</div><div className="period-fields">{periodType === "month" && <label className="field-label">Bulan<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>}{periodType === "quarter" && <><label className="field-label">Kuartal<select value={quarter} onChange={(event) => setQuarter(event.target.value)}><option value="1">Kuartal 1 · Jan–Mar</option><option value="2">Kuartal 2 · Apr–Jun</option><option value="3">Kuartal 3 · Jul–Sep</option><option value="4">Kuartal 4 · Okt–Des</option></select></label><label className="field-label">Tahun<input type="number" min="2020" max="2100" value={year} onChange={(event) => setYear(event.target.value)} /></label></>}{periodType === "year" && <label className="field-label">Tahun<input type="number" min="2020" max="2100" value={year} onChange={(event) => setYear(event.target.value)} /></label>}<span className="report-range">{formatDate(startDate)} – {formatDate(endDate)}</span></div></section>

      {exportError && <p className="form-alert error-alert" role="alert">{exportError}</p>}
      <section className="report-summary-grid"><article><span><ArrowDownLeft size={16} />Pemasukan</span><strong className="amount-income">{formatCurrency(income)}</strong></article><article><span><ArrowUpRight size={16} />Pengeluaran</span><strong className="amount-expense">{formatCurrency(expense)}</strong></article><article><span><Printer size={16} />Laba / rugi bersih</span><strong className={net >= 0 ? "amount-income" : "amount-expense"}>{formatCurrency(net)}</strong></article></section>

      <section className="report-charts-grid"><article className="panel report-chart-panel"><div className="panel-heading"><div><p className="eyebrow">ARUS KAS</p><h3>Pergerakan periode</h3></div></div><div className="bar-chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={cashflowRows} margin={{ top: 8, right: 8, left: -15, bottom: 0 }} barGap={5}><CartesianGrid vertical={false} stroke="#e8ede9" strokeDasharray="3 3" /><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#7e8a83", fontSize: 11 }} dy={8} /><YAxis axisLine={false} tickLine={false} tick={{ fill: "#7e8a83", fontSize: 10 }} tickFormatter={(value: number) => value >= 1_000_000 ? `${Math.round(value / 1_000_000)}jt` : `${Math.round(value / 1_000)}rb`} /><Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} contentStyle={{ border: "1px solid #dfe6e0", borderRadius: 10, fontSize: 12 }} /><Legend /><Bar dataKey="income" name="Pemasukan" fill="#174b36" radius={[4, 4, 0, 0]} maxBarSize={24} /><Bar dataKey="expense" name="Pengeluaran" fill="#e6a342" radius={[4, 4, 0, 0]} maxBarSize={24} /></BarChart></ResponsiveContainer></div></article><article className="panel report-note-panel"><p className="eyebrow">CATATAN LAPORAN</p><h3>{periodLabel}</h3><p>Periode laporan mengikuti tanggal transaksi. Transaksi yang diarsipkan tidak disertakan.</p><div><span>Transaksi aktif</span><strong>{transactions.length}</strong></div><div><span>Kandang tercatat</span><strong>{penRows.length}</strong></div><div><span>Dicetak</span><strong>{formatDate(new Date())}</strong></div></article></section>

      <section className="report-tables-grid"><article className="panel report-table-panel"><div className="panel-heading"><div><p className="eyebrow">LABA RUGI</p><h3>Rincian kategori</h3></div><span className="count-pill">{periodLabel}</span></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Jenis</th><th>Kategori</th><th className="align-right">Nominal</th></tr></thead><tbody>{categoryRows.map((row) => <tr key={`${row.kind}-${row.name}`}><td>{row.kind}</td><td>{row.name}</td><td className="align-right">{formatCurrency(row.amount)}</td></tr>)}<tr className="table-total-row"><td colSpan={2}>Pemasukan</td><td className="align-right amount-income">{formatCurrency(income)}</td></tr><tr className="table-total-row"><td colSpan={2}>Pengeluaran</td><td className="align-right amount-expense">{formatCurrency(expense)}</td></tr><tr className="table-total-row"><td colSpan={2}>Laba / rugi bersih</td><td className={`align-right ${net >= 0 ? "amount-income" : "amount-expense"}`}>{formatCurrency(net)}</td></tr>{!categoryRows.length && <tr><td colSpan={3} className="empty-row">Belum ada transaksi di periode ini.</td></tr>}</tbody></table></div></article>
        <article className="panel report-table-panel"><div className="panel-heading"><div><p className="eyebrow">HASIL PER KANDANG</p><h3>Biaya produksi</h3></div></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Kandang</th><th className="align-right">Pendapatan</th><th className="align-right">Biaya</th><th className="align-right">Biaya/ekor</th></tr></thead><tbody>{penRows.map(({ pen, income: penIncome, expense: penExpense, net: penNet, perHead }) => <tr key={pen.id}><td><span className="transaction-cell"><strong>{pen.name}</strong><small>{pen.livestock_type} · {pen.head_count} ekor</small></span><small className={penNet >= 0 ? "amount-income" : "amount-expense"}>{formatCurrency(penNet)} laba</small></td><td className="align-right">{formatCurrency(penIncome)}</td><td className="align-right">{formatCurrency(penExpense)}</td><td className="align-right">{formatCurrency(perHead)}</td></tr>)}{!penRows.length && <tr><td colSpan={4} className="empty-row">Belum ada kandang aktif.</td></tr>}</tbody></table></div></article></section>

      <section className="panel cashflow-table-panel"><div className="panel-heading"><div><p className="eyebrow">ARUS KAS</p><h3>Rincian per bulan</h3></div><span className="count-pill">{cashflowRows.length} bulan</span></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Bulan</th><th className="align-right">Pemasukan</th><th className="align-right">Pengeluaran</th><th className="align-right">Arus kas bersih</th></tr></thead><tbody>{cashflowRows.map((row) => <tr key={row.month}><td>{row.month}</td><td className="align-right amount-income">{formatCurrency(row.income)}</td><td className="align-right amount-expense">{formatCurrency(row.expense)}</td><td className={`align-right ${row.net >= 0 ? "amount-income" : "amount-expense"}`}>{formatCurrency(row.net)}</td></tr>)}</tbody></table></div></section>
      <div className="page-note"><span>Setiap file ekspor memuat nama usaha, periode laporan, dan tanggal cetak.</span><span>Gunakan filter periode untuk laporan bulanan, kuartalan, atau tahunan.</span></div>
    </div>
  );
}
