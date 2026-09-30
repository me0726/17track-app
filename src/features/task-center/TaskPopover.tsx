import { ArrowDownToLine, Check, MoreHorizontal, Pause, Play, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PopoverContent } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { TaskStatus } from "@/shared/task";
import { StatusIcon } from "./StatusIcon";
import { statusText, statusVariant, type TaskView } from "./types";

export function TaskPopover({
  tasks,
  onClose,
  onUpdate,
}: {
  tasks: TaskView[];
  onClose: () => void;
  onUpdate: (id: string, status: TaskStatus) => void;
}) {
  return (
    <PopoverContent align="end" className="w-80 p-0">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <strong className="text-sm">任务中心</strong>
          <span className="text-[10px] text-muted-foreground">{tasks.length} 个任务</span>
        </div>
        <Button variant="ghost" size="icon-xs" aria-label="关闭" onClick={onClose}>
          <X />
        </Button>
      </div>
      <ScrollArea className="max-h-102.5 px-3">
        <div className="flex flex-col">
          {tasks.map((task) => (
            <article key={task.id} className="border-b py-3 last:border-0">
              <div className="flex items-center gap-2">
                <StatusIcon status={task.status} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <strong className="truncate text-xs font-medium">{task.name}</strong>
                  <Badge variant={statusVariant[task.status]} className="w-fit text-[10px]">
                    {statusText[task.status]}
                  </Badge>
                </div>
                <Button variant="ghost" size="icon-xs" aria-label="任务菜单">
                  <MoreHorizontal />
                </Button>
              </div>
              <Progress value={Math.round((task.done / task.total) * 100)} className="my-2 h-1" />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>
                  {task.done} / {task.total} 个单号
                </span>
                <span>{Math.round((task.done / task.total) * 100)}%</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>
                  {task.status === "complete"
                    ? "已完成"
                    : `批次 ${Math.max(task.batch, 1)} / ${task.batches}`}{" "}
                  · {task.updated}
                </span>
                {task.status === "running" && (
                  <Button variant="outline" size="xs" onClick={() => onUpdate(task.id, "paused")}>
                    <Pause data-icon="inline-start" />
                    暂停
                  </Button>
                )}
                {task.status === "paused" && (
                  <Button variant="outline" size="xs" onClick={() => onUpdate(task.id, "running")}>
                    <Play data-icon="inline-start" />
                    继续
                  </Button>
                )}
                {task.status === "waiting" && (
                  <Button variant="outline" size="xs" onClick={() => onUpdate(task.id, "running")}>
                    <Check data-icon="inline-start" />
                    验证完成
                  </Button>
                )}
                {["queued", "running", "waiting", "paused"].includes(task.status) && (
                  <Button
                    variant="ghost"
                    size="xs"
                    className="text-destructive"
                    onClick={() => onUpdate(task.id, "cancelled")}
                  >
                    取消
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      </ScrollArea>
      <Button
        variant="ghost"
        className="h-9 w-full rounded-none border-t text-xs text-muted-foreground"
        onClick={onClose}
      >
        打开任务记录 <ArrowDownToLine data-icon="inline-end" />
      </Button>
    </PopoverContent>
  );
}
