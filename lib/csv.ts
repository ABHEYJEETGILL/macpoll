const NEEDS_QUOTING = /[",\r\n]/;
// Excel and Sheets execute a cell that opens with one of these.
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";

  let text = String(value);
  if (FORMULA_PREFIX.test(text)) text = `'${text}`;
  if (NEEDS_QUOTING.test(text)) text = `"${text.replace(/"/g, '""')}"`;

  return text;
}

export function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(",");
}

/** Joins rows with CRLF and prepends a BOM so Excel reads UTF-8 correctly. */
export function csvDocument(rows: unknown[][]): string {
  return `﻿${rows.map(csvRow).join("\r\n")}\r\n`;
}
