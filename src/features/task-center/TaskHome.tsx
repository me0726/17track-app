import { ChevronDown, ListTodo, ShieldCheck, Truck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { StatusIcon } from "./StatusIcon";
import { statusText, statusVariant, type TaskView } from "./types";

export function TaskHome({
  tasks,
  completedCount,
  onOpenTask,
  onChooseTool,
}: {
  tasks: TaskView[];
  completedCount: number;
  onOpenTask: () => void;
  onChooseTool: () => void;
}) {
  const active = tasks.filter((task) => task.status !== "complete");
  const current = active[0];
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Badge variant="secondary" className="mb-2 gap-1.5 text-[10px]">
            <ListTodo />
            任务中心
          </Badge>
          <h1 className="font-heading text-xl font-semibold tracking-tight">工作进度</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            任务会在后台运行，验证时会暂停等待你的处理。
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onOpenTask}>
          <ListTodo data-icon="inline-start" />
          全部任务
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="进行中" value={active.length} />
        <Stat label="已完成单号" value={completedCount.toLocaleString()} />
        <Stat label="工具" value="1" />
      </div>
      {current ? (
        <Card className="overflow-hidden border-primary/20 shadow-sm">
          <CardHeader className="gap-3 pb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <StatusIcon status={current.status} />
                <div className="flex min-w-0 flex-col gap-1">
                  <CardTitle className="truncate text-sm">{current.name}</CardTitle>
                  <CardDescription className="text-[10px]">
                    {statusText[current.status]} · 最近更新 {current.updated}
                  </CardDescription>
                </div>
              </div>
              <Badge variant={statusVariant[current.status]}>{statusText[current.status]}</Badge>
            </div>
            <Progress value={Math.round((current.done / current.total) * 100)} className="h-2" />
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-3 pt-0">
            <Metric label="已完成" value={current.done} />
            <Metric label="待处理" value={current.total - current.done} />
            <Metric label="当前批次" value={`${current.batch} / ${current.batches}`} />
          </CardContent>
          <CardFooter className="justify-between border-t bg-muted/30 py-2.5">
            <span className="text-[10px] text-muted-foreground">
              {Math.round((current.done / current.total) * 100)}% 完成
            </span>
            <Button variant="ghost" size="sm" onClick={onOpenTask}>
              查看任务 <ChevronDown data-icon="inline-end" />
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <Empty className="min-h-56 rounded-xl border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="size-11 rounded-xl text-primary">
              <ListTodo />
            </EmptyMedia>
            <EmptyTitle>还没有进行中的任务</EmptyTitle>
            <EmptyDescription>从左侧选择一个工具，开始你的第一个任务。</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={onChooseTool}>
              <Truck data-icon="inline-start" />
              打开物流查询
            </Button>
          </EmptyContent>
        </Empty>
      )}
      <Card size="sm">
        <CardHeader className="flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-sm">任务列表</CardTitle>
            <CardDescription className="text-[10px]">所有任务的当前状态</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onOpenTask}>
            查看全部
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {tasks.slice(0, 3).map((task) => (
            <button
              key={task.id}
              className="flex h-12 w-full items-center gap-3 border-t px-4 text-left hover:bg-muted/50"
              onClick={onOpenTask}
            >
              <StatusIcon status={task.status} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <strong className="truncate text-xs font-medium">{task.name}</strong>
                <span className="text-[10px] text-muted-foreground">
                  {task.done} / {task.total} 个单号
                </span>
              </span>
              <Badge variant={statusVariant[task.status]} className="text-[10px]">
                {statusText[task.status]}
              </Badge>
            </button>
          ))}
        </CardContent>
      </Card>
      <Alert className="py-2.5">
        <ShieldCheck />
        <AlertDescription className="text-[10px]">
          任务会自动保存，重新打开应用后可以继续。
        </AlertDescription>
      </Alert>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-muted/60 p-3">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <strong className="mt-1 block font-heading text-lg font-semibold">{value}</strong>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card size="sm" className={cn("shadow-none")}>
      <CardContent className="flex flex-col gap-1.5 p-3">
        <span className="text-[10px] text-muted-foreground">{label}</span>
        <strong className="font-heading text-lg font-semibold">{value}</strong>
      </CardContent>
    </Card>
  );
}
