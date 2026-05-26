import jsPDF from 'jspdf';
import autoTable, { type RowInput, type UserOptions } from 'jspdf-autotable';

export interface PdfSection {
  title?: string;
  head?: string[][];
  body: RowInput[];
  options?: Partial<UserOptions>;
}

export interface PdfReport {
  title: string;
  subtitle?: string;
  meta?: { label: string; value: string }[];
  sections: PdfSection[];
  filename: string;
}

const BRAND_COLOR: [number, number, number] = [26, 104, 245]; // brand-600

export function downloadPdf(report: PdfReport): void {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = margin;

  doc.setFontSize(18);
  doc.setTextColor(...BRAND_COLOR);
  doc.text('GradePulse', margin, y);
  y += 8;
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text('Real-time academic transparency', margin, y + 4);

  doc.setFontSize(14);
  doc.setTextColor(20);
  y += 28;
  doc.text(report.title, margin, y);

  if (report.subtitle) {
    y += 16;
    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.text(report.subtitle, margin, y);
  }

  if (report.meta && report.meta.length > 0) {
    y += 14;
    doc.setFontSize(9);
    doc.setTextColor(60);
    const cols = 2;
    const colWidth = (pageWidth - margin * 2) / cols;
    report.meta.forEach((m, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      doc.text(`${m.label}: ${m.value}`, margin + col * colWidth, y + row * 14);
    });
    y += Math.ceil(report.meta.length / cols) * 14;
  }

  y += 12;

  for (const section of report.sections) {
    if (section.title) {
      doc.setFontSize(11);
      doc.setTextColor(20);
      doc.text(section.title, margin, y);
      y += 8;
    }

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: section.head,
      body: section.body,
      headStyles: {
        fillColor: BRAND_COLOR,
        textColor: 255,
        fontSize: 9,
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 9,
        cellPadding: 4,
      },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      ...(section.options ?? {}),
    });

    const last = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
    y = (last?.finalY ?? y) + 20;
  }

  const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal
    .getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Generated ${new Date().toLocaleString()}  ·  Page ${i} of ${pageCount}`,
      margin,
      doc.internal.pageSize.getHeight() - 20,
    );
  }

  doc.save(report.filename.endsWith('.pdf') ? report.filename : `${report.filename}.pdf`);
}
