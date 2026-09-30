import { Activity, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/shared/task";

export function StatusIcon({ status }: { status: TaskStatus }) {
  return (
    <span
      className={cn(
        "grid size-6 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground",
        status === "running" && "bg-primary/10 text-primary",
        status === "waiting" && "bg-accent text-accent-foreground",
      )}
    >
      {status === "waiting" ? <AlertCircle /> : <Activity />}
    </span>
  );
}
