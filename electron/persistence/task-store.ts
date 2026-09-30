import fs from "node:fs";
import path from "node:path";
import type { TaskLogEntry, TrackingTask } from "../types.js";

interface PersistedState {
  tasks: TrackingTask[];
  logs: TaskLogEntry[];
}

const emptyState: PersistedState = { tasks: [], logs: [] };

export class TaskStore {
  private readonly filePath: string;
  private state: PersistedState;

  constructor(userDataPath: string) {
    this.filePath = path.join(userDataPath, "trackbox-state.json");
    this.state = this.read();
  }

  listTasks(): TrackingTask[] {
    return structuredClone(this.state.tasks);
  }

  saveTask(task: TrackingTask): TrackingTask {
    const index = this.state.tasks.findIndex((item) => item.id === task.id);
    if (index === -1) this.state.tasks.unshift(task);
    else this.state.tasks[index] = task;
    this.write();
    return structuredClone(task);
  }

  listLogs(): TaskLogEntry[] {
    return structuredClone(this.state.logs);
  }

  appendLog(entry: TaskLogEntry): TaskLogEntry {
    this.state.logs.unshift(entry);
    this.state.logs = this.state.logs.slice(0, 500);
    this.write();
    return structuredClone(entry);
  }

  private read(): PersistedState {
    try {
      const value = JSON.parse(fs.readFileSync(this.filePath, "utf8")) as Partial<PersistedState>;
      return { tasks: value.tasks ?? [], logs: value.logs ?? [] };
    } catch {
      return structuredClone(emptyState);
    }
  }

  private write() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify(this.state, null, 2), "utf8");
    fs.renameSync(temporaryPath, this.filePath);
  }
}
