# Trackbox 项目功能与架构设计

## 1. 项目定位

Trackbox 是一个基于 Electron 的本地自动化工具箱。用户从工具列表中选择功能，工具在独立的工作区内执行任务，应用顶部统一显示任务进度和运行日志。

首个工具是 17TRACK 物流查询：用户导入 Excel 订单，或直接粘贴物流单号；应用去重后按每批最多 40 个单号打开 17TRACK 查询页面。当页面出现人机验证时，任务暂停并把真实的 17TRACK 页面交给用户处理。

应用不尝试绕过、破解或自动完成验证码。验证码必须由用户在 17TRACK 页面中人工完成。

## 2. 已确认的产品规则

- 首期只支持 Excel 文件和手动粘贴单号。
- 用户只提供物流单号，物流商由 17TRACK 自动识别。
- 单号自动去重，查询批次上限为 40 个单号。
- 任务和日志保存到本地，应用重启后任务可以继续。
- 关闭 17TRACK 查询窗口会暂停当前任务。
- 人机验证出现后暂停当前任务，并显示验证窗口。
- 任务中心采用浏览器下载中心式的顶部入口，不单独占用一个复杂页面。
- 暂时不做第三方插件系统，工具通过代码内模块注册。
- 默认 Electron 主窗口固定为 800 x 600，禁止调整大小、最大化和全屏。

## 3. 技术选型

### 桌面层

- Electron：提供一致的 Chromium 页面环境、独立浏览器窗口、持久化 session 和窗口生命周期事件。
- React + TypeScript：渲染应用界面。
- Vite：前端开发和构建。

### UI 层

- Tailwind CSS v4：布局和页面 utility class。
- shadcn/ui：基础 UI 组件，当前项目使用 Base UI primitive。
- lucide-react：图标。
- shadcn 默认 neutral 主题：使用语义 token，如 `bg-background`、`text-muted-foreground`、`bg-primary`。

### 数据和输入

- `xlsx`：读取 `.xlsx` / `.xls` 文件。
- Electron 用户数据目录下的 JSON 文件：保存任务、单号和日志。当前文件名为 `trackbox-state.json`。

后续如果单号量和历史任务明显增长，可以把持久化层替换为 SQLite；任务管理器和渲染层不应直接依赖具体存储实现。

## 4. 界面架构

### 应用壳层

应用壳层由 `src/main.tsx` 负责，提供：

- 左侧工具导航，目前只有“物流查询”。
- 顶部面包屑。
- 顶部任务中心 Popover。
- 顶部运行日志 Popover。
- 当前工具工作区。
- 固定窗口内的滚动边界和页脚。

首屏没有选择工具时显示任务首页；选择“物流查询”后进入物流工具页。

### 任务首页

任务首页展示：

- 进行中任务数量。
- 已完成单号数量。
- 当前工具数量。
- 当前任务的大进度卡片。
- 所有任务的简要列表。
- 无任务时的 shadcn `Empty` 状态。

首页是任务观察入口，不负责执行查询逻辑。

### 物流查询页

物流查询页只负责输入任务：

- 拖放或选择 Excel。
- 手动粘贴单号。
- 展示去重后的单号数量。
- 显示输入错误。
- 创建查询任务。

查询设置、运行概览和最近任务不单独展示。任务状态统一由顶部任务中心维护。

### 任务中心

任务中心使用 shadcn `Popover`、`Card`、`Progress`、`Badge` 和 `ScrollArea` 组合：

- 展示所有任务的状态、数量、批次和进度。
- 运行中任务可暂停。
- 暂停任务可继续。
- 等待验证任务可在用户完成验证后继续。
- 已完成任务保留在任务列表中。

### 日志

日志使用独立 Popover 展示。日志由主进程产生，渲染进程通过 IPC 订阅实时事件。当前界面支持查看、搜索输入框和清空当前视图；日志数据仍保留在本地状态文件中。

## 5. 代码模块划分

```text
src/
├── main.tsx                         React 挂载入口
├── app/
│   ├── App.tsx                       页面组合和工具选择状态
│   ├── AppShell.tsx                  Electron 应用壳层和全局 Popover
│   └── useTaskCenter.ts              任务/日志 IPC 订阅和操作
├── shared/task.ts                   渲染进程任务契约
├── features/
│   ├── task-center/
│   │   ├── TaskHome.tsx             默认任务首页
│   │   ├── TaskPopover.tsx           顶部任务中心
│   │   ├── LogPopover.tsx            运行日志
│   │   ├── StatusIcon.tsx            任务状态图标
│   │   └── types.ts                  任务展示类型和状态文案
│   └── tracking/
│       ├── TrackingTool.tsx          物流查询输入界面
│       ├── useTrackingInput.ts       输入状态和任务创建
│       └── input-parser.ts           Excel 和手动单号解析
├── components/ui/                   shadcn 组件
└── style.css                        Tailwind/shadcn 全局主题

electron/
├── main.ts                          Electron 生命周期和窗口创建
├── preload.ts                       白名单 IPC API
├── ipc.ts                            IPC handler 注册
├── types.ts                          主进程任务契约
├── persistence/
│   └── task-store.ts                 本地任务和日志存储
├── tasks/
│   └── task-manager.ts               任务状态、批次入口和恢复逻辑
└── tracking/
    ├── tracking-window.ts            Electron 窗口生命周期和批次导航
    ├── cdp-client.ts                 Chrome DevTools Protocol 封装
    └── tracking-page-adapter.ts      17TRACK 页面操作 TODO 接口
```

## 6. 任务状态机

```text
QUEUED
  └─> RUNNING
        ├─> WAITING_HUMAN  检测到人机验证
        ├─> PAUSED         用户暂停或窗口关闭
        ├─> FAILED         查询窗口或批次失败
        └─> COMPLETE       所有批次完成

WAITING_HUMAN ──人工完成验证──> RUNNING
PAUSED ──用户点击继续──> RUNNING
```

代码中的状态为：

```ts
type TaskStatus = "queued" | "running" | "waiting" | "paused" | "complete" | "failed" | "cancelled";
```

`cancelled` 表示用户主动取消。取消后的任务保留在任务记录中，不会自动恢复。

### 重启恢复

应用启动时：

1. 读取 `trackbox-state.json`。
2. 把上次处于 `running` 或 `waiting` 的任务标成 `paused`，原因设为 `app-restart`。
3. 创建主窗口和 17TRACK runner。
4. 自动恢复 `pauseReason === "app-restart"` 的任务。

用户主动暂停和查询窗口关闭产生的暂停原因分别是 `user` 和 `window-closed`，不会在下一次启动时自动重跑。

## 7. 数据模型

### 任务

```ts
interface TrackingTask {
  id: string;
  kind: "tracking";
  name: string;
  sourceFileName?: string;
  createdAt: string;
  updatedAt: string;
  status: TaskStatus;
  total: number;
  done: number;
  failed: number;
  currentBatch: number;
  totalBatches: number;
  batchSize: number;
  items: TrackingItem[];
  error?: string;
  pauseReason?: "user" | "window-closed" | "app-restart";
}
```

### 单号

```ts
interface TrackingItem {
  id: string;
  sourceRow?: number;
  trackingNumber: string;
  status: "pending" | "running" | "complete" | "failed";
  statusText?: string;
  carrier?: string;
  updatedAt?: string;
}
```

保留 `sourceRow` 是为了后续导出时能把查询结果映射回 Excel 原始行。

### 日志

```ts
interface TaskLogEntry {
  id: string;
  taskId?: string;
  createdAt: string;
  level: "info" | "warn" | "error";
  message: string;
}
```

日志最多保留最近 500 条，避免本地状态文件无限增长。

## 8. Excel 和单号解析

`src/features/tracking/input-parser.ts` 负责输入解析：

1. 读取第一个工作表。
2. 如果首行包含“物流单号、运单号、跟踪号、tracking、waybill、单号”等标题，使用对应列。
3. 如果无法识别标题，默认使用第一列。
4. 删除空值。
5. 按不区分大小写的单号去重。
6. 保留 Excel 行号。

手动输入支持空格、换行、英文逗号、中文逗号、英文分号和中文分号分隔。

## 9. 进程通信

Preload 只暴露白名单 API：

```ts
window.desktop.tasks.list();
window.desktop.tasks.logs();
window.desktop.tasks.create(input);
window.desktop.tasks.updateStatus(taskId, status);
window.desktop.tasks.onChanged(callback);
window.desktop.tasks.onLog(callback);
```

React 不直接访问 Node.js、文件系统或 Electron IPC。所有任务修改由主进程完成，主进程保存后广播 `tasks:changed`，日志通过 `tasks:log` 广播。

## 10. 17TRACK 查询窗口

`electron/tracking/tracking-window.ts` 使用：

- `BrowserWindow` 承载真实 17TRACK 页面。
- `session.fromPartition("persist:17track")` 保存 Cookie 和验证会话。
- 每批最多 40 个单号。
- URL 形态：`https://t.17track.net/zh-cn#nums=...`。
- 查询窗口关闭事件通知任务管理器暂停任务。
- `webContents.debugger` 连接 Chrome DevTools Protocol。
- `Runtime.evaluate`、等待元素、点击、读取文本和设置输入值统一由 `CdpClient` 提供。
- 页面文本、验证码节点和验证码 iframe 用于检测人机验证。

当前 runner 已完成窗口、持久化 session、批次 URL、CDP 连接、验证轮询和窗口关闭状态回传。

网页访问完全复用当前 Electron 项目的 `BrowserWindow`，没有引入第二套浏览器自动化运行时。CDP 只通过这个窗口的 `webContents.debugger` 操作页面，因此 Cookie、验证状态和用户看到的页面属于同一个 Electron session。

### CDP 页面操作接口

`electron/tracking/tracking-page-adapter.ts` 是唯一放置 17TRACK 页面选择器和字段映射的地方：

```ts
interface TrackingPageAdapter {
  detectHumanVerification(): Promise<boolean>;
  isBatchReady(): Promise<boolean>;
  readResults(): Promise<TrackingResult[]>;
}
```

其中 `CdpTrackingPageAdapter` 已提供可运行的验证检测占位实现，结果读取和稳定的批次完成条件保留 TODO。后续手动补页面操作时，优先使用 `CdpClient` 的以下方法：

```ts
cdp.waitForSelector(selector);
cdp.click(selector);
cdp.readText(selector);
cdp.setInputValue(selector, value);
cdp.evaluate(expression);
```

不要在 React 组件或任务管理器中直接写页面选择器。这样 17TRACK 页面改版时只需要修改 adapter。

## 11. 当前实现边界

已经实现：

- Electron + React + TypeScript + Vite 工程。
- Tailwind CSS v4 和 shadcn/ui 界面。
- 固定 800 x 600 主窗口。
- Excel 和手动单号输入。
- 单号识别、去重和来源行号保存。
- 任务 JSON 持久化。
- 日志持久化和 IPC 实时订阅。
- 任务状态变更、暂停、继续和应用重启恢复。
- 持久化 17TRACK 浏览器 session。
- 人机验证和查询窗口关闭检测。

尚未闭环：

- 从 17TRACK 页面稳定读取每个单号的完整物流结果，需要在 `tracking-page-adapter.ts` 中完成 CDP 选择器和字段映射。
- 批次完成后自动写入 `TrackingItem` 结果并推进下一批。
- 结果导出为 Excel。
- 任务详情页和订单结果表格。
- 失败批次的重试策略和超时策略。
- 真实网络环境下的人机验证回归测试。

17TRACK 是动态网页，结果字段和验证节点可能变化。结果解析应放在 `tracking-window.ts` 或独立的 `tracking-result-parser.ts` 中，并通过页面样本和手工验证流程维护，不应把选择器散落在 React 组件中。

## 12. 开发和验证命令

```bash
npm install
npm run dev
npm run build
npm run format:check
```

开发时如果需要自动打开 Electron 控制台：

```bash
OPEN_DEVTOOLS=1 npm run dev
```

Preload 使用独立的 CommonJS 编译目标 `electron/preload.cts`，产物是 `dist-electron/preload.cjs`；主进程仍然使用 ESM。这样可以避免 Electron 沙箱加载 ESM Preload 时出现 `Cannot use import statement outside a module`。

`npm run build` 会同时检查 React、Electron、Preload 和 TypeScript 共享契约。当前构建已通过；网络受限时无法通过 curl 验证 17TRACK 的实时页面，只能在有网络的桌面环境中做人工窗口和页面解析测试。
