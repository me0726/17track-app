import type { WebContents } from "electron";

export class CdpClient {
  private attached = false;

  constructor(private readonly webContents: WebContents) {}

  async attach() {
    if (!this.webContents.debugger.isAttached()) {
      this.webContents.debugger.attach("1.3");
    }
    this.attached = true;
    await this.sendRaw("Runtime.enable");
    await this.sendRaw("Page.enable");
  }

  async detach() {
    if (!this.attached || this.webContents.isDestroyed()) return;
    if (this.webContents.debugger.isAttached()) this.webContents.debugger.detach();
    this.attached = false;
  }

  async send<T = Record<string, unknown>>(
    method: string,
    params?: Record<string, unknown>,
  ): Promise<T> {
    await this.attachIfNeeded();
    return this.sendRaw(method, params) as Promise<T>;
  }

  async evaluate<T>(expression: string): Promise<T | undefined> {
    const response = await this.send<{
      result?: { value?: T };
      exceptionDetails?: {
        text?: string;
        lineNumber?: number;
        columnNumber?: number;
        exception?: {
          description?: string;
        };
      };
    }>("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });

    if (response.exceptionDetails) {
      console.error("CDP evaluate error:", JSON.stringify(response.exceptionDetails, null, 2));

      throw new Error(
        response.exceptionDetails.exception?.description ??
          response.exceptionDetails.text ??
          "CDP Runtime.evaluate failed",
      );
    }

    return response.result?.value;
  }

  async waitForSelector(selector: string, timeoutMs = 15000): Promise<boolean> {
    const selectorLiteral = JSON.stringify(selector);
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const found = await this.evaluate<boolean>(
        `Boolean(document.querySelector(${selectorLiteral}))`,
      );
      if (found) return true;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return false;
  }

  async click(selector: string): Promise<boolean> {
    const selectorLiteral = JSON.stringify(selector);
    return (
      (await this.evaluate<boolean>(`(() => {
        const element = document.querySelector(${selectorLiteral});
        if (!element) return false;
        element.click();
        return true;
      })()`)) ?? false
    );
  }

  async readText(selector: string): Promise<string | undefined> {
    const selectorLiteral = JSON.stringify(selector);
    return this.evaluate<string>(`document.querySelector(${selectorLiteral})?.textContent?.trim()`);
  }

  async setInputValue(selector: string, value: string): Promise<boolean> {
    const selectorLiteral = JSON.stringify(selector);
    const valueLiteral = JSON.stringify(value);
    return (
      (await this.evaluate<boolean>(`(() => {
        const element = document.querySelector(${selectorLiteral});
        if (!element) return false;
        const prototype = element instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
        if (setter) setter.call(element, ${valueLiteral});
        else element.textContent = ${valueLiteral};
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      })()`)) ?? false
    );
  }

  private async attachIfNeeded() {
    if (this.attached && this.webContents.debugger.isAttached()) return;
    if (!this.webContents.debugger.isAttached()) this.webContents.debugger.attach("1.3");
    this.attached = true;
  }

  private sendRaw(method: string, params?: Record<string, unknown>) {
    return this.webContents.debugger.sendCommand(method, params);
  }
}
