import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { TaskDatabase } from "../dist-electron/database.js";

function memory(t) {
  const db = new TaskDatabase(":memory:");
  t.after(() => db.close());
  return db;
}

test("creates one task and deduplicated items; invalid input creates no records", (t) => {
  const db = memory(t);
  assert.throws(() => db.create({ numbers: [] }), /请输入/);
  assert.throws(() => db.create({ numbers: [123] }), /格式/);
  assert.equal(db.list().length, 0);
  const task = db.create({ numbers: [" aa1 ", "AA1", "BB2"], sourceFileName: "orders'2026.xlsx" });
  assert.equal(task.total, 2);
  assert.equal(task.name, "orders'2026.xlsx");
  assert.deepEqual(
    task.items.map((item) => item.trackingNumber),
    ["AA1", "BB2"],
  );
  assert.ok(task.items.every((item) => item.taskId === task.id && item.status === "pending"));
});

test("pause, close database and resume only the remaining item from a 41-number task", (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), "trackbox-db-test-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, "tracking.sqlite");
  let db = new TaskDatabase(file);
  t.after(() => db.close());
  const numbers = Array.from({ length: 41 }, (_, index) => `AA${index}`);
  const task = db.create({ numbers });
  db.setStatus(task.id, "running");
  db.saveBatch(
    task.id,
    numbers.slice(0, 40),
    numbers
      .slice(0, 40)
      .map(
        (number) => `${number}\t中国\t美国\t2026-07-21 10:50 RICHFIELD,MN,55423\t成功签收\t(7 天)`,
      )
      .join("\n"),
  );
  db.setStatus(task.id, "paused");
  assert.equal(db.get(task.id).completed, 40);
  db.close();
  db = new TaskDatabase(file);
  db.recoverInterrupted();
  assert.equal(db.get(task.id).status, "paused");
  assert.deepEqual(db.pending(task.id), ["AA40"]);
  const previousResult = db.get(task.id).items[0].resultText;
  db.setStatus(task.id, "running");
  db.saveBatch(
    task.id,
    db.pending(task.id),
    "AA40\t中国\t美国\t2026-07-21 10:50 RICHFIELD,MN,55423\t成功签收\t(7 天)",
  );
  const completed = db.setStatus(task.id, "ended");
  assert.equal(completed.completed, 41);
  assert.equal(completed.items[0].resultText, previousResult);
  assert.match(completed.items[40].resultText, /^AA40\t/);
});

test("restart turns an interrupted task into paused without losing completed items", (t) => {
  const db = memory(t);
  const task = db.create({ numbers: ["X1", "X2"] });
  db.setStatus(task.id, "running");
  db.saveBatch(
    task.id,
    ["X1"],
    "X1\t中国\t美国\t2026-07-21 10:50 RICHFIELD,MN,55423\t成功签收\t(7 天)",
  );
  db.recoverInterrupted();
  assert.equal(db.get(task.id).status, "paused");
  assert.equal(db.get(task.id).completed, 1);
  assert.deepEqual(db.pending(task.id), ["X2"]);
});

test("pause resumes only waiting items; failures remain in details and a mixed result still ends the task", (t) => {
  const db = memory(t);
  const task = db.create({ numbers: ["X1", "X2", "X3"] });
  assert.throws(() => db.retryFailed(task.id), /只能重试已结束/);
  db.setStatus(task.id, "running");
  db.markProcessing(task.id, ["X1", "X2", "X3"]);
  db.saveBatch(task.id, ["X1", "X2"], "X1\t中国\t美国\t已妥投\t成功签收\t(7 天)");
  db.releaseProcessing(task.id);
  db.setStatus(task.id, "paused");
  assert.deepEqual(db.pending(task.id), ["X3"]);
  db.setStatus(task.id, "running");
  assert.throws(() => db.markProcessing(task.id, ["X2"]), /等待中/);
  db.markProcessing(task.id, db.pending(task.id));
  db.releaseProcessing(task.id, "查询超时");
  const ended = db.finish(task.id);
  assert.equal(ended.status, "ended");
  assert.equal(ended.completed, 1);
  assert.equal(ended.failed, 2);
  assert.equal(ended.error, undefined);
  assert.equal(ended.items[2].error, "查询超时");
  assert.deepEqual(db.pending(task.id), []);
});

test("fully successful tasks end and reject retry without changing any results", (t) => {
  const db = memory(t);
  const task = db.create({ numbers: ["X1"] });
  db.setStatus(task.id, "running");
  assert.throws(() => db.finish(task.id), /未完成/);
  db.markProcessing(task.id, ["X1"]);
  assert.throws(() => db.finish(task.id), /未完成/);
  db.saveBatch(task.id, ["X1"], "X1\t中国\t美国\t已妥投\t成功签收\t(7 天)");
  const ended = db.finish(task.id);
  assert.equal(ended.status, "ended");
  assert.throws(() => db.retryFailed(task.id), /没有需要重试/);
  assert.deepEqual(db.get(task.id), ended);
});

test("resetting failed details to waiting persists across a restart", (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), "trackbox-retry-test-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, "trackbox.sqlite");
  let db = new TaskDatabase(file);
  t.after(() => db.close());
  const task = db.create({ numbers: ["X1", "X2"] });
  db.setStatus(task.id, "running");
  db.saveBatch(task.id, ["X1", "X2"], "X1\t中国\t美国\t已妥投\t成功签收\t(7 天)");
  const ended = db.finish(task.id);
  db.retryFailed(task.id);
  db.close();
  db = new TaskDatabase(file);
  db.recoverInterrupted();
  assert.equal(db.get(task.id).status, "paused");
  assert.deepEqual(db.pending(task.id), ["X2"]);
  assert.deepEqual(db.get(task.id).items[0], ended.items[0]);
  assert.equal(db.get(task.id).items[1].status, "pending");
  assert.equal(
    db.getBatch(ended.items[1].batchId).rawText,
    "X1\t中国\t美国\t已妥投\t成功签收\t(7 天)",
  );
});

test("batch updates are atomic when a number does not belong to the task", (t) => {
  const db = memory(t);
  const task = db.create({ numbers: ["X1", "X2"] });
  db.setStatus(task.id, "running");
  assert.throws(() => db.saveBatch(task.id, ["X1", "OTHER"], "shared result"), /不属于/);
  assert.equal(db.get(task.id).completed, 0);
  assert.ok(db.get(task.id).items.every((item) => item.resultText === null));
  assert.equal(db.listBatches().length, 0);
});

test("persists the exact batch text and links both parsed and failed rows across a restart", (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), "trackbox-raw-test-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, "tracking.sqlite");
  let db = new TaskDatabase(file);
  t.after(() => db.close());
  const numbers = ["AA1", "AA2", "AA3"];
  const task = db.create({ numbers, sourceFileName: "原文.xlsx" });
  const raw = "\r\nAA1\t中国\t美国\t2026-07-21 已妥投\t成功签收\t(7 天)\r\nAA2\t不完整\r\n  ";
  db.setStatus(task.id, "running");
  db.markProcessing(task.id, numbers);
  db.saveBatch(task.id, numbers, raw);
  const [summary] = db.listBatches();
  assert.equal(summary.taskId, task.id);
  assert.equal(summary.taskName, "原文.xlsx");
  assert.equal(summary.numberCount, 3);
  assert.equal(summary.batchNo, 1);
  assert.equal(summary.rawText, undefined);
  assert.equal(db.getBatch(summary.id).rawText, raw);
  assert.deepEqual(db.getBatch(summary.id).trackingNumbers, numbers);
  assert.deepEqual(
    db.get(task.id).items.map((item) => item.status),
    ["completed", "failed", "failed"],
  );
  assert.ok(db.get(task.id).items.every((item) => item.batchId === summary.id));
  assert.ok(
    db
      .itemsPage({ taskId: task.id, status: "failed" })
      .items.every((item) => item.batchId === summary.id),
  );
  db.close();
  db = new TaskDatabase(file);
  db.recoverInterrupted();
  assert.equal(db.getBatch(summary.id).rawText, raw);
  assert.ok(db.get(task.id).items.every((item) => item.batchId === summary.id));
  assert.throws(() => db.getBatch(99999), /不存在/);
});

test("retries append new batches, retain previous copies and keep the last source while processing", (t) => {
  const db = memory(t);
  const task = db.create({ numbers: ["X1", "X2"] });
  db.setStatus(task.id, "running");
  const raw = "X1\t中国\t美国\t已签收\t成功签收\t(7 天)\n";
  db.saveBatch(task.id, ["X1", "X2"], raw);
  db.finish(task.id);
  const [first] = db.listBatches();
  const completed = db.get(task.id).items[0];
  assert.equal(db.get(task.id).status, "ended");
  assert.throws(() => db.setStatus(task.id, "running"), /任务已结束/);
  assert.throws(() => db.setStatus(task.id, "paused"), /任务已结束/);
  const reset = db.retryFailed(task.id);
  assert.equal(reset.status, "paused");
  assert.equal(reset.failed, 0);
  assert.equal(reset.items[1].status, "pending");
  assert.equal(reset.items[1].error, null);
  assert.equal(reset.items[1].resultText, null);
  assert.equal(reset.items[1].batchId, first.id);
  assert.deepEqual(reset.items[0], completed);
  assert.deepEqual(db.pending(task.id), ["X2"]);
  db.setStatus(task.id, "running");
  db.markProcessing(task.id, ["X2"]);
  assert.equal(db.get(task.id).items[1].batchId, first.id);
  db.releaseProcessing(task.id, "网络中断");
  assert.equal(db.get(task.id).items[1].batchId, first.id);
  db.finish(task.id);
  db.retryFailed(task.id);
  db.setStatus(task.id, "running");
  db.markProcessing(task.id, ["X2"]);
  const retry = "X2\t中国\t美国\t派送中\t运输途中\t(8 天)";
  db.saveBatch(task.id, ["X2"], retry);
  const [second, old] = db.listBatches();
  assert.equal(second.batchNo, 2);
  assert.equal(old.id, first.id);
  assert.equal(db.getBatch(first.id).rawText, raw);
  assert.equal(db.getBatch(second.id).rawText, retry);
  assert.deepEqual(
    db.get(task.id).items.map((item) => item.batchId),
    [first.id, second.id],
  );
  assert.throws(() => db.saveBatch(task.id, ["X1"], raw), /已经完成/);
  assert.equal(db.listBatches().length, 2);
});

test("searches raw batches by exact tracking number across retries and tasks, including parse failures", (t) => {
  const db = memory(t);
  const task = db.create({ numbers: ["AA1", "AA10", "AA'_%", "001"] });
  db.setStatus(task.id, "running");
  db.saveBatch(task.id, ["AA1", "AA'_%", "001"], "无法解析的原文");
  const first = db.listBatches()[0];
  db.saveBatch(task.id, ["AA10"], "AA10\t中国\t美国\t已妥投\t成功签收\t(7 天)");
  db.finish(task.id);
  db.retryFailed(task.id);
  db.setStatus(task.id, "running");
  db.saveBatch(task.id, ["AA1"], "AA1\t中国\t美国\t已妥投\t成功签收\t(7 天)");
  const retry = db.listBatches()[0];
  const other = db.create({ numbers: ["AA1"] });
  db.setStatus(other.id, "running");
  db.saveBatch(other.id, ["AA1"], "仍然无法解析");
  const latest = db.listBatches()[0];
  assert.deepEqual(
    db.listBatches("  aa1  ").map((batch) => batch.id),
    [latest.id, retry.id, first.id],
  );
  assert.deepEqual(
    db.listBatches("AA'_%").map((batch) => batch.id),
    [first.id],
  );
  assert.deepEqual(
    db.listBatches("001").map((batch) => batch.id),
    [first.id],
  );
  assert.equal(db.listBatches("1").length, 0);
  assert.equal(db.listBatches("AA").length, 0);
  assert.equal(db.listBatches("UNKNOWN").length, 0);
  assert.equal(db.listBatches(" ").length, 4);
  assert.throws(() => db.listBatches(null), /格式/);
  assert.throws(() => db.listBatches({ trackingNumber: "AA1" }), /格式/);
});

test("copies with recognized headers map to the correct number, including overlapping prefixes", (t) => {
  const db = memory(t);
  const task = db.create({ numbers: ["AA1", "AA10"] });
  db.setStatus(task.id, "running");
  db.saveBatch(
    task.id,
    ["AA1", "AA10"],
    "AA10\t中国\t美国\t2026-07-21 10:50 RICHFIELD,MN,55423\t成功签收\t(7 天)\nAA1\t中国\t美国\t2026-07-21 10:50 RICHFIELD,MN,55423\t运输中\t(7 天)",
  );
  const items = db.get(task.id).items;
  assert.equal(items[0].resultScope, "item");
  assert.match(items[0].resultText, /^AA1\t/);
  assert.match(items[1].resultText, /^AA10\t/);
});

test("unknown formats fail each item and preserve the original batch", (t) => {
  const db = memory(t);
  const task = db.create({ numbers: ["X1", "X2"] });
  db.setStatus(task.id, "running");
  db.saveBatch(task.id, ["X1", "X2"], "Unknown format: X1 + X2");
  const detail = db.get(task.id);
  assert.ok(detail.items.every((item) => item.status === "failed"));
  assert.ok(detail.items.every((item) => item.error));
  const [batch] = db.listBatches();
  assert.equal(db.getBatch(batch.id).rawText, "Unknown format: X1 + X2");
});

test("empty results and premature completion are rejected; finished items cannot be overwritten", (t) => {
  const db = memory(t);
  const task = db.create({ numbers: ["X1", "X2"] });
  db.setStatus(task.id, "running");
  db.saveBatch(task.id, ["X1"], "  ");
  assert.equal(db.get(task.id).items[0].status, "failed");
  assert.throws(() => db.setStatus(task.id, "ended"), /未完成/);
  db.saveBatch(
    task.id,
    ["X2"],
    "X2\t中国\t美国\t2026-07-21 10:50 RICHFIELD,MN,55423\t成功签收\t(7 天)",
  );
  assert.throws(
    () => db.saveBatch(task.id, ["X2"], "X2\t中国\t美国\t重复\t成功签收\t(7 天)"),
    /已经完成/,
  );
});
