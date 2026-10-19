import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import { TaskDatabase } from "../dist-electron/database.js";
import { createTaskWorkbook, exportFileName } from "../dist-electron/export.js";

test("exports every item as strings with logistics fields and processing status", (t) => {
  const db = new TaskDatabase(":memory:");
  t.after(() => db.close());
  const numbers = Array.from({ length: 24 }, (_, index) => "00123456789012345678" + index);
  const task = db.create({ numbers, sourceFileName: "orders.xlsx" });
  db.setStatus(task.id, "running");
  db.markProcessing(task.id, numbers.slice(0, 22));
  db.saveBatch(
    task.id,
    numbers.slice(0, 21),
    numbers
      .slice(0, 20)
      .map((number) =>
        [number, "中国", "美国", "2026-07-21 10:50 已妥投", "成功签收", "(7 天)"].join("\t"),
      )
      .join("\n"),
  );
  // The UI can display one filtered page; export must still include all records.
  assert.equal(
    db.itemsPage({ taskId: task.id, status: "completed", pageSize: 10 }).items.length,
    10,
  );
  const book = XLSX.read(createTaskWorkbook(db.get(task.id)), { type: "buffer" });
  const sheet = book.Sheets[book.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  assert.equal(rows.length, 25);
  assert.deepEqual(rows[0], ["单号", "物流信息", "状态"]);
  assert.deepEqual(rows[1], [numbers[0], "2026-07-21 10:50 已妥投", "已完成"]);
  assert.equal(sheet.A2.t, "s");
  assert.deepEqual(rows[21], [numbers[20], "复制结果中没有该单号", "失败"]);
  assert.equal(rows[22][2], "处理中");
  assert.equal(rows[23][2], "等待中");
  assert.equal(rows[24][2], "等待中");
  assert.equal(sheet["!autofilter"].ref, "A1:C25");
  assert.ok(
    !rows[0].includes("始发地") && !rows[0].includes("目的地") && !rows[0].includes("运输时长"),
  );
});

test("exports formula-like text as literal string cells and sanitizes the default filename", (t) => {
  const db = new TaskDatabase(":memory:");
  t.after(() => db.close());
  const task = db.create({ numbers: ["=SUM(1+1)"], sourceFileName: "订单:测试?.xlsx" });
  const book = XLSX.read(createTaskWorkbook(task), { type: "buffer" });
  const cell = book.Sheets[book.SheetNames[0]].A2;
  assert.equal(cell.v, "=SUM(1+1)");
  assert.equal(cell.t, "s");
  assert.equal(cell.f, undefined);
  assert.equal(exportFileName(task), "订单_测试_-任务" + task.id + ".xlsx");
});
