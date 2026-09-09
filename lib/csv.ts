// A cell starting with one of these is interpreted as a formula by Excel and
// Sheets. Student-supplied text (names, short answers) reaches the export, so
// prefix such cells with a quote to neutralise them.
const FORMULA_PREFIXES = ["=", "+", "-", "@", "\t", "\r"];

function escapeCell(value: unknown): string {
  const raw = value === null || value === undefined ? "" : String(value);
  const guarded = FORMULA_PREFIXES.some((p) => raw.startsWith(p)) ? `'${raw}` : raw;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(escapeCell).join(",")];
  for (const row of rows) lines.push(row.map(escapeCell).join(","));
  return lines.join("\r\n");
}
