import { ipcMain, type BrowserWindow } from "electron";
import type { CreateTrackingTaskInput, TaskStatus } from "./types.js";
import { TaskManager } from "./tasks/task-manager.js";

export function registerTaskIpc(manager: TaskManager, getWindow: () => BrowserWindow | undefined) {
  ipcMain.handle("tasks:list", () => manager.listTasks());
  ipcMain.handle("tasks:logs", () => manager.listLogs());
  ipcMain.handle("tasks:create", (_event, input: CreateTrackingTaskInput) =>
    manager.createTrackingTask(input),
  );
  ipcMain.handle("tasks:update-status", (_event, taskId: string, status: TaskStatus) =>
    manager.updateStatus(taskId, status),
  );

  manager.on("tasks-changed", (tasks) => getWindow()?.webContents.send("tasks:changed", tasks));
  manager.on("log", (entry) => getWindow()?.webContents.send("tasks:log", entry));
}
