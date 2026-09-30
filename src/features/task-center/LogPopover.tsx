import { ChevronDown, Logs, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PopoverContent } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

export function LogPopover({ logs, onClear }: { logs: string[]; onClear: () => void }) {
  return (
    <PopoverContent align="end" className="w-92.5 p-0">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <strong className="text-sm">运行日志</strong>
          <span className="text-[10px] text-muted-foreground">实时事件</span>
        </div>
        <Logs className="text-muted-foreground" />
      </div>
      <div className="m-3 flex h-8 items-center gap-2 rounded-md border px-2 text-muted-foreground">
        <Search />
        <input
          className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          placeholder="搜索日志"
        />
        <span className="text-[10px]">全部级别</span>
        <ChevronDown />
      </div>
      <ScrollArea className="max-h-72 px-4">
        <div className="flex flex-col">
          {logs.map((line, index) => (
            <div
              className="flex gap-2 border-b py-2 text-[10px] text-muted-foreground last:border-0"
              key={`${line}-${index}`}
            >
              <Badge variant="secondary" className="h-4 rounded-sm px-1 text-[8px]">
                INFO
              </Badge>
              <span>{line}</span>
            </div>
          ))}
        </div>
      </ScrollArea>
      <Button
        variant="ghost"
        className="h-9 w-full rounded-none border-t text-xs text-muted-foreground"
        onClick={onClear}
      >
        清空当前日志
      </Button>
    </PopoverContent>
  );
}
