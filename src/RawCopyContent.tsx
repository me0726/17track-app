import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowUpRight, ChevronDown, ChevronUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TaskBatch } from "../electron/task-types";

interface Props {
  batch: TaskBatch;
  onBack: () => void;
  onOpenTask: (id: number) => void;
}

export function RawCopyContent({ batch, onBack, onOpenTask }: Props) {
  const text = batch.rawText;
  const [query, setQuery] = useState("");
  const [current, setCurrent] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const content = useRef<HTMLPreElement>(null);
  const matches = useMemo(() => {
    if (!query) return [];
    const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "giu");
    return Array.from(text.matchAll(pattern));
  }, [text, query]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!input.current?.getClientRects().length) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        input.current.focus();
        input.current.select();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    content.current
      ?.querySelector('[data-current-match="true"]')
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [query, current, text]);

  function move(direction: number) {
    if (matches.length)
      setCurrent((value) => (value + direction + matches.length) % matches.length);
  }

  function clear() {
    setQuery("");
    setCurrent(0);
    input.current?.focus();
  }

  const highlighted: ReactNode[] = [];
  let offset = 0;
  matches.forEach((match, index) => {
    highlighted.push(text.slice(offset, match.index));
    highlighted.push(
      <mark
        key={match.index}
        data-current-match={index === current ? "true" : undefined}
        className={cn(
          "rounded-sm",
          index === current
            ? "bg-primary text-primary-foreground outline outline-primary/30"
            : "bg-primary/15 text-foreground",
        )}
      >
        {match[0]}
      </mark>,
    );
    offset = match.index + match[0].length;
  });
  highlighted.push(text.slice(offset));

  return (
    <Card className="h-full min-h-0">
      <CardHeader className="shrink-0 gap-x-4">
        <CardTitle className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="icon-sm" aria-label="返回原始内容列表" onClick={onBack}>
            <ArrowLeft />
          </Button>
          <h1 className="min-w-0 truncate" title={batch.taskName}>
            {batch.taskName}
          </h1>
        </CardTitle>
        <CardDescription className="ml-9 min-w-0 truncate">
          第 {batch.batchNo} 批 · {batch.numberCount} 个单号 ·{" "}
          {new Date(batch.createdAt).toLocaleString("zh-CN", {
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })}
        </CardDescription>
        <CardAction className="w-80 lg:w-96">
          <FieldGroup>
            <Field orientation="horizontal">
              <FieldLabel htmlFor="raw-find" className="sr-only">
                在原始内容中查找
              </FieldLabel>
              <Input
                ref={input}
                id="raw-find"
                type="search"
                placeholder="在原始内容中查找"
                aria-describedby="raw-find-count"
                aria-controls="raw-copy-text"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setCurrent(0);
                }}
                onKeyDown={(event) => {
                  if (event.nativeEvent.isComposing) return;
                  if (event.key === "Enter") {
                    event.preventDefault();
                    move(event.shiftKey ? -1 : 1);
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    clear();
                  }
                }}
              />
              <span
                id="raw-find-count"
                role="status"
                aria-live="polite"
                className="w-14 shrink-0 text-center text-xs tabular-nums text-muted-foreground"
                title={`共 ${matches.length} 处匹配`}
              >
                {matches.length ? current + 1 : 0} / {matches.length}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                type="button"
                aria-label="上一个匹配"
                title="上一个（Shift+Enter）"
                disabled={!matches.length}
                onClick={() => move(-1)}
              >
                <ChevronUp />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                type="button"
                aria-label="下一个匹配"
                title="下一个（Enter）"
                disabled={!matches.length}
                onClick={() => move(1)}
              >
                <ChevronDown />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                type="button"
                aria-label="清空页内搜索"
                title="清空（Esc）"
                disabled={!query}
                onClick={clear}
              >
                <X />
              </Button>
            </Field>
          </FieldGroup>
        </CardAction>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1">
        <pre
          ref={content}
          id="raw-copy-text"
          aria-label="批次原始复制内容"
          tabIndex={0}
          className="min-h-0 min-w-0 flex-1 overflow-auto rounded-lg border p-3 text-xs leading-6 whitespace-pre"
        >
          {highlighted}
        </pre>
      </CardContent>
      <CardFooter className="shrink-0 justify-between gap-4">
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0"
          onClick={() => onOpenTask(batch.taskId)}
        >
          查看任务 #{batch.taskId}
          <ArrowUpRight data-icon="inline-end" />
        </Button>
        <span className="text-xs text-muted-foreground">
          {!text
            ? "本批次复制内容为空"
            : `${window.desktop?.platform === "darwin" ? "⌘ F" : "Ctrl+F"} 查找 · Enter 下一处`}
        </span>
      </CardFooter>
    </Card>
  );
}
