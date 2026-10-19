export type TaskStatus = "running" | "paused" | "ended";
export type ItemStatus = "pending" | "processing" | "completed" | "failed";

export interface CreateTaskInput {
  numbers: string[];
  sourceFileName?: string;
}

export interface TaskSummary {
  id: number;
  name: string;
  sourceFileName: string | null;
  status: TaskStatus;
  total: number;
  completed: number;
  failed: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskItem {
  id: number;
  taskId: number;
  trackingNumber: string;
  status: ItemStatus;
  resultText: string | null;
  resultScope: "item" | "batch" | null;
  batchNo: number | null;
  batchId: number | null;
  originCountry: string | null;
  destinationCountry: string | null;
  latestEvent: string | null;
  logisticsStatus: string | null;
  transitTime: string | null;
  error: string | null;
  updatedAt: string;
}

export interface TaskDetail extends TaskSummary {
  items: TaskItem[];
}

export interface TaskMessage {
  taskId: number;
  message: string;
}

export interface TaskBatchSummary {
  id: number;
  taskId: number;
  taskName: string;
  batchNo: number;
  numberCount: number;
  createdAt: string;
}

export interface TaskBatch extends TaskBatchSummary {
  rawText: string;
  trackingNumbers: string[];
}

export interface ItemPageQuery {
  taskId: number;
  status?: ItemStatus | "all";
  page?: number;
  pageSize?: number;
}

export interface ItemPage {
  items: TaskItem[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<ItemStatus, number>;
}
