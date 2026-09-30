/// <reference types="vite/client" />

import type {
  CreateTrackingTaskInput,
  TaskLogEntry,
  TrackingTask,
  TaskStatus,
} from "./shared/task";

declare global {
  interface Window {
    desktop: {
      platform: string;
      tasks: {
        list: () => Promise<TrackingTask[]>;
        create: (input: CreateTrackingTaskInput) => Promise<TrackingTask>;
        updateStatus: (taskId: string, status: TaskStatus) => Promise<TrackingTask>;
        onChanged: (callback: (tasks: TrackingTask[]) => void) => () => void;
        logs: () => Promise<TaskLogEntry[]>;
        onLog: (callback: (entry: TaskLogEntry) => void) => () => void;
      };
    };
  }
}
