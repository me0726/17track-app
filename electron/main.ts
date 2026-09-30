import { app, BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerTaskIpc } from "./ipc.js";
import { TaskStore } from "./persistence/task-store.js";
import { TaskManager } from "./tasks/task-manager.js";
import { TrackingWindow } from "./tracking/tracking-window.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | undefined;

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    backgroundColor: "#ffffff",
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    webPreferences: { preload: path.join(currentDir, "preload.cjs"), contextIsolation: true },
  });
  mainWindow = win;
  win.on("closed", () => {
    if (mainWindow === win) mainWindow = undefined;
  });
  if (process.env.OPEN_DEVTOOLS === "1") win.webContents.openDevTools({ mode: "detach" });
  if (process.env.VITE_DEV_SERVER_URL) win.loadURL(process.env.VITE_DEV_SERVER_URL);
  else win.loadFile(path.join(currentDir, "../dist/index.html"));
};
app.whenReady().then(() => {
  const taskManager = new TaskManager(new TaskStore(app.getPath("userData")), new TrackingWindow());
  registerTaskIpc(taskManager, () => mainWindow);
  createWindow();
  void taskManager.resumeInterruptedTasks();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
