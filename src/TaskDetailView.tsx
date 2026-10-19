import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSearch,
  LoaderCircle,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ItemPage, ItemStatus, TaskDetail } from "../electron/task-types";
import { taskStatusText } from "./TaskHistory";

const itemStatusText: Record<ItemStatus, string> = {
  pending: "等待中",
  processing: "处理中",
  completed: "已完成",
  failed: "失败",
};
type Filter = ItemStatus | "all";

interface Props {
  taskId: number;
  task: TaskDetail | null;
  runningTaskId?: number;
  pending: boolean;
  onBack: () => void;
  onOpenBatch: (id: number) => void;
  onPause: (id: number) => Promise<void>;
  onResume: (id: number) => Promise<void>;
  onRetryFailed: (id: number) => Promise<void>;
}

export function TaskDetailView({
  taskId,
  task,
  runningTaskId,
  pending,
  onBack,
  onOpenBatch,
  onPause,
  onResume,
  onRetryFailed,
}: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ItemPage | null>(null);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const api = window.desktop?.tasks;
    if (!api) {
      setLoading(false);
      setError("请通过 Electron 打开应用");
      return;
    }
    let active = true;
    setLoading(true);
    void api
      .itemsPage({ taskId, status: filter, page, pageSize: 10 })
      .then((value) => {
        if (active) {
          setData(value);
          if (value.page !== page) setPage(value.page);
        }
      })
      .catch((error) => {
        if (active) setError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [taskId, filter, page, task?.updatedAt]);

  async function exportTask() {
    if (!window.desktop || exporting) return;
    setExporting(true);
    setError("");
    setExported(false);
    try {
      const path = await window.desktop.tasks.export(taskId);
      setExported(Boolean(path));
    } catch (error) {
      setError(error instanceof Error ? error.message : "导出失败");
    } finally {
      setExporting(false);
    }
  }

  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / 10));
  return (
    <TooltipProvider delay={150}>
      <Card className="h-full min-h-0">
        <CardHeader className="shrink-0">
          <CardTitle className="flex min-w-0 items-center gap-2">
            <Button variant="ghost" size="icon-sm" aria-label="返回任务记录" onClick={onBack}>
              <ArrowLeft />
            </Button>
            <h1 className="min-w-0 truncate" title={task?.name}>
              {task?.name || "任务详情"}
            </h1>
          </CardTitle>
          <CardDescription className="ml-9 flex flex-wrap items-center gap-x-3 gap-y-1">
            {task ? (
              <>
                <span>任务 #{taskId}</span>
                <Badge variant={task.status === "running" ? "secondary" : "outline"}>
                  {taskStatusText[task.status]}
                </Badge>
                <span>{task.total} 个单号</span>
              </>
            ) : (
              "正在读取任务…"
            )}
          </CardDescription>
          <CardAction className="flex gap-2">
            {task?.status === "running" && (
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => {
                  void onPause(taskId);
                }}
              >
                <Pause data-icon="inline-start" />
                暂停
              </Button>
            )}
            {task?.status === "paused" && (
              <Button
                variant="outline"
                size="sm"
                disabled={pending || runningTaskId !== undefined}
                onClick={() => {
                  void onResume(taskId);
                }}
              >
                <Play data-icon="inline-start" />
                继续
              </Button>
            )}
            {task?.status === "ended" && task.failed > 0 && (
              <Button
                variant="outline"
                size="sm"
                disabled={pending || runningTaskId !== undefined}
                onClick={() => {
                  setFilter("all");
                  setPage(1);
                  void onRetryFailed(taskId);
                }}
              >
                <RotateCcw data-icon="inline-start" />
                重试失败项
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={exporting || !task}
              onClick={() => {
                void exportTask();
              }}
            >
              <Download data-icon="inline-start" />
              {exporting ? "导出中…" : "导出 Excel"}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="flex shrink-0 items-center justify-between gap-3">
            <ToggleGroup
              value={[filter]}
              multiple={false}
              variant="outline"
              size="sm"
              spacing={0}
              aria-label="处理状态筛选"
              onValueChange={(values) => {
                if (values[0]) {
                  setFilter(values[0] as Filter);
                  setPage(1);
                  setData(null);
                }
              }}
            >
              <ToggleGroupItem value="all">全部 {task?.total ?? 0}</ToggleGroupItem>
              {Object.entries(itemStatusText).map(([value, label]) => (
                <ToggleGroupItem key={value} value={value}>
                  {label} {data?.counts[value as ItemStatus] ?? 0}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <span className="shrink-0 text-xs text-muted-foreground">点击物流信息查看原文</span>
          </div>
          {error && (
            <Alert variant="destructive" className="shrink-0">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="min-h-0 flex-1 overflow-hidden rounded-lg border [&>[data-slot=table-container]]:h-full [&>[data-slot=table-container]]:overflow-auto">
            <Table className="table-fixed">
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead className="w-44">单号</TableHead>
                  <TableHead>物流信息</TableHead>
                  <TableHead className="w-20">状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <ResultText value={item.trackingNumber} />
                    </TableCell>
                    <TableCell>
                      <ResultText
                        value={item.latestEvent || item.error || "—"}
                        onClick={
                          item.batchId !== null ? () => onOpenBatch(item.batchId!) : undefined
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          item.status === "failed"
                            ? "destructive"
                            : item.status === "completed"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {itemStatusText[item.status]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {!data?.items.length && (
                  <TableRow>
                    <TableCell colSpan={3}>
                      <Empty className="py-8">
                        <EmptyHeader>
                          <EmptyMedia variant="icon">
                            {loading ? <LoaderCircle className="animate-spin" /> : <FileSearch />}
                          </EmptyMedia>
                          <EmptyTitle>{loading ? "读取中…" : "此状态暂无记录"}</EmptyTitle>
                          {!loading && (
                            <EmptyDescription>选择其他状态查看单号明细。</EmptyDescription>
                          )}
                        </EmptyHeader>
                      </Empty>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <CardFooter className="shrink-0 justify-between gap-4">
          <span className="text-xs text-muted-foreground" aria-live="polite">
            {exported ? "已导出全部明细" : `共 ${data?.total ?? 0} 条记录`}
          </span>
          <div className="flex items-center gap-3">
            <span className="text-xs tabular-nums text-muted-foreground">
              第 {data?.page ?? page} / {pages} 页
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="上一页"
                title="上一页"
                disabled={loading || page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="下一页"
                title="下一页"
                disabled={loading || page >= pages}
                onClick={() => setPage((value) => value + 1)}
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        </CardFooter>
      </Card>
    </TooltipProvider>
  );
}

function ResultText({ value, onClick }: { value: string; onClick?: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          onClick ? (
            <Button
              variant="link"
              size="sm"
              className="block h-auto w-full truncate p-0 text-left"
              onClick={onClick}
            />
          ) : (
            <span tabIndex={0} className="block min-w-0 cursor-default truncate outline-none" />
          )
        }
      >
        {value}
      </TooltipTrigger>
      <TooltipContent className="max-w-sm whitespace-pre-wrap break-words">{value}</TooltipContent>
    </Tooltip>
  );
}
