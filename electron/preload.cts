import { contextBridge, ipcRenderer } from "electron";
import type {
  CreateTrackingTaskInput,
  TaskLogEntry,
  TaskStatus,
  TrackingTask,
} from "./types.js" with { "resolution-mode": "import" };

const subscribe = <T,>(channel: string, callback: (value: T) => void) => {
  const listener = (_event: Electron.IpcRendererEvent, value: T) => callback(value);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

contextBridge.exposeInMainWorld("desktop", {
  platform: process.platform,
  tasks: {
    list: () => ipcRenderer.invoke("tasks:list") as Promise<TrackingTask[]>,
    logs: () => ipcRenderer.invoke("tasks:logs") as Promise<TaskLogEntry[]>,
    create: (input: CreateTrackingTaskInput) =>
      ipcRenderer.invoke("tasks:create", input) as Promise<TrackingTask>,
    updateStatus: (taskId: string, status: TaskStatus) =>
      ipcRenderer.invoke("tasks:update-status", taskId, status) as Promise<TrackingTask>,
    onChanged: (callback: (tasks: TrackingTask[]) => void) => subscribe("tasks:changed", callback),
    onLog: (callback: (entry: TaskLogEntry) => void) => subscribe("tasks:log", callback),
  },
});
