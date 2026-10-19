import { useEffect, useRef, useState } from "react";
import { ArrowRight, Pause, Play, Upload, X } from "lucide-react";
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
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { CreateTaskInput, TaskDetail } from "../electron/task-types";
import { parseNumbers, readExcel } from "./input-parser";

interface Props {
  task: TaskDetail | null;
  runningTaskId?: number;
  pending: boolean;
  onCreate: (input: CreateTaskInput) => Promise<void>;
  onPause: (id: number) => Promise<void>;
  onResume: (id: number) => Promise<void>;
  onError: (message: string) => void;
}

export function QueryForm({
  task,
  runningTaskId,
  pending,
  onCreate,
  onPause,
  onResume,
  onError,
}: Props) {
  const [input, setInput] = useState("");
  const [sourceFileName, setSourceFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const busy = runningTaskId !== undefined || pending || importing;
  const numbers = parseNumbers(input);

  useEffect(() => {
    if (task) {
      setInput(task.items.map((item) => item.trackingNumber).join("\n"));
      setSourceFileName(task.sourceFileName ?? "");
    }
  }, [task?.id]);

  async function importFile(file?: File) {
    if (!file || busy) return;
    setImporting(true);
    onError("");
    try {
      setInput((await readExcel(file)).join("\n"));
      setSourceFileName(file.name);
    } catch (error) {
      onError(error instanceof Error ? error.message : "读取 Excel 失败");
    } finally {
      setImporting(false);
    }
  }

  return (
    <form
      className="h-full min-h-0"
      onSubmit={(event) => {
        event.preventDefault();
        if (numbers.length && !busy)
          void onCreate({ numbers, sourceFileName: sourceFileName || undefined });
      }}
    >
      <Card className="h-full min-h-0">
        <CardHeader className="shrink-0">
          <CardTitle>
            <h1>物流查询</h1>
          </CardTitle>
          <CardDescription>导入 Excel 或粘贴单号，开始批量查询。</CardDescription>
          <CardAction>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => fileInput.current?.click()}
            >
              <Upload data-icon="inline-start" />
              {importing ? "读取中…" : "导入 Excel"}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1">
          <FieldGroup className="min-h-0">
            <Field data-disabled={busy} className="min-h-0 flex-1">
              <div className="flex shrink-0 items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <FieldLabel htmlFor="numbers">物流单号</FieldLabel>
                  <Badge variant="secondary">{numbers.length} 个</Badge>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={busy || !input}
                  onClick={() => {
                    setInput("");
                    setSourceFileName("");
                    onError("");
                  }}
                >
                  <X data-icon="inline-start" />
                  清空
                </Button>
              </div>
              <input
                ref={fileInput}
                type="file"
                accept=".xlsx,.xls"
                hidden
                onChange={(event) => {
                  void importFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
              <Textarea
                id="numbers"
                className="min-h-28 flex-1 resize-none field-sizing-fixed"
                placeholder="每行输入一个物流单号，也可以将 Excel 文件拖到这里"
                value={input}
                disabled={busy}
                onChange={(event) => {
                  setInput(event.target.value);
                  onError("");
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  if (event.dataTransfer.files.length) {
                    event.preventDefault();
                    void importFile(event.dataTransfer.files[0]);
                  }
                }}
              />
              <FieldDescription className="flex shrink-0 justify-between gap-3">
                <span className="truncate" title={sourceFileName || undefined}>
                  {sourceFileName || "每行一个单号，自动去重"}
                </span>
                <span className="shrink-0">每批最多 40 个</span>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="shrink-0 justify-between gap-4">
          <p className="min-w-0 truncate text-xs text-muted-foreground" role="status">
            {task
              ? `任务 #${task.id} · 已完成 ${task.completed} / ${task.total}`
              : "出现人机验证时，在查询窗口中完成验证。"}
          </p>
          <div className="flex shrink-0 gap-2">
            {runningTaskId !== undefined ? (
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  void onPause(runningTaskId);
                }}
              >
                <Pause data-icon="inline-start" />
                暂停任务
              </Button>
            ) : (
              <>
                {task?.status === "paused" && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      void onResume(task.id);
                    }}
                  >
                    <Play data-icon="inline-start" />
                    继续任务
                  </Button>
                )}
                <Button type="submit" disabled={!numbers.length || busy}>
                  {task ? "新建查询" : "开始查询"}
                  <ArrowRight data-icon="inline-end" />
                </Button>
              </>
            )}
          </div>
        </CardFooter>
      </Card>
    </form>
  );
}
