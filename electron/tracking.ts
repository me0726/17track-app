import { BrowserWindow, session, type WebContents } from "electron";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { copyCaptureScript } from "./copy-capture.js";

let browser: BrowserWindow | undefined;
let activeQuery: AbortController | undefined;

export class QueryPausedError extends Error {}

// Website-specific checks live here; this is the second button in the operation group.
const copyButton = `document.querySelector("#yq-tracking-operation, .yq-tracking-operation")?.querySelectorAll("button")[1]`;
const inspectPage = `(() => {
  const visible = (element) => element && element.getClientRects().length > 0
    && getComputedStyle(element).visibility !== "hidden";
  const text = document.body?.innerText || "";
  const verification = /(请完成验证|人机验证|安全验证|verify you are human)/i.test(text)
    || [...document.querySelectorAll('[class*="captcha"], [id*="captcha"], iframe[src*="captcha"]')].some(visible);
  const button = ${copyButton};
  return {
    verification,
    ready: !verification && !/查询中[，,]?\\s*请\\s*稍[后候]/.test(text)
      && visible(button) && !button.disabled && button.getAttribute("aria-disabled") !== "true"
  };
})()`;

export async function queryTracking(
  input: unknown,
  onMessage: (message: string) => void,
  onBatch: (numbers: string[], text: string) => void = () => {},
): Promise<string> {
  if (activeQuery) throw new Error("当前查询尚未结束");
  if (!Array.isArray(input) || input.some((number) => typeof number !== "string")) {
    throw new Error("物流单号格式不正确");
  }
  const numbers = [...new Set((input as string[]).map((number) => number.trim()).filter(Boolean))];
  if (!numbers.length) throw new Error("请输入物流单号");
  const controller = new AbortController();
  activeQuery = controller;
  const { signal } = controller;
  const results: string[] = [];
  const captureKey = `__trackbox_copy_${randomUUID()}`;
  const captureScript = copyCaptureScript(captureKey);
  let scriptId: string | undefined;
  let window: BrowserWindow | undefined;
  let contents: WebContents | undefined;
  const onClosed = () => controller.abort(new QueryPausedError("查询窗口已关闭，任务已暂停"));

  try {
    window = getBrowser();
    window.once("closed", onClosed);
    contents = window.webContents;
    window.show();
    window.focus();
    // Initialize the renderer before attaching CDP, while still preceding website scripts.
    await window.loadURL("about:blank");
    signal.throwIfAborted();
    contents.debugger.attach("1.3");
    await contents.debugger.sendCommand("Page.enable");
    const registration = await contents.debugger.sendCommand(
      "Page.addScriptToEvaluateOnNewDocument",
      { source: captureScript },
    );
    scriptId = registration.identifier;
    for (let index = 0; index < numbers.length; index += 40) {
      signal.throwIfAborted();
      onMessage("正在打开查询页面…");
      // A fresh document prevents the next batch from reading the previous batch's results.
      await window.loadURL("about:blank");
      const batch = numbers.slice(index, index + 40);
      const encoded = batch.map((number) => encodeURIComponent(number)).join(",");
      await window.loadURL(`https://t.17track.net/zh-cn#nums=${encoded}`);
      await waitForResults(contents, signal, onMessage);
      signal.throwIfAborted();
      onMessage("正在提取查询结果…");
      window.focus();
      const text = await copyResults(contents, signal, captureKey, captureScript);
      onBatch(batch, text);
      results.push(text);
    }
    signal.throwIfAborted();
    const text = results.join("\n\n");
    onMessage("查询完成");
    return text;
  } catch (error) {
    if (signal.aborted) throw signal.reason;
    throw error;
  } finally {
    try {
      window?.removeListener("closed", onClosed);
      if (contents && !contents.isDestroyed() && contents.debugger.isAttached()) {
        if (scriptId)
          await contents.debugger
            .sendCommand("Page.removeScriptToEvaluateOnNewDocument", { identifier: scriptId })
            .catch(() => {});
        if (!contents.isDestroyed() && contents.debugger.isAttached()) contents.debugger.detach();
      }
    } finally {
      activeQuery = undefined;
    }
  }
}

export function stopQuery() {
  if (!activeQuery) return;
  activeQuery.abort(new QueryPausedError("任务已暂停"));
  const window = browser;
  browser = undefined;
  if (window && !window.isDestroyed()) window.close();
}

function getBrowser() {
  if (browser && !browser.isDestroyed()) return browser;
  const window = new BrowserWindow({
    width: 1100,
    height: 760,
    title: "17TRACK 物流查询",
    show: false,
    webPreferences: {
      session: session.fromPartition("persist:17track"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  window.on("closed", () => {
    if (browser === window) browser = undefined;
  });
  browser = window;
  return window;
}

async function waitForResults(
  contents: WebContents,
  signal: AbortSignal,
  onMessage: (message: string) => void,
) {
  let deadline = Date.now() + 30_000;
  let readyCount = 0;
  let lastMessage = "";
  while (Date.now() < deadline) {
    await delay(1000, undefined, { signal });
    const page = await evaluate<{ verification: boolean; ready: boolean }>(contents, inspectPage);
    signal.throwIfAborted();
    const message = page.verification ? "请在浏览器中完成人机验证" : "正在等待查询结果…";
    if (message !== lastMessage) onMessage(message);
    lastMessage = message;
    // Manual verification time does not consume the query timeout.
    if (page.verification) deadline = Date.now() + 30_000;
    readyCount = page.ready ? readyCount + 1 : 0;
    if (readyCount >= 2) return;
  }
  throw new Error("查询超时，请检查浏览器页面后重试");
}

async function copyResults(
  contents: WebContents,
  signal: AbortSignal,
  captureKey: string,
  captureScript: string,
): Promise<string> {
  signal.throwIfAborted();
  // Reset the page buffer and reapply the hook if the site replaced execCommand.
  await evaluate(contents, captureScript);
  signal.throwIfAborted();
  const clicked = await evaluate<boolean>(
    contents,
    `(() => {
      const button = ${copyButton};
      if (!button || button.disabled) return false;
      button.click();
      return true;
    })()`,
  );
  if (!clicked) throw new Error("没有找到可用的复制结果按钮");
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    signal.throwIfAborted();
    const capture = await evaluate<{ text: string | null; error: string | null }>(
      contents,
      `(() => { const capture = window[${JSON.stringify(captureKey)}]; return capture ? { text: capture.text, error: capture.error } : { text: null, error: "页面复制拦截已失效" }; })()`,
    );
    signal.throwIfAborted();
    if (capture.error) throw new Error(capture.error);
    if (typeof capture.text === "string" && capture.text.trim()) return capture.text;
    await delay(100, undefined, { signal });
  }
  throw new Error("未能拦截到复制文本，请检查网页复制按钮");
}

async function evaluate<T>(contents: WebContents, expression: string): Promise<T> {
  const response = await contents.debugger.sendCommand("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
    userGesture: true,
  });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.exception?.description ?? "读取网页失败");
  }
  return response.result.value as T;
}
