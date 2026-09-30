import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import type { CreateTrackingTaskInput, TaskLogEntry, TaskStatus, TrackingTask } from "../types.js";
import { TaskStore } from "../persistence/task-store.js";
import { TrackingWindow } from "../tracking/tracking-window.js";

export class TaskManager extends EventEmitter {
  private activeTaskId?: string;

  constructor(
    private readonly store: TaskStore,
    private readonly trackingWindow: TrackingWindow,
  ) {
    super();
    trackingWindow.on("human-verification", () => this.handleHumanVerification());
    trackingWindow.on("closed", () => this.handleWindowClosed());
    this.recoverInterruptedTasks();
  }

  listTasks() {
    return this.store.listTasks();
  }

  listLogs() {
    return this.store.listLogs();
  }

  async resumeInterruptedTasks() {
    const interrupted = this.store
      .listTasks()
      .filter((task) => task.status === "paused" && task.pauseReason === "app-restart");
    for (const task of interrupted) await this.startTask(task.id);
  }

  createTrackingTask(input: CreateTrackingTaskInput): TrackingTask {
    const now = new Date().toISOString();
    const id = randomUUID();
    const items = input.trackingNumbers.map((item, index) => ({
      id: `${id}:${index}`,
      sourceRow: item.sourceRow,
      trackingNumber: item.trackingNumber,
      status: "pending" as const,
    }));
    const task: TrackingTask = {
      id,
      kind: "tracking",
      name: input.name,
      sourceFileName: input.sourceFileName,
      createdAt: now,
      updatedAt: now,
      status: "queued",
      total: items.length,
      done: 0,
      failed: 0,
      currentBatch: 0,
      totalBatches: Math.ceil(items.length / 40),
      batchSize: 40,
      items,
    };
    this.store.saveTask(task);
    this.addLog(task.id, "info", `已创建任务 · ${task.name} · ${task.total} 个单号`);
    this.emitTasksChanged();
    void this.startTask(task.id);
    return task;
  }

  async updateStatus(taskId: string, status: TaskStatus): Promise<TrackingTask> {
    if (status === "running") return this.startTask(taskId);
    if (status === "paused" || status === "cancelled") this.trackingWindow.close();
    const task = this.store.listTasks().find((item) => item.id === taskId);
    if (!task) throw new Error("任务不存在");
    const updated = {
      ...task,
      status,
      pauseReason: status === "paused" ? ("user" as const) : undefined,
      updatedAt: new Date().toISOString(),
    };
    this.store.saveTask(updated);
    this.addLog(task.id, "info", `任务状态已更新 · ${status}`);
    this.emitTasksChanged();
    return updated;
  }

  private async startTask(taskId: string): Promise<TrackingTask> {
    const task = this.store.listTasks().find((item) => item.id === taskId);
    if (!task) throw new Error("任务不存在");
    if (this.activeTaskId && this.activeTaskId !== taskId) return task;
    const currentBatch = Math.max(task.currentBatch, 1);
    const start = (currentBatch - 1) * task.batchSize;
    const batchItems = task.items.slice(start, start + task.batchSize);
    const updated: TrackingTask = {
      ...task,
      status: "running",
      pauseReason: undefined,
      currentBatch,
      updatedAt: new Date().toISOString(),
      items: task.items.map((item, index) =>
        index >= start && index < start + batchItems.length
          ? { ...item, status: "running" as const }
          : item,
      ),
    };
    this.store.saveTask(updated);
    this.activeTaskId = taskId;
    this.addLog(task.id, "info", `开始打开第 ${currentBatch} 批 · ${batchItems.length} 个单号`);
    this.emitTasksChanged();
    try {
      await this.trackingWindow.openBatch(batchItems.map((item) => item.trackingNumber));
    } catch (error) {
      const message = error instanceof Error ? error.message : "查询窗口打开失败";
      this.setStatusFromRunner(taskId, "failed", message);
    }
    return updated;
  }

  private recoverInterruptedTasks() {
    for (const task of this.store.listTasks()) {
      if (task.status === "running" || task.status === "waiting") {
        const updated = {
          ...task,
          status: "paused" as const,
          pauseReason: "app-restart" as const,
          updatedAt: new Date().toISOString(),
        };
        this.store.saveTask(updated);
        this.addLog(task.id, "warn", "应用重新启动，未完成任务已暂停");
      }
    }
  }

  private handleHumanVerification() {
    if (this.activeTaskId)
      this.setStatusFromRunner(
        this.activeTaskId,
        "waiting",
        "检测到人机验证，请在 17TRACK 窗口中完成验证",
      );
  }

  private handleWindowClosed() {
    if (!this.activeTaskId) return;
    const task = this.store.listTasks().find((item) => item.id === this.activeTaskId);
    if (task && (task.status === "running" || task.status === "waiting"))
      this.setStatusFromRunner(task.id, "paused", "查询窗口已关闭，任务已暂停", "window-closed");
    this.activeTaskId = undefined;
  }

  private setStatusFromRunner(
    taskId: string,
    status: TaskStatus,
    message: string,
    pauseReason?: "window-closed",
  ) {
    const task = this.store.listTasks().find((item) => item.id === taskId);
    if (!task) return;
    this.store.saveTask({ ...task, status, pauseReason, updatedAt: new Date().toISOString() });
    this.addLog(taskId, status === "waiting" ? "warn" : "info", message);
    this.emitTasksChanged();
  }

  private addLog(taskId: string | undefined, level: TaskLogEntry["level"], message: string) {
    const entry: TaskLogEntry = {
      id: randomUUID(),
      taskId,
      createdAt: new Date().toISOString(),
      level,
      message,
    };
    this.store.appendLog(entry);
    this.emit("log", entry);
  }

  private emitTasksChanged() {
    this.emit("tasks-changed", this.store.listTasks());
  }
}
