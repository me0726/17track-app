import * as XLSX from "xlsx";
import type { ItemStatus, TaskDetail } from "./task-types.js";

const statusText: Record<ItemStatus, string> = {
  pending: "等待中",
  processing: "处理中",
  completed: "已完成",
  failed: "失败",
};

export function createTaskWorkbook(task: TaskDetail): Buffer {
  const sheet = XLSX.utils.aoa_to_sheet([
    ["单号", "物流信息", "状态"],
    ...task.items.map((item) => [
      item.trackingNumber,
      item.latestEvent || item.error || "",
      statusText[item.status],
    ]),
  ]);
  sheet["!cols"] = [{ wch: 24 }, { wch: 85 }, { wch: 12 }];
  sheet["!autofilter"] = { ref: sheet["!ref"]! };
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "任务明细");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

export function exportFileName(task: TaskDetail) {
  const name = task.name
    .replace(/\.(xlsx|xls)$/i, "")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .slice(0, 80);
  return `${name || "物流查询"}-任务${task.id}.xlsx`;
}
