import { useEffect, useState } from "react";
import { ArrowLeft, ChevronRight, FileText, LoaderCircle, Search } from "lucide-react";
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TaskBatch, TaskBatchSummary, TaskSummary } from "../electron/task-types";
import { RawCopyContent } from "./RawCopyContent";

interface Props {
  batchesChanged: TaskSummary[];
  selectedId?: number;
  onSelect: (id: number | undefined) => void;
  onOpenTask: (id: number) => void;
}

export function RawCopies({ batchesChanged, selectedId, onSelect, onOpenTask }: Props) {
  const [batches, setBatches] = useState<TaskBatchSummary[]>([]);
  const [batch, setBatch] = useState<TaskBatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const api = window.desktop?.tasks;
    if (!api) {
      setLoading(false);
      setError("请通过 Electron 打开应用");
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    setBatch((previous) => (previous?.id === selectedId ? previous : null));
    setBatches([]);
    void (selectedId === undefined ? api.batches(search) : api.batch(selectedId))
      .then((value) => {
        if (!active) return;
        if (Array.isArray(value)) setBatches(value);
        else setBatch(value);
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
  }, [selectedId, batchesChanged, search]);

  const detail = batch?.id === selectedId ? batch : null;
  if (detail)
    return (
      <RawCopyContent
        key={detail.id}
        batch={detail}
        onBack={() => onSelect(undefined)}
        onOpenTask={onOpenTask}
      />
    );

  return (
    <Card className="h-full min-h-0">
      <CardHeader className="shrink-0 gap-x-4">
        <CardTitle className="flex min-w-0 items-center gap-2">
          {selectedId !== undefined && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="返回原始内容列表"
              onClick={() => onSelect(undefined)}
            >
              <ArrowLeft />
            </Button>
          )}
          <h1 className="min-w-0 truncate">{selectedId === undefined ? "原始内容" : "批次原文"}</h1>
        </CardTitle>
        <CardDescription className={selectedId === undefined ? undefined : "ml-9"}>
          {selectedId === undefined
            ? search
              ? loading
                ? "搜索中…"
                : `找到 ${batches.length} 个相关批次`
              : "按单号查找每批查询的原始复制内容。"
            : "正在读取批次…"}
        </CardDescription>
        {selectedId === undefined && (
          <CardAction className="w-80 lg:w-96">
            <form
              className="shrink-0"
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                setSearch(searchInput.trim());
              }}
              onReset={(event) => {
                event.preventDefault();
                setSearchInput("");
                setSearch("");
              }}
            >
              <FieldGroup>
                <Field orientation="horizontal">
                  <FieldLabel htmlFor="raw-search" className="sr-only">
                    搜索单号
                  </FieldLabel>
                  <Input
                    id="raw-search"
                    type="search"
                    placeholder="输入完整单号查找批次"
                    value={searchInput}
                    onChange={(event) => {
                      setSearchInput(event.target.value);
                      if (!event.target.value.trim()) setSearch("");
                    }}
                  />
                  <Button type="submit" variant="outline">
                    <Search data-icon="inline-start" />
                    搜索
                  </Button>
                  {(searchInput || search) && (
                    <Button type="reset" variant="ghost">
                      重置
                    </Button>
                  )}
                </Field>
              </FieldGroup>
            </form>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
        {error && (
          <Alert variant="destructive" className="shrink-0">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {selectedId !== undefined ? (
          loading && (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <LoaderCircle className="animate-spin" />
                </EmptyMedia>
                <EmptyTitle>读取中…</EmptyTitle>
              </EmptyHeader>
            </Empty>
          )
        ) : (
          <>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border [&>[data-slot=table-container]]:h-full [&>[data-slot=table-container]]:overflow-auto">
              {batches.length ? (
                <Table className="table-fixed">
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow>
                      <TableHead>所属任务</TableHead>
                      <TableHead className="w-24">批次</TableHead>
                      <TableHead className="w-20 text-right">单号数</TableHead>
                      <TableHead className="w-36">保存时间</TableHead>
                      <TableHead className="w-10">
                        <span className="sr-only">查看</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batches.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Button
                            variant="link"
                            size="sm"
                            className="block h-auto max-w-full truncate p-0 text-left"
                            title={item.taskName}
                            onClick={() => onSelect(item.id)}
                          >
                            {item.taskName}
                          </Button>
                          <p className="mt-1 text-xs text-muted-foreground">任务 #{item.taskId}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">第 {item.batchNo} 批</Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {item.numberCount}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatTime(item.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label={`查看任务 #${item.taskId} 第 ${item.batchNo} 批原文`}
                            title="查看原文"
                            onClick={() => onSelect(item.id)}
                          >
                            <ChevronRight />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Empty className="h-full">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      {loading ? <LoaderCircle className="animate-spin" /> : <FileText />}
                    </EmptyMedia>
                    <EmptyTitle>
                      {loading ? "读取中…" : search ? "未找到相关批次" : "暂无原始内容"}
                    </EmptyTitle>
                    {!loading && (
                      <EmptyDescription>
                        {search
                          ? "检查单号是否完整，或重置搜索查看全部批次。"
                          : "完成查询后，每批复制的原文会保存在这里。"}
                      </EmptyDescription>
                    )}
                  </EmptyHeader>
                </Empty>
              )}
            </div>
          </>
        )}
      </CardContent>
      <CardFooter className="shrink-0 justify-between gap-4 text-xs text-muted-foreground">
        {selectedId === undefined ? (
          <>
            <span>共 {batches.length} 个批次</span>
            <span>按保存时间倒序</span>
          </>
        ) : (
          <>
            <span>{window.desktop?.platform === "darwin" ? "⌘ F" : "Ctrl+F"} 查找</span>
            <span>Enter 下一处 · Shift+Enter 上一处</span>
          </>
        )}
      </CardFooter>
    </Card>
  );
}

function formatTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
