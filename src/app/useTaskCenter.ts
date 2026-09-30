import { useEffect, useMemo, useState } from "react";
import type { TaskStatus } from "@/shared/task";
import { formatTime, toTaskView, type TaskView } from "@/features/task-center/types";

export function useTaskCenter() {
  const [tasks, setTasks] = useState<TaskView[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [taskOpen, setTaskOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    const desktop = window.desktop;
    if (!desktop) {
      setLogs(["桌面桥接未加载，请通过 Electron 启动应用"]);
      return () => {
        mounted = false;
      };
    }
    void Promise.all([desktop.tasks.list(), desktop.tasks.logs()]).then(
      ([storedTasks, storedLogs]) => {
        if (!mounted) return;
        setTasks(storedTasks.map(toTaskView));
        setLogs(storedLogs.map((entry) => `${formatTime(entry.createdAt)}  ${entry.message}`));
      },
    );

    const unsubscribeTasks = desktop.tasks.onChanged((nextTasks) => {
      setTasks(nextTasks.map(toTaskView));
    });
    const unsubscribeLogs = desktop.tasks.onLog((entry) => {
      setLogs((previous) =>
        [`${formatTime(entry.createdAt)}  ${entry.message}`, ...previous].slice(0, 100),
      );
    });

    return () => {
      mounted = false;
      unsubscribeTasks();
      unsubscribeLogs();
    };
  }, []);

  const activeTask = tasks.find((task) => task.status === "running" || task.status === "waiting");
  const activeCount = tasks.filter((task) =>
    ["queued", "running", "waiting", "paused"].includes(task.status),
  ).length;
  const activePercent = activeTask ? Math.round((activeTask.done / activeTask.total) * 100) : 0;
  const completedCount = useMemo(
    () => tasks.reduce((total, task) => total + task.done, 0),
    [tasks],
  );

  const createTask = async (input: Parameters<typeof window.desktop.tasks.create>[0]) => {
    if (!window.desktop) throw new Error("桌面桥接未加载，请通过 Electron 启动应用");
    const task = await window.desktop.tasks.create(input);
    setTaskOpen(true);
    return task;
  };

  const updateTask = (id: string, status: TaskStatus) =>
    window.desktop
      ? window.desktop.tasks.updateStatus(id, status)
      : Promise.reject(new Error("桌面桥接未加载，请通过 Electron 启动应用"));

  const toggleTasks = (open: boolean) => {
    setTaskOpen(open);
    if (open) setLogOpen(false);
  };

  const toggleLogs = (open: boolean) => {
    setLogOpen(open);
    if (open) setTaskOpen(false);
  };

  return {
    tasks,
    logs,
    taskOpen,
    logOpen,
    activeTask,
    activeCount,
    activePercent,
    completedCount,
    createTask,
    updateTask,
    toggleTasks,
    toggleLogs,
    closeTasks: () => setTaskOpen(false),
    clearLogs: () => setLogs([]),
  };
}
