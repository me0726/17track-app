import { DatabaseSync } from "node:sqlite";
import { parseResults } from "./result-parser.js";
import type {
  ItemPage,
  ItemPageQuery,
  TaskBatch,
  TaskBatchSummary,
  TaskDetail,
  TaskItem,
  TaskStatus,
  TaskSummary,
} from "./task-types.js";

const taskQuery = `SELECT t.id, t.name, t.source_file AS sourceFileName, t.status,
  t.created_at AS createdAt, t.updated_at AS updatedAt, COUNT(i.id) AS total,
  COALESCE(SUM(i.status = 'completed'), 0) AS completed,
  COALESCE(SUM(i.status = 'failed'), 0) AS failed
  FROM task t LEFT JOIN task_item i ON i.task_id = t.id`;
const itemQuery = `SELECT id, task_id AS taskId, tracking_number AS trackingNumber, status,
  result_text AS resultText, result_scope AS resultScope, batch_no AS batchNo, batch_id AS batchId, updated_at AS updatedAt,
  origin_country AS originCountry, destination_country AS destinationCountry, latest_event AS latestEvent,
  logistics_status AS logisticsStatus, transit_time AS transitTime, error FROM task_item`;
const itemSchema = `CREATE TABLE IF NOT EXISTS task_item (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  tracking_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  batch_id INTEGER REFERENCES task_batch(id),
  result_text TEXT, result_scope TEXT CHECK (result_scope IN ('item', 'batch')), batch_no INTEGER,
  origin_country TEXT, destination_country TEXT, latest_event TEXT, logistics_status TEXT, transit_time TEXT,
  error TEXT, updated_at TEXT NOT NULL, UNIQUE(task_id, tracking_number)
)`;
const batchQuery = `SELECT b.id, b.task_id AS taskId, t.name AS taskName, b.batch_no AS batchNo,
  b.number_count AS numberCount, b.created_at AS createdAt FROM task_batch b JOIN task t ON t.id = b.task_id`;
const taskSchema = `(
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, source_file TEXT,
  status TEXT NOT NULL CHECK (status IN ('running', 'paused', 'ended')),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
)`;

export class TaskDatabase {
  private readonly db: DatabaseSync;

  constructor(file: string) {
    this.db = new DatabaseSync(file);
    try {
      this.db.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;
        CREATE TABLE IF NOT EXISTS task ${taskSchema};
        CREATE TABLE IF NOT EXISTS task_batch (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          task_id INTEGER NOT NULL REFERENCES task(id) ON DELETE CASCADE,
          batch_no INTEGER NOT NULL,
          raw_text TEXT NOT NULL,
          tracking_numbers TEXT NOT NULL,
          number_count INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          UNIQUE(task_id, batch_no)
        );
        ${itemSchema};
        CREATE INDEX IF NOT EXISTS task_item_pending ON task_item(task_id, status, id);`);
    } catch (error) {
      this.db.close();
      throw error;
    }
  }

  create(input: unknown): TaskDetail {
    const value = input as { numbers?: unknown; sourceFileName?: unknown } | null;
    if (
      !value ||
      !Array.isArray(value.numbers) ||
      value.numbers.some((number) => typeof number !== "string")
    )
      throw new Error("物流单号格式不正确");
    const numbers = [
      ...new Set(
        (value.numbers as string[]).map((number) => number.trim().toUpperCase()).filter(Boolean),
      ),
    ];
    if (!numbers.length) throw new Error("请输入物流单号");
    const source =
      typeof value.sourceFileName === "string" ? value.sourceFileName.trim() || null : null;
    const now = new Date().toISOString();
    let id: number;
    this.db.exec("BEGIN IMMEDIATE");
    try {
      id = Number(
        this.db
          .prepare(
            "INSERT INTO task(name, source_file, status, created_at, updated_at) VALUES (?, ?, 'paused', ?, ?)",
          )
          .run(source ?? "手动输入", source, now, now).lastInsertRowid,
      );
      const insert = this.db.prepare(
        "INSERT INTO task_item(task_id, tracking_number, updated_at) VALUES (?, ?, ?)",
      );
      for (const number of numbers) insert.run(id, number, now);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    return this.get(id!);
  }

  list(): TaskSummary[] {
    return this.db
      .prepare(taskQuery + " GROUP BY t.id ORDER BY t.id DESC")
      .all() as unknown as TaskSummary[];
  }

  listBatches(trackingNumber: unknown = ""): TaskBatchSummary[] {
    if (typeof trackingNumber !== "string") throw new Error("搜索单号格式不正确");
    const number = trackingNumber.trim().toUpperCase();
    if (number)
      return this.db
        .prepare(
          batchQuery +
            ` WHERE EXISTS (
          SELECT 1 FROM json_each(b.tracking_numbers) n WHERE UPPER(CAST(n.value AS TEXT)) = ?
        ) ORDER BY b.id DESC`,
        )
        .all(number) as unknown as TaskBatchSummary[];
    return this.db
      .prepare(batchQuery + " ORDER BY b.id DESC")
      .all() as unknown as TaskBatchSummary[];
  }

  getBatch(id: number): TaskBatch {
    const batch = this.db.prepare(batchQuery + " WHERE b.id = ?").get(id) as unknown as
      TaskBatchSummary | undefined;
    if (!batch) throw new Error("原始批次不存在");
    const content = this.db
      .prepare(
        "SELECT raw_text AS rawText, tracking_numbers AS trackingNumbers FROM task_batch WHERE id = ?",
      )
      .get(id) as { rawText: string; trackingNumbers: string };
    return {
      ...batch,
      rawText: content.rawText,
      trackingNumbers: JSON.parse(content.trackingNumbers),
    };
  }

  get(id: number): TaskDetail {
    const task = this.summary(id);
    const items = this.db
      .prepare(itemQuery + " WHERE task_id = ? ORDER BY id")
      .all(id) as unknown as TaskItem[];
    return { ...task, items };
  }

  private summary(id: number): TaskSummary {
    const task = this.db.prepare(taskQuery + " WHERE t.id = ? GROUP BY t.id").get(id) as unknown as
      TaskSummary | undefined;
    if (!task) throw new Error("任务不存在");
    return task;
  }

  itemsPage(query: ItemPageQuery): ItemPage {
    this.summary(query.taskId);
    const status = query.status ?? "all";
    if (!["all", "pending", "processing", "completed", "failed"].includes(status))
      throw new Error("明细状态不正确");
    const requestedPage = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    if (
      !Number.isSafeInteger(requestedPage) ||
      requestedPage < 1 ||
      !Number.isSafeInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > 100
    )
      throw new Error("分页参数不正确");
    const counts = this.db
      .prepare(
        `SELECT COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending,
      COUNT(CASE WHEN status = 'processing' THEN 1 END) AS processing,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) AS failed FROM task_item WHERE task_id = ?`,
      )
      .get(query.taskId) as unknown as ItemPage["counts"];
    const where = status === "all" ? "task_id = ?" : "task_id = ? AND status = ?";
    const params = status === "all" ? [query.taskId] : [query.taskId, status];
    const { total } = this.db
      .prepare("SELECT COUNT(*) AS total FROM task_item WHERE " + where)
      .get(...params) as { total: number };
    const page = Math.min(requestedPage, Math.max(1, Math.ceil(total / pageSize)));
    const items = this.db
      .prepare(itemQuery + " WHERE " + where + " ORDER BY id LIMIT ? OFFSET ?")
      .all(...params, pageSize, (page - 1) * pageSize) as unknown as TaskItem[];
    return { items, total, page, pageSize, counts };
  }

  pending(id: number): string[] {
    return (
      this.db
        .prepare(
          "SELECT tracking_number AS number FROM task_item WHERE task_id = ? AND status = 'pending' ORDER BY id",
        )
        .all(id) as Array<{ number: string }>
    ).map((item) => item.number);
  }

  markProcessing(id: number, numbers: string[]) {
    const now = new Date().toISOString();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      if (this.summary(id).status !== "running") throw new Error("任务当前没有运行");
      const update = this.db
        .prepare(`UPDATE task_item SET status = 'processing', result_text = NULL,
        result_scope = NULL, origin_country = NULL, destination_country = NULL,
        latest_event = NULL, logistics_status = NULL, transit_time = NULL, error = NULL, updated_at = ?
        WHERE task_id = ? AND tracking_number = ? AND status = 'pending'`);
      for (const number of numbers) {
        if (Number(update.run(now, id, number).changes) !== 1)
          throw new Error("只能处理属于当前任务的等待中单号");
      }
      this.db.prepare("UPDATE task SET updated_at = ? WHERE id = ?").run(now, id);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  saveBatch(id: number, numbers: string[], text: string) {
    const now = new Date().toISOString();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      if (this.summary(id).status !== "running") throw new Error("任务当前没有运行");
      if (!numbers.length || new Set(numbers).size !== numbers.length)
        throw new Error("批次单号不能为空或重复");
      const batch = this.db
        .prepare(
          "SELECT COALESCE(MAX(batch_no), 0) + 1 AS number FROM task_batch WHERE task_id = ?",
        )
        .get(id) as { number: number };
      const batchId = Number(
        this.db
          .prepare(
            `INSERT INTO task_batch(task_id, batch_no, raw_text, tracking_numbers, number_count, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .run(id, batch.number, text, JSON.stringify(numbers), numbers.length, now)
          .lastInsertRowid,
      );
      const update = this.db
        .prepare(`UPDATE task_item SET status = ?, result_text = ?, result_scope = 'item',
        batch_no = ?, batch_id = ?, origin_country = ?, destination_country = ?, latest_event = ?, logistics_status = ?,
        transit_time = ?, error = ?, updated_at = ? WHERE task_id = ? AND tracking_number = ? AND status IN ('pending', 'processing')`);
      for (const result of parseResults(text, numbers)) {
        if (
          Number(
            update.run(
              result.error ? "failed" : "completed",
              result.text,
              batch.number,
              batchId,
              result.originCountry,
              result.destinationCountry,
              result.latestEvent,
              result.logisticsStatus,
              result.transitTime,
              result.error,
              now,
              id,
              result.trackingNumber,
            ).changes,
          ) !== 1
        )
          throw new Error("批次单号不属于当前任务、已经完成，或失败项尚未重试");
      }
      this.db.prepare("UPDATE task SET updated_at = ? WHERE id = ?").run(now, id);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  releaseProcessing(id: number, error?: string) {
    this.db
      .prepare(
        "UPDATE task_item SET status = ?, error = ?, updated_at = ? WHERE task_id = ? AND status = 'processing'",
      )
      .run(error ? "failed" : "pending", error ?? null, new Date().toISOString(), id);
  }

  finish(id: number) {
    return this.setStatus(id, "ended");
  }

  retryFailed(id: number) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const task = this.summary(id);
      if (task.status !== "ended") throw new Error("只能重试已结束任务的失败明细");
      if (!task.failed) throw new Error("没有需要重试的失败明细");
      const now = new Date().toISOString();
      this.db
        .prepare(
          `UPDATE task_item SET status = 'pending', result_text = NULL, result_scope = NULL,
        origin_country = NULL, destination_country = NULL, latest_event = NULL, logistics_status = NULL,
        transit_time = NULL, error = NULL, updated_at = ? WHERE task_id = ? AND status = 'failed'`,
        )
        .run(now, id);
      this.db
        .prepare("UPDATE task SET status = 'paused', updated_at = ? WHERE id = ?")
        .run(now, id);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    return this.get(id);
  }

  setStatus(id: number, status: TaskStatus) {
    const task = this.summary(id);
    if (task.status === "ended" && status !== "ended")
      throw new Error("任务已结束，请在详情中重试失败项");
    if (
      status === "ended" &&
      this.db
        .prepare(
          "SELECT 1 FROM task_item WHERE task_id = ? AND status IN ('pending', 'processing') LIMIT 1",
        )
        .get(id)
    )
      throw new Error("还有未完成的单号");
    this.db
      .prepare("UPDATE task SET status = ?, updated_at = ? WHERE id = ?")
      .run(status, new Date().toISOString(), id);
    return this.get(id);
  }

  recoverInterrupted() {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db
        .prepare(
          "UPDATE task_item SET status = 'pending', updated_at = ? WHERE status = 'processing'",
        )
        .run(new Date().toISOString());
      this.db
        .prepare("UPDATE task SET status = 'paused', updated_at = ? WHERE status = 'running'")
        .run(new Date().toISOString());
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  close() {
    this.db.close();
  }
}
