import React, { useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertCircle,
  ArrowDownToLine,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  FileSpreadsheet,
  ListTodo,
  Logs,
  MoreHorizontal,
  Pause,
  Play,
  Search,
  Settings2,
  ShieldCheck,
  Truck,
  Upload,
  X,
} from "lucide-react";
import "./style.css";

type TaskStatus = "queued" | "running" | "waiting" | "paused" | "complete";
type Task = {
  id: number;
  name: string;
  total: number;
  done: number;
  batch: number;
  batches: number;
  status: TaskStatus;
  updated: string;
};

const initialTasks: Task[] = [
  {
    id: 1,
    name: "September-orders.xlsx",
    total: 128,
    done: 80,
    batch: 3,
    batches: 4,
    status: "running",
    updated: "刚刚更新",
  },
  {
    id: 2,
    name: "August-orders.xlsx",
    total: 64,
    done: 64,
    batch: 2,
    batches: 2,
    status: "complete",
    updated: "今天 09:42",
  },
];

const statusText: Record<TaskStatus, string> = {
  queued: "排队中",
  running: "正在查询",
  waiting: "等待验证",
  paused: "已暂停",
  complete: "已完成",
};

function App() {
  const [tasks, setTasks] = useState(initialTasks);
  const [activeNav, setActiveNav] = useState<string | null>(null);
  const [taskOpen, setTaskOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [manualNumbers, setManualNumbers] = useState("");
  const [numberCount, setNumberCount] = useState(0);
  const [queryStarted, setQueryStarted] = useState(false);
  const [logs, setLogs] = useState([
    "11:24:08  任务正在运行 · September-orders.xlsx",
    "11:23:51  第 2 批查询完成 · 40 / 40 单号",
    "11:22:16  开始查询第 2 批",
  ]);
  const fileRef = useRef<HTMLInputElement>(null);
  const activeTask = tasks.find((t) => t.status === "running" || t.status === "waiting");
  const activePercent = activeTask ? Math.round((activeTask.done / activeTask.total) * 100) : 0;
  const activeCount = tasks.filter((t) => t.status !== "complete").length;
  const completedCount = useMemo(() => tasks.reduce((n, t) => n + t.done, 0), [tasks]);

  const pickFile = (file?: File) => {
    if (!file) return;
    setFileName(file.name);
    setNumberCount(128);
    setManualNumbers("");
    setQueryStarted(false);
    setLogs((prev) => [`11:25:02  已导入 ${file.name}`, ...prev]);
  };

  const startQuery = () => {
    if (!numberCount) return;
    setQueryStarted(true);
    const task: Task = {
      id: Date.now(),
      name: fileName || "物流单号导入.xlsx",
      total: numberCount,
      done: 0,
      batch: 1,
      batches: Math.ceil(numberCount / 40),
      status: "running",
      updated: "刚刚更新",
    };
    setTasks((prev) => [task, ...prev]);
    setLogs((prev) => [`11:25:10  已创建物流查询任务 · ${numberCount} 个单号`, ...prev]);
    setTaskOpen(true);
  };

  const updateTask = (id: number, status: TaskStatus) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    setLogs((prev) => [`11:25:14  任务状态已更新 · ${statusText[status]}`, ...prev]);
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <span>Trackbox</span>
        </div>
        <div className="nav-section-label">工具</div>
        <button
          className={`nav-item ${activeNav === "物流查询" ? "selected" : ""}`}
          onClick={() => setActiveNav("物流查询")}
        >
          <Truck size={17} />
          <span>物流查询</span>
          <span className="nav-new">NEW</span>
        </button>
        <div className="sidebar-bottom">
          <div className="storage">
            <div className="storage-head">
              <span>本地存储</span>
              <span>12.8 MB</span>
            </div>
            <div className="storage-track">
              <i />
            </div>
          </div>
          <button className="nav-item">
            <Settings2 size={17} />
            <span>设置</span>
          </button>
          <div className="user-profile">
            <div className="avatar">T</div>
            <div className="user-meta">
              <strong>本地工作区</strong>
              <span>个人版</span>
            </div>
            <MoreHorizontal size={18} />
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Trackbox</span>
            {activeNav && (
              <>
                <span className="crumb-sep">/</span>
                <strong>{activeNav}</strong>
              </>
            )}
          </div>
          <div className="top-actions">
            <button
              className={`task-trigger ${taskOpen ? "trigger-active" : ""}`}
              onClick={() => {
                setTaskOpen(!taskOpen);
                setLogOpen(false);
              }}
            >
              <span className="task-trigger-icon">
                <ListTodo size={17} />
                {activeCount > 0 && <i />}
              </span>
              <span>任务</span>
              {activeTask && <span className="mini-progress">{activePercent}%</span>}
              <ChevronDown size={14} />
            </button>
            <button
              className={`icon-action ${logOpen ? "trigger-active" : ""}`}
              title="运行日志"
              onClick={() => {
                setLogOpen(!logOpen);
                setTaskOpen(false);
              }}
            >
              <Logs size={17} />
            </button>
            <button className="icon-action" title="帮助">
              <CircleHelp size={17} />
            </button>
          </div>
        </header>

        <section className="content-area">
          {!activeNav ? (
            <TaskHome
              tasks={tasks}
              onOpenTask={() => setTaskOpen(true)}
              onChooseTool={() => setActiveNav("物流查询")}
            />
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    <span className="eyebrow-icon">
                      <Truck size={15} />
                    </span>
                    工具
                  </div>
                  <h1>物流查询</h1>
                  <p>批量查询并整理物流状态，支持人工处理验证。</p>
                </div>
                <button className="secondary-button" onClick={() => setTaskOpen(true)}>
                  <Clock3 size={15} />
                  查看任务记录
                </button>
              </div>

              <div className="work-layout simplified-layout">
                <div className="primary-column">
                  <section className="section-block import-section">
                    <div className="section-title">
                      <div>
                        <h2>添加物流单号</h2>
                        <p>导入 Excel 文件，或直接粘贴单号。</p>
                      </div>
                      <button className="text-button">
                        <CircleHelp size={14} />
                        Excel 格式
                      </button>
                    </div>
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".xlsx,.xls"
                      hidden
                      onChange={(e) => pickFile(e.target.files?.[0])}
                    />
                    {!fileName && !manualNumbers ? (
                      <>
                        <button
                          className="upload-zone"
                          onClick={() => fileRef.current?.click()}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            pickFile(e.dataTransfer.files?.[0]);
                          }}
                        >
                          <span className="upload-icon">
                            <Upload size={19} />
                          </span>
                          <strong>导入 Excel 订单</strong>
                          <span className="upload-sub">
                            拖放文件到这里，或 <em>浏览文件</em>
                          </span>
                        </button>
                        <div className="input-divider">
                          <span>或者粘贴物流单号</span>
                        </div>
                        <textarea
                          className="tracking-input"
                          placeholder="每行输入一个物流单号"
                          value={manualNumbers}
                          onChange={(e) => {
                            const value = e.target.value;
                            setManualNumbers(value);
                            setNumberCount(
                              [
                                ...new Set(
                                  value
                                    .split(/[\s,，;；]+/)
                                    .map((s) => s.trim())
                                    .filter(Boolean),
                                ),
                              ].length,
                            );
                            setFileName("");
                            setQueryStarted(false);
                          }}
                        />
                      </>
                    ) : fileName ? (
                      <div className="file-row">
                        <span className="file-icon">
                          <FileSpreadsheet size={19} />
                        </span>
                        <div className="file-details">
                          <strong>{fileName}</strong>
                          <span>{numberCount} 个物流单号已识别</span>
                        </div>
                        <button
                          className="remove-file"
                          onClick={() => {
                            setFileName("");
                            setNumberCount(0);
                          }}
                          title="移除文件"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="manual-preview">
                        <div>
                          <strong>{numberCount} 个物流单号</strong>
                          <span>已识别并自动去重</span>
                        </div>
                        <button
                          className="remove-file"
                          onClick={() => {
                            setManualNumbers("");
                            setNumberCount(0);
                          }}
                          title="清除单号"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                    {(fileName || manualNumbers) && (
                      <div className="import-summary">
                        <span>
                          <Check size={14} />
                          内容已就绪
                        </span>
                        <span>
                          共 <strong>{numberCount}</strong> 个单号 · 自动分批查询
                        </span>
                      </div>
                    )}
                  </section>

                  <div className="action-row">
                    <span className="privacy-note">
                      <ShieldCheck size={14} />
                      订单数据仅保存在本地设备
                    </span>
                    <button
                      className="primary-button"
                      disabled={!numberCount || queryStarted}
                      onClick={startQuery}
                    >
                      <Play size={15} fill="currentColor" />
                      {queryStarted ? "任务已创建" : "开始查询"}
                      <span className="button-shortcut">↵</span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
          <footer className="page-footer">
            <span>
              TRACKBOX <i>·</i> 本地自动化工具箱
            </span>
            <span>v0.1.0</span>
          </footer>
        </section>
      </main>

      {taskOpen && (
        <>
          <button
            className="popover-dismiss"
            onClick={() => setTaskOpen(false)}
            aria-label="关闭任务中心"
          />
          <section className="task-popover">
            <div className="popover-header">
              <div>
                <strong>任务中心</strong>
                <span>{tasks.length} 个任务</span>
              </div>
              <button onClick={() => setTaskOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="task-list">
              {tasks.map((task) => (
                <article className="task-card" key={task.id}>
                  <div className="task-card-top">
                    <span className={`task-status-icon ${task.status}`}>
                      {task.status === "complete" ? (
                        <Check size={13} />
                      ) : task.status === "running" ? (
                        <Activity size={13} />
                      ) : task.status === "waiting" ? (
                        <AlertCircle size={13} />
                      ) : (
                        <Clock3 size={13} />
                      )}
                    </span>
                    <div className="task-title">
                      <strong>{task.name}</strong>
                      <span>{statusText[task.status]}</span>
                    </div>
                    <button className="task-menu">
                      <MoreHorizontal size={16} />
                    </button>
                  </div>
                  <div className="progress-track">
                    <i
                      style={{ width: `${Math.round((task.done / task.total) * 100)}%` }}
                      className={task.status === "complete" ? "done" : ""}
                    />
                  </div>
                  <div className="task-card-meta">
                    <span>
                      {task.done} / {task.total} 个单号
                    </span>
                    <span>{Math.round((task.done / task.total) * 100)}%</span>
                  </div>
                  <div className="task-card-bottom">
                    <span>
                      {task.status === "complete"
                        ? "已完成"
                        : `批次 ${Math.max(task.batch, 1)} / ${task.batches}`}{" "}
                      <i>·</i> {task.updated}
                    </span>
                    {task.status === "running" ? (
                      <button
                        className="small-control"
                        onClick={() => updateTask(task.id, "paused")}
                      >
                        <Pause size={12} />
                        暂停
                      </button>
                    ) : task.status === "paused" ? (
                      <button
                        className="small-control continue"
                        onClick={() => updateTask(task.id, "running")}
                      >
                        <Play size={12} />
                        继续
                      </button>
                    ) : task.status === "waiting" ? (
                      <button
                        className="small-control continue"
                        onClick={() => updateTask(task.id, "running")}
                      >
                        <Check size={12} />
                        验证完成
                      </button>
                    ) : task.status === "complete" ? (
                      <button className="small-control">查看</button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
            <button className="popover-footer" onClick={() => setTaskOpen(false)}>
              打开任务记录 <ArrowDownToLine size={14} />
            </button>
          </section>
        </>
      )}

      {logOpen && (
        <>
          <button
            className="popover-dismiss"
            onClick={() => setLogOpen(false)}
            aria-label="关闭运行日志"
          />
          <section className="log-popover">
            <div className="popover-header">
              <div>
                <strong>运行日志</strong>
                <span>实时事件</span>
              </div>
              <button onClick={() => setLogOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="log-filter">
              <Search size={14} />
              <input placeholder="搜索日志" />
              <button>
                全部级别 <ChevronDown size={13} />
              </button>
            </div>
            <div className="log-entries">
              {logs.map((line, i) => (
                <div className="log-entry" key={i}>
                  <span className="log-level">INFO</span>
                  <span>{line}</span>
                </div>
              ))}
            </div>
            <button className="clear-logs" onClick={() => setLogs([])}>
              清空当前日志
            </button>
          </section>
        </>
      )}
    </div>
  );
}

function TaskHome({
  tasks,
  onOpenTask,
  onChooseTool,
}: {
  tasks: Task[];
  onOpenTask: () => void;
  onChooseTool: () => void;
}) {
  const active = tasks.filter((t) => t.status !== "complete");
  return (
    <div className="task-home">
      <div className="home-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-icon">
              <ListTodo size={15} />
            </span>
            任务中心
          </div>
          <h1>当前任务</h1>
          <p>查看正在运行和最近完成的任务。</p>
        </div>
        <button className="secondary-button" onClick={onOpenTask}>
          <ListTodo size={15} />
          打开任务中心
        </button>
      </div>
      <div className="home-summary">
        <div>
          <span>进行中的任务</span>
          <strong>{active.length}</strong>
        </div>
        <div>
          <span>已完成单号</span>
          <strong>{tasks.reduce((n, t) => n + t.done, 0).toLocaleString()}</strong>
        </div>
        <div>
          <span>工具</span>
          <strong>1</strong>
        </div>
      </div>
      {active.length ? (
        <div className="home-task-list">
          {active.map((task) => (
            <button className="home-task" key={task.id} onClick={onOpenTask}>
              <span className={`task-status-icon ${task.status}`}>
                {task.status === "waiting" ? <AlertCircle size={13} /> : <Activity size={13} />}
              </span>
              <span className="task-title">
                <strong>{task.name}</strong>
                <span>
                  {statusText[task.status]} · {task.done} / {task.total} 个单号
                </span>
              </span>
              <span className="home-task-percent">
                {Math.round((task.done / task.total) * 100)}%
              </span>
              <ChevronDown size={15} />
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-home">
          <span className="empty-icon">
            <ListTodo size={23} />
          </span>
          <h2>还没有进行中的任务</h2>
          <p>从左侧选择一个工具，开始你的第一个任务。</p>
          <button className="primary-button" onClick={onChooseTool}>
            <Truck size={15} />
            打开物流查询
          </button>
        </div>
      )}
      <div className="home-tip">
        <ShieldCheck size={15} />
        <span>任务会自动保存，重新打开应用后可以继续。</span>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
