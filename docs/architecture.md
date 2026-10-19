# 物流查询：功能与数据存储

应用提供三个简单页面：**物流查询**、**任务记录**和**原始内容**。使用 Electron + React + Tailwind CSS + shadcn 默认 neutral 主题，主窗口初始为 800 × 600，支持调整大小，最小为 800 × 600。顶部保留页面切换，底部显示任务运行状态，各页面统一使用 shadcn Card 布局，内容区独立滚动，分页与主要操作固定在底部。任务创建时间放在任务名称下方，状态使用 Badge，总数、已完成与失败分别右对齐显示。

## 使用流程

1. 输入快递单号或导入 Excel。导入仅填充输入框，不创建任务。
2. 点击“开始查询”：在同一个数据库事务中创建一条 task 和去重后的 task_item，每个单号一条明细。
3. 浏览器按每批最多 40 个单号查询。每批复制成功，在同一事务中把完整复制原文写入 task_batch、解析结果写入 task_item，并关联批次。
4. 暂停会中止页面等待并关闭查询窗口，已经提交的结果保留。
5. 只有暂停的任务可以继续，仅读取 pending（等待中）的 task_item，已完成与失败明细均保持原状态。
6. 重启后，上次中断的 running 任务转为 paused，可在任务记录页手动继续。

同一时间只运行一个任务。任务状态只有 running（查询中）、paused（暂停）、ended（已结束）。查询完成或发生查询错误后，任务均为已结束，错误原因记录在对应 task_item 中。已结束任务没有继续按钮；详情存在失败明细时可点击“重试失败项”，在事务中将 failed 回退为 pending、清空旧错误和解析结果，并将任务置为暂停，随后立即重新启动查询。已完成明细与原始批次保留。

任务记录列表将总数、已完成、失败分为三列，数字右对齐，失败数大于零时使用醒目的错误色，便于逐行比较。

查询页仅保留导入、输入和查询操作。任务详情仅显示**单号、物流信息、状态**三列，长文本截断，悬停显示完整内容；点击物流信息打开原始内容页的对应批次。尚未复制的明细不显示原文链接。详情按状态筛选、每页 10 条，支持导出整个任务的 Excel 明细，导出列与页面一致，不受当前筛选和分页影响。

## SQLite

直接使用当前 Electron 内置的 node:sqlite，不依赖 ORM 或额外原生扩展。文件位于 app.getPath("userData") 下的 **trackbox.sqlite**，启用 WAL、外键和事务。

| 表         | 字段                     | 用途                                         |
| ---------- | ------------------------ | -------------------------------------------- |
| task       | id                       | 自增主键                                     |
| task       | name、source_file        | 任务名称和来源文件                           |
| task       | status                   | running / paused / ended                     |
| task       | created_at、updated_at   | 创建与更新时间                               |
| task_item  | id、task_id              | 自增主键和所属任务外键                       |
| task_item  | tracking_number          | 物流单号，同一任务内唯一                     |
| task_item  | status                   | pending / processing / completed / failed    |
| task_item  | result_text              | 按单号解析后的单行 TSV 内容                  |
| task_item  | origin_country 等字段    | 始发地、目的地、最新轨迹、物流状态、运输时长 |
| task_item  | error                    | 未匹配或格式错误的原因                       |
| task_item  | batch_id、batch_no       | 结果关联的原始批次外键及批次编号             |
| task_item  | updated_at               | 明细更新时间                                 |
| task_batch | id、task_id              | 批次主键和所属任务外键                       |
| task_batch | batch_no                 | 任务内递增批次号，任务内唯一                 |
| task_batch | raw_text                 | 完整未解析复制文本，原样保留空白和换行       |
| task_batch | tracking_numbers         | 当前批次请求的单号 JSON 数组                 |
| task_batch | number_count、created_at | 请求单号数和复制保存时间                     |

任务总数、已保存数量直接从 task_item 汇总。任务创建和批次结果写入均使用事务；空结果不计为完成，批次写入中有一条失败则整批回滚。

每次成功拦截复制都会新增 task_batch，包括原文无法解析的批次。未匹配或解析失败的明细也关联该批次。重试更新明细的 batch_id，追加新原文，不覆盖旧批次；尚未再次复制时保留上次的来源关联。原始内容列表只读取批次元数据，打开某个批次后再读取完整原文。开发阶段直接按当前结构建表，不包含旧结构的数据迁移。

原始内容页支持按完整单号搜索，去除首尾空格、忽略大小写。SQLite 使用 json_each 在 tracking_numbers 中精确匹配，不在原文内做子串匹配，避免 AA1 匹配 AA10。所有相关任务、历史重试批次按保存顺序倒序返回，解析失败或原文缺少该单号时仍可搜索到提交该单号的批次。清空或重置搜索后显示全部批次。

原始内容列表的单号搜索和详情的页内查找均放在标题右侧，查看关联任务的入口放在原文详情左下方。原始内容详情支持页内查找：输入后立即高亮所有匹配，忽略大小写、按普通文本匹配，显示当前匹配序号和总数。上一个/下一个按钮或 Shift+Enter / Enter 循环切换并滚动定位，Ctrl+F / ⌘F 聚焦查找框，Esc 清空。原文的制表符、换行和空白原样显示，查找只影响展示。同一批次更新期间保留查找内容，切换批次重新开始。

### 结果分段

复制结果按制表符分成六列：快递单号、始发国家、目的国家、最新轨迹、物流状态、运输时长。每行第一个字段必须精确匹配任务中的快递单号；缺少单号、重复单号或列数不足会写入 failed，并保留 error 原因。结果不会按字符串包含关系匹配，避免 AA1 错配到 AA10。

## 浏览器操作

使用真实 Electron BrowserWindow 和 persist:17track 会话，通过 webContents.debugger 调用 CDP：

1. 通过 https://t.17track.net/zh-cn#nums=... 填入当前批次。
2. 等待“查询中，请稍后”或“查询中，请稍候”消失，并连续两次检查操作栏第二个按钮可用。
3. 出现人机验证时，由用户在同一个浏览器窗口手动完成，验证等待不计入查询超时。
4. 点击 #yq-tracking-operation 或 .yq-tracking-operation 内第二个 button。
5. 页面加载前注入 `document.execCommand("copy")` 拦截，点击按钮后直接获取选中文本或 `copy` 事件提供的文本，立即写入数据库。自动提取不读写系统剪贴板；若网页改用 Clipboard API 写入，则拒绝并报错。
6. 继续下一批。

关闭浏览器或主窗口会暂停当前任务。退出应用时等待当前任务中止并保存状态，再关闭数据库。

## 代码结构

    src/
    ├── main.tsx           React 挂载入口
    ├── App.tsx            页面组合、导航与 IPC 订阅
    ├── QueryForm.tsx      Excel/手动输入和查询操作
    ├── TaskHistory.tsx    任务记录列表
    ├── TaskDetailView.tsx 单号明细、状态筛选、分页和导出
    ├── RawCopies.tsx      原始批次列表及复制原文查看
    ├── RawCopyContent.tsx 原文详情、页内查找与高亮定位
    ├── input-parser.ts    Excel 读取和单号去重
    ├── vite-env.d.ts      Preload API 类型
    └── components/ui/     shadcn 组件

    electron/
    ├── main.ts            窗口、任务执行、暂停/继续和 IPC
    ├── database.ts        SQLite 三张表及数据读写
    ├── export.ts          任务明细 Excel 生成
    ├── result-parser.ts   复制文本按单号分段
    ├── copy-capture.ts    页面内拦截复制文本
    ├── task-types.ts      主进程与 React 共用的任务类型
    ├── tracking.ts        17TRACK 查询与复制流程
    └── preload.cts        CommonJS 桥接

保留具体业务模块，没有通用工具注册、进度条、任务调度框架或日志中心。

## Preload API

- tasks.create({ numbers, sourceFileName? })：先创建数据，再启动查询，返回任务详情。
- tasks.list() / tasks.get(id)：任务列表和包含 task_item 的详情。
- tasks.itemsPage({ taskId, status, page, pageSize })：详情页按状态分页读取单号。
- tasks.export(id)：通过系统保存对话框导出整个任务的 Excel；取消时返回 null。
- tasks.batches(trackingNumber?) / tasks.batch(id)：按单号筛选的原始批次摘要列表与完整原文（含所属任务和请求单号）。
- tasks.pause(id) / tasks.resume(id)：暂停与继续同一任务；继续仅允许暂停状态。
- tasks.retryFailed(id)：仅对已结束且存在失败明细的任务，将失败明细回退为等待中，再启动查询。
- tasks.onChanged(callback)：数据库内容变更后刷新列表。
- tasks.onMessage(callback)：接收当前查询状态文案。

以上 API 位于 window.desktop.tasks；React 不直接操作数据库或 Node.js。

## Excel

只读第一个工作表。首行包含“物流单号、快递单号、运单号、跟踪号、追踪号、tracking、waybill、单号”等标题时读取对应列，否则读取第一列。空值被删除，单号统一为大写后去重。Excel 应把快递号保存为文本，避免长数字在源文件中丢失精度。

## 开发与验证

    npm install
    npm run dev
    OPEN_DEVTOOLS=1 npm run dev
    npm run build
    npm test
    npm run format:check

dev 会先编译主进程与 CommonJS Preload，Vite 使用相对资源路径以兼容 Electron loadFile。

数据库测试覆盖创建事务、去重、分段、批次原文、部分结果保存、暂停/继续、任务结束、失败项回退重试、重启恢复和批次回滚。17TRACK 线上页面改版时，调整 tracking.ts 中的等待条件和操作栏选择器即可。
