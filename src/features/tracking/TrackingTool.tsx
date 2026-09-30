import type { RefObject } from "react";
import { Check, Clock3, FileSpreadsheet, ShieldCheck, Truck, Upload, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

interface TrackingToolProps {
  fileRef: RefObject<HTMLInputElement | null>;
  fileName: string;
  manualNumbers: string;
  numberCount: number;
  queryStarted: boolean;
  inputError: string | null;
  onPickFile: (file?: File) => void;
  onManualNumbers: (value: string) => void;
  onClearFile: () => void;
  onClearManual: () => void;
  onOpenTasks: () => void;
  onStart: () => void;
}

export function TrackingTool({
  fileRef,
  fileName,
  manualNumbers,
  numberCount,
  queryStarted,
  inputError,
  onPickFile,
  onManualNumbers,
  onClearFile,
  onClearManual,
  onOpenTasks,
  onStart,
}: TrackingToolProps) {
  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold text-muted-foreground">
            <Truck className="text-primary" />
            工具
          </div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">物流查询</h1>
          <p className="mt-1.5 text-xs text-muted-foreground">
            批量查询并整理物流状态，支持人工处理验证。
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onOpenTasks}>
          <Clock3 data-icon="inline-start" />
          查看任务记录
        </Button>
      </div>
      <div className="mx-auto w-full max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">添加物流单号</CardTitle>
            <CardDescription>导入 Excel 文件，或直接粘贴单号。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              hidden
              onChange={(event) => onPickFile(event.target.files?.[0])}
            />
            {fileName ? (
              <div className="flex min-h-16 items-center gap-3 rounded-lg border bg-muted/20 px-3">
                <span className="grid size-9 place-items-center rounded-md bg-primary/10 text-primary">
                  <FileSpreadsheet />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <strong className="truncate text-xs font-medium">{fileName}</strong>
                  <span className="text-[10px] text-muted-foreground">
                    {numberCount} 个物流单号已识别
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="移除文件"
                  onClick={onClearFile}
                >
                  <X />
                </Button>
              </div>
            ) : (
              <>
                {!manualNumbers && (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-36 flex-col gap-2 border-dashed bg-muted/20"
                    onClick={() => fileRef.current?.click()}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      onPickFile(event.dataTransfer.files?.[0]);
                    }}
                  >
                    <span className="grid size-9 place-items-center rounded-md bg-primary/10 text-primary">
                      <Upload />
                    </span>
                    <span className="text-xs font-medium">导入 Excel 订单</span>
                    <span className="text-[10px] text-muted-foreground">
                      拖放文件到这里，或 <span className="text-primary">浏览文件</span>
                    </span>
                  </Button>
                )}
                {!manualNumbers && (
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <Separator className="flex-1" />
                    <span>或者粘贴物流单号</span>
                    <Separator className="flex-1" />
                  </div>
                )}
                <Textarea
                  placeholder="每行输入一个物流单号"
                  value={manualNumbers}
                  onChange={(event) => onManualNumbers(event.target.value)}
                />
                {manualNumbers && (
                  <div className="flex min-h-12 items-center justify-between rounded-lg border bg-muted/20 px-3">
                    <div className="flex flex-col gap-1">
                      <strong className="text-xs font-medium">{numberCount} 个物流单号</strong>
                      <span className="text-[10px] text-muted-foreground">已识别并自动去重</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="清除单号"
                      onClick={onClearManual}
                    >
                      <X />
                    </Button>
                  </div>
                )}
              </>
            )}
            {(fileName || manualNumbers) && (
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1.5 text-primary">
                  <Check />
                  内容已就绪
                </span>
                <span>
                  共 <strong>{numberCount}</strong> 个单号 · 自动分批查询
                </span>
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-between gap-4">
            <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <ShieldCheck />
              订单数据仅保存在本地设备
            </span>
            <Button type="button" disabled={!numberCount || queryStarted} onClick={onStart}>
              开始查询
            </Button>
          </CardFooter>
        </Card>
        {inputError && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription className="text-xs">{inputError}</AlertDescription>
          </Alert>
        )}
        <Alert className="mt-4">
          <ShieldCheck />
          <AlertDescription className="text-xs">
            如果出现人机验证，任务会自动暂停。完成验证后即可继续。
          </AlertDescription>
        </Alert>
      </div>
    </>
  );
}
