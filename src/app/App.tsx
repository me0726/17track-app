import { useState } from "react";
import { TaskHome } from "@/features/task-center/TaskHome";
import { TaskHistory } from "@/features/task-center/TaskHistory";
import { TrackingTool } from "@/features/tracking/TrackingTool";
import { useTrackingInput } from "@/features/tracking/useTrackingInput";
import { AppShell } from "./AppShell";
import { useTaskCenter } from "./useTaskCenter";

export function App() {
  const [activeNav, setActiveNav] = useState<string | null>(null);
  const taskCenter = useTaskCenter();
  const trackingInput = useTrackingInput(taskCenter.createTask);

  return (
    <AppShell
      activeNav={activeNav}
      tasks={taskCenter.tasks}
      logs={taskCenter.logs}
      taskOpen={taskCenter.taskOpen}
      logOpen={taskCenter.logOpen}
      activeTask={taskCenter.activeTask}
      activeCount={taskCenter.activeCount}
      activePercent={taskCenter.activePercent}
      onSelectTool={() => setActiveNav("物流查询")}
      onSelectHistory={() => setActiveNav("任务记录")}
      onTasksOpenChange={taskCenter.toggleTasks}
      onLogsOpenChange={taskCenter.toggleLogs}
      onUpdateTask={taskCenter.updateTask}
      onClearLogs={taskCenter.clearLogs}
    >
      {!activeNav ? (
        <TaskHome
          tasks={taskCenter.tasks}
          completedCount={taskCenter.completedCount}
          onOpenTask={() => taskCenter.toggleTasks(true)}
          onChooseTool={() => setActiveNav("物流查询")}
        />
      ) : activeNav === "任务记录" ? (
        <TaskHistory tasks={taskCenter.tasks} />
      ) : (
        <TrackingTool
          fileRef={trackingInput.fileRef}
          fileName={trackingInput.fileName}
          manualNumbers={trackingInput.manualNumbers}
          numberCount={trackingInput.numberCount}
          queryStarted={trackingInput.queryStarted}
          inputError={trackingInput.inputError}
          onPickFile={trackingInput.pickFile}
          onManualNumbers={trackingInput.setManualInput}
          onClearFile={trackingInput.clearFile}
          onClearManual={trackingInput.clearManual}
          onOpenTasks={() => taskCenter.toggleTasks(true)}
          onStart={trackingInput.startQuery}
        />
      )}
    </AppShell>
  );
}
