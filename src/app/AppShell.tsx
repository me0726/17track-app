import type { ReactNode } from "react";
import { ChevronDown, CircleHelp, History, ListTodo, Logs, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { LogPopover } from "@/features/task-center/LogPopover";
import { TaskPopover } from "@/features/task-center/TaskPopover";
import type { TaskView } from "@/features/task-center/types";
import type { TaskStatus } from "@/shared/task";

interface AppShellProps {
  activeNav: string | null;
  tasks: TaskView[];
  logs: string[];
  taskOpen: boolean;
  logOpen: boolean;
  activeTask?: TaskView;
  activeCount: number;
  activePercent: number;
  onSelectTool: () => void;
  onSelectHistory: () => void;
  onTasksOpenChange: (open: boolean) => void;
  onLogsOpenChange: (open: boolean) => void;
  onUpdateTask: (id: string, status: TaskStatus) => void;
  onClearLogs: () => void;
  children: ReactNode;
}

export function AppShell({
  activeNav,
  tasks,
  logs,
  taskOpen,
  logOpen,
  activeTask,
  activeCount,
  activePercent,
  onSelectTool,
  onSelectHistory,
  onTasksOpenChange,
  onLogsOpenChange,
  onUpdateTask,
  onClearLogs,
  children,
}: AppShellProps) {
  return (
    <div className="flex h-screen min-w-0 overflow-hidden rounded-xl bg-background text-foreground">
      <aside className="flex h-full w-60 shrink-0 flex-col border-r bg-card px-3">
        <div className="flex h-16 items-center gap-2.5 px-2.5 font-heading text-lg font-extrabold tracking-tight">
          <div className="flex size-6 items-end justify-center gap-0.5 rounded-md bg-primary p-1">
            <span className="h-2 w-0.5 rounded-full bg-primary-foreground/70" />
            <span className="h-3 w-0.5 rounded-full bg-primary-foreground" />
            <span className="h-2.5 w-0.5 rounded-full bg-primary-foreground/85" />
          </div>
          <span>Trackbox</span>
        </div>
        <div className="px-2.5 pb-1 pt-5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          工具
        </div>
        <Button
          variant={activeNav === "物流查询" ? "secondary" : "ghost"}
          className="h-9 w-full justify-start gap-2.5 px-2.5 text-xs"
          onClick={onSelectTool}
        >
          <Truck data-icon="inline-start" />
          物流查询
          <Badge variant="secondary" className="ml-auto px-1.5 text-[9px] uppercase">
            NEW
          </Badge>
        </Button>
        <div className="mt-4 px-2.5 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          管理
        </div>
        <Button
          variant={activeNav === "任务记录" ? "secondary" : "ghost"}
          className="h-9 w-full justify-start gap-2.5 px-2.5 text-xs"
          onClick={onSelectHistory}
        >
          <History data-icon="inline-start" />
          任务记录
        </Button>
      </aside>
      <main className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-6">
          <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
            <span>Trackbox</span>
            {activeNav && (
              <>
                <span>/</span>
                <strong className="font-medium text-foreground">{activeNav}</strong>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Popover open={taskOpen} onOpenChange={onTasksOpenChange}>
              <PopoverTrigger render={<Button variant="outline" size="sm" className="text-xs" />}>
                <span className="relative">
                  <ListTodo data-icon="inline-start" />
                  {activeCount > 0 && (
                    <span className="absolute -right-1 -top-1 size-1.5 rounded-full bg-primary ring-1 ring-background" />
                  )}
                </span>
                任务
                {activeTask && (
                  <Badge variant="secondary" className="px-1.5 text-[10px]">
                    {activePercent}%
                  </Badge>
                )}
                <ChevronDown data-icon="inline-end" />
              </PopoverTrigger>
              <TaskPopover
                tasks={tasks}
                onClose={() => onTasksOpenChange(false)}
                onUpdate={onUpdateTask}
              />
            </Popover>
            <Popover open={logOpen} onOpenChange={onLogsOpenChange}>
              <PopoverTrigger
                render={<Button variant="outline" size="icon-sm" aria-label="运行日志" />}
              >
                <Logs />
              </PopoverTrigger>
              <LogPopover logs={logs} onClear={onClearLogs} />
            </Popover>
            <Button variant="ghost" size="icon-sm" aria-label="帮助">
              <CircleHelp />
            </Button>
          </div>
        </header>
        <section className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto px-6 py-6">
          {children}
        </section>
        <footer className="flex shrink-0 justify-between px-6 pb-4 pt-2 text-[9px] text-muted-foreground">
          <span>
            TRACKBOX <span className="px-1">·</span>本地自动化工具箱
          </span>
          <span>v0.1.0</span>
        </footer>
      </main>
    </div>
  );
}
