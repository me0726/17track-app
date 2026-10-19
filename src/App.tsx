import { useEffect, useRef, useState } from "react";
import { FileText, History, LoaderCircle, PackageSearch } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CreateTaskInput, TaskDetail, TaskSummary } from "../electron/task-types";
import { QueryForm } from "./QueryForm";
import { TaskHistory } from "./TaskHistory";
import { TaskDetailView } from "./TaskDetailView";
import { RawCopies } from "./RawCopies";

export function App() {
  const [tab, setTab] = useState("query");
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number>();
  const [selected, setSelected] = useState<TaskDetail | null>(null);
  const [historyId, setHistoryId] = useState<number>();
  const [rawId, setRawId] = useState<number>();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const actionLock = useRef(false);
  const runningTask = tasks.find((task) => task.status === "running");

  useEffect(() => {
    const api = window.desktop?.tasks;
    if (!api) return;
    let mounted = true;
    let receivedUpdate = false;
    const offTasks = api.onChanged((tasks) => {
      receivedUpdate = true;
      setTasks(tasks);
    });
    const offMessage = api.onMessage(({ message }) => setMessage(message));
    void api
      .list()
      .then((tasks) => {
        if (mounted && !receivedUpdate) setTasks(tasks);
      })
      .catch((error) => {
        if (mounted) setError(errorMessage(error));
      });
    return () => {
      mounted = false;
      offTasks();
      offMessage();
    };
  }, []);

  useEffect(() => {
    if (selectedId === undefined || !window.desktop) return;
    let mounted = true;
    void window.desktop.tasks
      .get(selectedId)
      .then((task) => {
        if (mounted) setSelected(task);
      })
      .catch((error) => {
        if (mounted) setError(errorMessage(error));
      });
    return () => {
      mounted = false;
    };
  }, [selectedId, tasks]);

  async function action(operation: () => Promise<TaskDetail>) {
    if (actionLock.current) return;
    if (!window.desktop) return setError("请通过 Electron 打开应用");
    actionLock.current = true;
    setPending(true);
    setError("");
    try {
      const task = await operation();
      setSelectedId(task.id);
      setSelected(task);
      setTasks(await window.desktop.tasks.list());
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      actionLock.current = false;
      setPending(false);
    }
  }

  const create = (input: CreateTaskInput) => action(() => window.desktop!.tasks.create(input));
  const pause = (id: number) => action(() => window.desktop!.tasks.pause(id));
  const resume = (id: number) => action(() => window.desktop!.tasks.resume(id));
  const retryFailed = (id: number) => action(() => window.desktop!.tasks.retryFailed(id));

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => {
        setTab(String(value));
        if (value === "history") setHistoryId(undefined);
        if (value === "raw") setRawId(undefined);
      }}
      className="h-full min-h-0 gap-0 overflow-hidden"
    >
      <header className="flex h-14 shrink-0 items-center gap-5 border-b px-4">
        <div className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <PackageSearch className="size-4" />
          </div>
          <span>Trackbox</span>
        </div>
        <Separator orientation="vertical" className="h-5" />
        <TabsList variant="line" className="gap-4">
          <TabsTrigger value="query">
            <PackageSearch data-icon="inline-start" />
            物流查询
          </TabsTrigger>
          <TabsTrigger value="history">
            <History data-icon="inline-start" />
            任务记录
          </TabsTrigger>
          <TabsTrigger value="raw">
            <FileText data-icon="inline-start" />
            原始内容
          </TabsTrigger>
        </TabsList>
        <div className="ml-auto shrink-0">
          <Badge variant={runningTask ? "secondary" : "outline"}>
            {runningTask && <LoaderCircle data-icon="inline-start" className="animate-spin" />}
            {runningTask ? `任务 #${runningTask.id} 查询中` : "就绪"}
          </Badge>
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden bg-muted/30 p-4">
        {error && (
          <Alert variant="destructive" className="shrink-0">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <TabsContent value="query" keepMounted className="min-h-0">
          <QueryForm
            task={selected}
            runningTaskId={runningTask?.id}
            pending={pending}
            onCreate={create}
            onPause={pause}
            onResume={resume}
            onError={setError}
          />
        </TabsContent>
        <TabsContent value="history" keepMounted className="min-h-0">
          {historyId !== undefined ? (
            <TaskDetailView
              key={historyId}
              taskId={historyId}
              task={selected?.id === historyId ? selected : null}
              pending={pending}
              runningTaskId={runningTask?.id}
              onBack={() => setHistoryId(undefined)}
              onOpenBatch={(id) => {
                setRawId(id);
                setTab("raw");
              }}
              onPause={pause}
              onResume={resume}
              onRetryFailed={retryFailed}
            />
          ) : (
            <TaskHistory
              tasks={tasks}
              runningTaskId={runningTask?.id}
              pending={pending}
              onSelect={(id) => {
                setHistoryId(id);
                setSelectedId(id);
                setMessage("");
              }}
              onPause={pause}
              onResume={resume}
              onNewQuery={() => setTab("query")}
            />
          )}
        </TabsContent>
        <TabsContent value="raw" keepMounted className="min-h-0">
          <RawCopies
            batchesChanged={tasks}
            selectedId={rawId}
            onSelect={setRawId}
            onOpenTask={(id) => {
              setHistoryId(id);
              setSelectedId(id);
              setMessage("");
              setTab("history");
            }}
          />
        </TabsContent>
      </main>
      <footer className="flex h-7 shrink-0 items-center justify-between gap-4 border-t px-4 text-xs text-muted-foreground">
        <span className="truncate" role="status">
          {runningTask ? message || "正在查询…" : "就绪"}
        </span>
        <span className="shrink-0">{tasks.length} 个任务</span>
      </footer>
    </Tabs>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message.replace(/^Error invoking remote method '[^']+': Error: /, "")
    : "操作失败，请重试";
}
