export type TaskStatus =
  "queued" | "running" | "waiting" | "paused" | "complete" | "failed" | "cancelled";

export type TrackingItemStatus = "pending" | "running" | "complete" | "failed";

export interface TrackingItem {
  id: string;
  sourceRow?: number;
  trackingNumber: string;
  status: TrackingItemStatus;
  statusText?: string;
  carrier?: string;
  updatedAt?: string;
}

export interface TrackingTask {
  id: string;
  kind: "tracking";
  name: string;
  sourceFileName?: string;
  createdAt: string;
  updatedAt: string;
  status: TaskStatus;
  total: number;
  done: number;
  failed: number;
  currentBatch: number;
  totalBatches: number;
  batchSize: number;
  items: TrackingItem[];
  error?: string;
  pauseReason?: "user" | "window-closed" | "app-restart";
}

export interface CreateTrackingTaskInput {
  name: string;
  sourceFileName?: string;
  trackingNumbers: Array<{ trackingNumber: string; sourceRow?: number }>;
}

export interface TaskLogEntry {
  id: string;
  taskId?: string;
  createdAt: string;
  level: "info" | "warn" | "error";
  message: string;
}

export interface PersistedState {
  tasks: TrackingTask[];
  logs: TaskLogEntry[];
}
