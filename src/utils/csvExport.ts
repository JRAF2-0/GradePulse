/**
 * Convert a 2D array of rows to a CSV Blob and trigger a download.
 * Cells with commas, quotes, or newlines are properly escaped.
 */

type Cell = string | number | null | undefined;

function escapeCell(value: Cell): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function rowsToCsv(rows: Cell[][]): string {
  return rows.map((r) => r.map(escapeCell).join(',')).join('\r\n');
}

export function downloadCsv(filename: string, rows: Cell[][]): void {
  // BOM so Excel recognizes UTF-8
  const csv = '﻿' + rowsToCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
