import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TaskDatabase } from "./database.js";
import { createTaskWorkbook, exportFileName } from "./export.js";
import { queryTracking, stopQuery, QueryPausedError } from "./tracking.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
let mainWindow: BrowserWindow | undefined;
let database: TaskDatabase;
let activeTask: { id: number; finished: Promise<void> } | undefined;
let quitting = false;

function changed() {
  mainWindow?.webContents.send("tasks:changed", database.list());
}

function message(taskId: number, text: string) {
  mainWindow?.webContents.send("tasks:message", { taskId, message: text });
}

function taskId(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0)
    throw new Error("任务编号不正确");
  return value;
}

function runTask(id: number) {
  if (activeTask) throw new Error("请先暂停当前任务");
  const task = database.get(id);
  if (task.status !== "paused") throw new Error("只有暂停的任务可以继续查询");
  const numbers = database.pending(id);
  if (!numbers.length) {
    const ended = database.finish(id);
    changed();
    return ended;
  }
  database.setStatus(id, "running");
  const job = { id, finished: Promise.resolve() };
  activeTask = job;
  changed();
  job.finished = (async () => {
    try {
      database.markProcessing(id, numbers);
      changed();
      await queryTracking(
        numbers,
        (text) => message(id, text),
        (batch, text) => {
          database.saveBatch(id, batch, text);
          changed();
        },
      );
      database.finish(id);
    } catch (error) {
      if (error instanceof QueryPausedError) {
        database.releaseProcessing(id);
        database.setStatus(id, "paused");
        message(id, error.message);
      } else {
        const text = error instanceof Error ? error.message : "查询失败";
        database.releaseProcessing(id, text);
        database.finish(id);
        message(id, text);
      }
    } finally {
      if (activeTask === job) activeTask = undefined;
      changed();
    }
  })();
  void job.finished.catch(console.error);
  return database.get(id);
}

async function pauseTask(id: number) {
  const task = database.get(id);
  if (task.status !== "running") return task;
  const job = activeTask;
  if (job?.id === id) {
    stopQuery();
    await job.finished;
  } else {
    database.setStatus(id, "paused");
    changed();
  }
  return database.get(id);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: "#ffffff",
    resizable: true,
    webPreferences: {
      preload: path.join(currentDir, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  mainWindow = win;
  win.on("closed", () => {
    if (mainWindow !== win) return;
    mainWindow = undefined;
    if (activeTask) void pauseTask(activeTask.id).catch(console.error);
  });
  if (process.env.OPEN_DEVTOOLS === "1") win.webContents.openDevTools({ mode: "detach" });
  if (process.env.VITE_DEV_SERVER_URL) void win.loadURL(process.env.VITE_DEV_SERVER_URL);
  else void win.loadFile(path.join(currentDir, "../dist/index.html"));
}

app
  .whenReady()
  .then(() => {
    const directory = app.getPath("userData");
    mkdirSync(directory, { recursive: true });
    database = new TaskDatabase(path.join(directory, "trackbox.sqlite"));
    database.recoverInterrupted();
    ipcMain.handle("tasks:list", () => database.list());
    ipcMain.handle("tasks:get", (_event, id: unknown) => database.get(taskId(id)));
    ipcMain.handle("tasks:batches", (_event, trackingNumber: unknown) =>
      database.listBatches(trackingNumber),
    );
    ipcMain.handle("tasks:batch", (_event, id: unknown) => database.getBatch(taskId(id)));
    ipcMain.handle("tasks:export", async (_event, value: unknown) => {
      const id = taskId(value);
      const task = database.get(id);
      if (!mainWindow || mainWindow.isDestroyed()) throw new Error("主窗口未打开");
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: "导出任务明细",
        defaultPath: exportFileName(task),
        filters: [{ name: "Excel 工作簿", extensions: ["xlsx"] }],
      });
      if (canceled || !filePath) return null;
      await writeFile(filePath, createTaskWorkbook(database.get(id)));
      return filePath;
    });
    ipcMain.handle("tasks:items-page", (_event, query: unknown) =>
      database.itemsPage(query as never),
    );
    ipcMain.handle("tasks:create", (_event, input: unknown) => {
      if (activeTask) throw new Error("请先暂停当前任务");
      return runTask(database.create(input).id);
    });
    ipcMain.handle("tasks:pause", (_event, id: unknown) => pauseTask(taskId(id)));
    ipcMain.handle("tasks:resume", (_event, id: unknown) => runTask(taskId(id)));
    ipcMain.handle("tasks:retry-failed", (_event, value: unknown) => {
      if (activeTask) throw new Error("请先暂停当前任务");
      const id = taskId(value);
      database.retryFailed(id);
      changed();
      return runTask(id);
    });
    createWindow();
    app.on("activate", () => {
      if (!mainWindow) createWindow();
    });
  })
  .catch((error) => {
    console.error(error);
    app.quit();
  });

app.on("before-quit", (event) => {
  if (!activeTask || quitting) return;
  event.preventDefault();
  quitting = true;
  void pauseTask(activeTask.id).finally(() => app.quit());
});
app.on("will-quit", () => database?.close());
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
