import { contextBridge, ipcRenderer } from "electron";

const subscribe = <T,>(channel: string, callback: (value: T) => void) => {
  const listener = (_event: Electron.IpcRendererEvent, value: T) => callback(value);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

contextBridge.exposeInMainWorld("desktop", {
  platform: process.platform,
  tasks: {
    list: () => ipcRenderer.invoke("tasks:list"),
    get: (id: number) => ipcRenderer.invoke("tasks:get", id),
    batches: (trackingNumber?: string) => ipcRenderer.invoke("tasks:batches", trackingNumber),
    batch: (id: number) => ipcRenderer.invoke("tasks:batch", id),
    export: (id: number) => ipcRenderer.invoke("tasks:export", id),
    itemsPage: (query: unknown) => ipcRenderer.invoke("tasks:items-page", query),
    create: (input: { numbers: string[]; sourceFileName?: string }) =>
      ipcRenderer.invoke("tasks:create", input),
    pause: (id: number) => ipcRenderer.invoke("tasks:pause", id),
    resume: (id: number) => ipcRenderer.invoke("tasks:resume", id),
    retryFailed: (id: number) => ipcRenderer.invoke("tasks:retry-failed", id),
    onChanged: (callback: (tasks: unknown[]) => void) => subscribe("tasks:changed", callback),
    onMessage: (callback: (message: { taskId: number; message: string }) => void) =>
      subscribe("tasks:message", callback),
  },
});
