export interface ParsedTrackingNumber {
  trackingNumber: string;
  sourceRow?: number;
}

const headerHints = [
  "物流单号",
  "运单号",
  "跟踪号",
  "追踪号",
  "tracking",
  "trackingnumber",
  "waybill",
  "单号",
];

export function parseManualNumbers(value: string): ParsedTrackingNumber[] {
  return dedupe(
    value.split(/[\s,，;；]+/).map((trackingNumber) => ({ trackingNumber: trackingNumber.trim() })),
  );
}

export async function parseExcelFile(file: File): Promise<ParsedTrackingNumber[]> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) throw new Error("Excel 文件没有可读取的工作表");

  const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
    header: 1,
    raw: false,
    defval: "",
  });
  const nonEmptyRows = rows
    .map((row, index) => ({
      row: row.map((cell) => String(cell ?? "").trim()),
      sourceRow: index + 1,
    }))
    .filter(({ row }) => row.some(Boolean));
  if (!nonEmptyRows.length) throw new Error("Excel 文件中没有可读取的内容");

  const headerRow = nonEmptyRows[0];
  const trackingColumn = headerRow.row.findIndex((cell) => {
    const normalized = cell.toLowerCase().replace(/[\s_\-]/g, "");
    return headerHints.some((hint) => normalized.includes(hint));
  });
  const column = trackingColumn >= 0 ? trackingColumn : 0;
  const startIndex = trackingColumn >= 0 ? 1 : 0;

  return dedupe(
    nonEmptyRows.slice(startIndex).flatMap(({ row, sourceRow }) => {
      const trackingNumber = row[column]?.trim();
      return trackingNumber ? [{ trackingNumber, sourceRow }] : [];
    }),
  );
}

function dedupe(values: ParsedTrackingNumber[]): ParsedTrackingNumber[] {
  const seen = new Set<string>();
  return values.filter(({ trackingNumber }) => {
    const key = trackingNumber.toUpperCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
