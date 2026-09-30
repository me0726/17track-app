import { History, ListTodo } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { StatusIcon } from "./StatusIcon";
import { statusText, statusVariant, type TaskView } from "./types";

export function TaskHistory({ tasks }: { tasks: TaskView[] }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div>
        <Badge variant="secondary" className="mb-2 gap-1.5 text-[10px]">
          <History />
          任务记录
        </Badge>
        <h1 className="font-heading text-xl font-semibold tracking-tight">任务记录</h1>
        <p className="mt-1 text-xs text-muted-foreground">查看所有查询任务及其最终状态。</p>
      </div>
      {tasks.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">全部任务</CardTitle>
            <CardDescription className="text-[10px]">共 {tasks.length} 个任务</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {tasks.map((task) => (
              <div key={task.id} className="flex min-h-16 items-center gap-3 border-t px-4 py-3">
                <StatusIcon status={task.status} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <strong className="truncate text-xs font-medium">{task.name}</strong>
                  <span className="text-[10px] text-muted-foreground">
                    {task.done} / {task.total} 个单号 · {task.updated}
                  </span>
                </div>
                <Badge variant={statusVariant[task.status]}>{statusText[task.status]}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <Empty className="min-h-64 rounded-xl border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ListTodo />
            </EmptyMedia>
            <EmptyTitle>暂无任务记录</EmptyTitle>
            <EmptyDescription>创建物流查询任务后会显示在这里。</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  );
}
