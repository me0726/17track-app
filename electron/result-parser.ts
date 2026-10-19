export interface ParsedResult {
  trackingNumber: string;
  text: string | null;
  error: string | null;
  originCountry: string | null;
  destinationCountry: string | null;
  latestEvent: string | null;
  logisticsStatus: string | null;
  transitTime: string | null;
}

// One TSV row per shipment. Match the first cell exactly, never by substring.
export function parseResults(text: string, numbers: string[]): ParsedResult[] {
  const rows = new Map<string, string[]>();
  const expected = new Set(numbers.map((number) => number.toUpperCase()));
  for (const raw of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const number = raw.split("\t")[0].trim().toUpperCase();
    if (!expected.has(number)) continue;
    const values = rows.get(number) ?? [];
    if (!values.includes(raw)) values.push(raw);
    rows.set(number, values);
  }
  return numbers.map((trackingNumber) => {
    const lines = rows.get(trackingNumber.toUpperCase()) ?? [];
    const cells = lines[0]?.split("\t").map((cell) => cell.trim()) ?? [];
    const error =
      lines.length === 0
        ? "复制结果中没有该单号"
        : lines.length > 1
          ? "该单号出现多条不同结果，无法解析"
          : cells.length !== 6 || !cells[3] || !cells[4]
            ? "结果不是有效的六列物流数据"
            : null;
    return {
      trackingNumber,
      text: lines.join("\n") || null,
      error,
      originCountry: !error ? cells[1] || null : null,
      destinationCountry: !error ? cells[2] || null : null,
      latestEvent: !error ? cells[3] : null,
      logisticsStatus: !error ? cells[4] : null,
      transitTime: !error ? cells[5] || null : null,
    };
  });
}
