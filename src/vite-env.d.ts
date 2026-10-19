/// <reference types="vite/client" />

import type {
  CreateTaskInput,
  ItemPage,
  ItemPageQuery,
  TaskBatch,
  TaskBatchSummary,
  TaskDetail,
  TaskMessage,
  TaskSummary,
} from "../electron/task-types";

declare global {
  interface Window {
    desktop?: {
      platform: string;
      tasks: {
        list: () => Promise<TaskSummary[]>;
        get: (id: number) => Promise<TaskDetail>;
        batches: (trackingNumber?: string) => Promise<TaskBatchSummary[]>;
        batch: (id: number) => Promise<TaskBatch>;
        export: (id: number) => Promise<string | null>;
        itemsPage: (query: ItemPageQuery) => Promise<ItemPage>;
        create: (input: CreateTaskInput) => Promise<TaskDetail>;
        pause: (id: number) => Promise<TaskDetail>;
        resume: (id: number) => Promise<TaskDetail>;
        retryFailed: (id: number) => Promise<TaskDetail>;
        onChanged: (callback: (tasks: TaskSummary[]) => void) => () => void;
        onMessage: (callback: (message: TaskMessage) => void) => () => void;
      };
    };
  }
}
