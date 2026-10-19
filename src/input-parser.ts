export function parseNumbers(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[\s,，;；]+/)
        .filter(Boolean)
        .map((number) => number.toUpperCase()),
    ),
  ];
}

export async function readExcel(file: File): Promise<string[]> {
  if (!/\.xlsx?$/i.test(file.name)) throw new Error("请选择 .xlsx 或 .xls 文件");
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("Excel 文件没有工作表");
  const rows = XLSX.utils
    .sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" })
    .map((row) => row.map((cell) => String(cell).trim()))
    .filter((row) => row.some(Boolean));
  if (!rows.length) throw new Error("Excel 文件没有内容");
  const column = rows[0].findIndex((cell) =>
    /物流单号|快递单号|运单号|跟踪号|追踪号|tracking|waybill|单号/i.test(cell),
  );
  const data = column >= 0 ? rows.slice(1) : rows;
  const numbers = parseNumbers(data.map((row) => row[Math.max(column, 0)] ?? "").join("\n"));
  if (!numbers.length) throw new Error("没有识别到物流单号");
  return numbers;
}
