import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDate } from "@/lib/format";

export type ExportCell = string | number;
export type ExportTable = { title: string; columns: string[]; rows: ExportCell[][] };
export type ReportExport = { businessName: string; period: string; title: string; tables: ExportTable[] };

const filenamePart = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export async function downloadReportExcel(report: ReportExport) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = report.businessName;
  workbook.created = new Date();
  workbook.subject = report.title;

  report.tables.forEach((table, index) => {
    const sheet = workbook.addWorksheet(table.title.slice(0, 31) || `Laporan ${index + 1}`);
    const lastColumn = String.fromCharCode(64 + Math.min(table.columns.length, 26));
    sheet.mergeCells(`A1:${lastColumn}1`);
    sheet.getCell("A1").value = report.businessName;
    sheet.getCell("A1").font = { bold: true, size: 16, color: { argb: "FF174B36" } };
    sheet.mergeCells(`A2:${lastColumn}2`);
    sheet.getCell("A2").value = `${report.title} · ${table.title}`;
    sheet.getCell("A2").font = { bold: true, size: 12 };
    sheet.mergeCells(`A3:${lastColumn}3`);
    sheet.getCell("A3").value = `Periode: ${report.period}  |  Dicetak: ${formatDate(new Date())}`;
    sheet.getCell("A3").font = { size: 10, color: { argb: "FF728078" } };
    sheet.addRow([]);
    const header = sheet.addRow(table.columns);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF174B36" } };
    table.rows.forEach((row) => sheet.addRow(row));
    table.columns.forEach((column, index) => {
      sheet.getColumn(index + 1).width = Math.max(16, Math.min(34, column.length + 5));
    });
    sheet.views = [{ state: "frozen", ySplit: 5 }];
    sheet.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: table.columns.length } };
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 5) row.eachCell((cell) => {
        if (typeof cell.value === "number") cell.numFmt = '"Rp" #,##0;[Red]-"Rp" #,##0';
      });
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${filenamePart(report.title)}-${filenamePart(report.period)}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadReportPdf(report: ReportExport) {
  const document = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  report.tables.forEach((table, index) => {
    if (index > 0) document.addPage();
    document.setTextColor(23, 75, 54);
    document.setFont("helvetica", "bold");
    document.setFontSize(16);
    document.text(report.businessName, 14, 17);
    document.setFontSize(11);
    document.text(`${report.title} · ${table.title}`, 14, 25);
    document.setTextColor(100, 115, 106);
    document.setFont("helvetica", "normal");
    document.setFontSize(9);
    document.text(`Periode: ${report.period}  |  Dicetak: ${formatDate(new Date())}`, 14, 31);
    autoTable(document, {
      startY: 37,
      head: [table.columns],
      body: table.rows,
      theme: "grid",
      styles: { font: "helvetica", fontSize: 8, cellPadding: 2.5, textColor: [34, 54, 43] },
      headStyles: { fillColor: [23, 75, 54], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [244, 247, 244] },
      margin: { left: 14, right: 14 },
    });
  });
  document.save(`${filenamePart(report.title)}-${filenamePart(report.period)}.pdf`);
}

export async function downloadBackupExcel(
  businessName: string,
  data: Record<string, ExportTable>,
) {
  const tables = Object.values(data);
  await downloadReportExcel({
    businessName,
    period: `Backup ${formatDate(new Date())}`,
    title: "Backup Data Marindo Farm",
    tables,
  });
}