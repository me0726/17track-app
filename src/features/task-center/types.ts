import type { TaskStatus, TrackingTask } from "@/shared/task";

export type TaskView = TrackingTask & { batch: number; batches: number; updated: string };

export const statusText: Record<TaskStatus, string> = {
  queued: "排队中",
  running: "正在查询",
  waiting: "等待验证",
  paused: "已暂停",
  complete: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

export const statusVariant: Record<
  TaskStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  queued: "secondary",
  running: "default",
  waiting: "outline",
  paused: "secondary",
  complete: "outline",
  failed: "destructive",
  cancelled: "secondary",
};

export function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

export function toTaskView(task: TrackingTask): TaskView {
  return {
    ...task,
    batch: Math.max(task.currentBatch, 1),
    batches: task.totalBatches,
    updated: formatTime(task.updatedAt),
  };
}
