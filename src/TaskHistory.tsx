import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ChevronRight, History, LoaderCircle, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TaskStatus, TaskSummary } from "../electron/task-types";

export const taskStatusText: Record<TaskStatus, string> = {
  running: "查询中",
  paused: "暂停",
  ended: "已结束",
};

interface Props {
  tasks: TaskSummary[];
  runningTaskId?: number;
  pending: boolean;
  onSelect: (id: number) => void;
  onPause: (id: number) => Promise<void>;
  onResume: (id: number) => Promise<void>;
  onNewQuery: () => void;
}

export function TaskHistory({
  tasks,
  pending,
  onSelect,
  onPause,
  onResume,
  onNewQuery,
  runningTaskId,
}: Props) {
  return (
    <Card className="h-full min-h-0">
      <CardHeader className="shrink-0">
        <CardTitle className="flex items-center gap-2">
          <h1>任务记录</h1>
          <Badge variant="secondary">{tasks.length}</Badge>
        </CardTitle>
        <CardDescription>查看查询结果，继续暂停中的任务。</CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" onClick={onNewQuery}>
            <Plus data-icon="inline-start" />
            新建查询
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden [&>[data-slot=table-container]]:h-full [&>[data-slot=table-container]]:overflow-auto">
        {tasks.length ? (
          <Table className="table-fixed">
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead>任务</TableHead>
                <TableHead className="w-20">状态</TableHead>
                <TableHead className="w-14 text-right">总数</TableHead>
                <TableHead className="w-16 text-right">已完成</TableHead>
                <TableHead className="w-14 text-right">失败</TableHead>
                <TableHead className="w-28 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell>
                    <Button
                      variant="link"
                      size="sm"
                      className="block h-auto w-full truncate p-0 text-left"
                      title={task.name}
                      disabled={pending}
                      onClick={() => onSelect(task.id)}
                    >
                      {task.name}
                    </Button>
                    <p className="mt-1 text-xs text-muted-foreground">
                      #{task.id} ·{" "}
                      {new Date(task.createdAt).toLocaleString("zh-CN", {
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={task.status === "running" ? "secondary" : "outline"}>
                      {task.status === "running" && (
                        <LoaderCircle data-icon="inline-start" className="animate-spin" />
                      )}
                      {taskStatusText[task.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {task.total}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{task.completed}</TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums",
                      task.failed > 0 ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {task.failed}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {task.status === "running" && (
                        <Button
                          variant="outline"
                          size="xs"
                          disabled={pending}
                          onClick={() => {
                            void onPause(task.id);
                          }}
                        >
                          暂停
                        </Button>
                      )}
                      {task.status === "paused" && (
                        <Button
                          variant="outline"
                          size="xs"
                          disabled={pending || runningTaskId !== undefined}
                          onClick={() => {
                            void onResume(task.id);
                          }}
                        >
                          继续
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`查看任务 #${task.id} 详情`}
                        title="查看详情"
                        disabled={pending}
                        onClick={() => onSelect(task.id)}
                      >
                        <ChevronRight />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Empty className="h-full">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <History />
              </EmptyMedia>
              <EmptyTitle>还没有查询任务</EmptyTitle>
              <EmptyDescription>添加物流单号并开始查询，处理记录会保存在这里。</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" size="sm" onClick={onNewQuery}>
                <Plus data-icon="inline-start" />
                新建查询
              </Button>
            </EmptyContent>
          </Empty>
        )}
      </CardContent>
    </Card>
  );
}
