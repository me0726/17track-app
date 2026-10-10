import { BrowserWindow, session } from "electron";
import { EventEmitter } from "node:events";
import { CdpClient } from "./cdp-client.js";
import {
  CdpTrackingPageAdapter,
  type TrackingPageAdapter,
  type TrackingResult,
} from "./tracking-page-adapter.js";

const trackingUrl = "https://t.17track.net/zh-cn#nums=";

export class TrackingWindow extends EventEmitter {
  private window?: BrowserWindow;
  private cdp?: CdpClient;
  private pageAdapter?: TrackingPageAdapter;
  private inspectionTimer?: NodeJS.Timeout;
  private verificationVisible = false;
  private readonly partition = "persist:17track";

  async openBatch(numbers: string[]) {
    const window = this.ensureWindow();
    window.show();
    window.focus();
    const encodedNumbers = numbers.map((number) => encodeURIComponent(number)).join(",");
    await window.loadURL(`${trackingUrl}${encodedNumbers}`);
    this.cdp = new CdpClient(window.webContents);
    await this.cdp.attach();
    await this.cdp.send("Page.enable");

    window.webContents.executeJavaScript(
      //language=JavaScript
      `
        (() => {
          
          let latestPastedText=null;
          
          const oldExecCommand = document.execCommand;
          
          window.latestPastedText=()=>latestPastedText;

          document.execCommand = function(cmd, ...args) {

            if (cmd.toLowerCase() === "copy") {
              console.log("拦截 copy");

              const selection = window.getSelection();
              const text = selection ? selection.toString() : "";

              console.log("复制内容:", text,args);
              latestPastedText=text;
              // 不调用原始 execCommand
              return true;
            }

            return oldExecCommand.call(
              document,
              cmd,
              ...args
            );
          };
        })();
    `,
    );
    this.pageAdapter = new CdpTrackingPageAdapter(this.cdp);
    this.startPageInspection();
  }

  close() {
    this.stopPageInspection();
    if (this.window && !this.window.isDestroyed()) this.window.close();
  }

  async isBatchReady() {
    return this.pageAdapter?.isBatchReady() ?? false;
  }

  async readResults(): Promise<TrackingResult[]> {
    return this.pageAdapter?.readResults() ?? [];
  }

  private ensureWindow() {
    if (this.window && !this.window.isDestroyed()) return this.window;
    this.window = new BrowserWindow({
      width: 1100,
      height: 760,
      title: "17TRACK 物流查询",
      backgroundColor: "#ffffff",
      show: false,
      webPreferences: {
        session: session.fromPartition(this.partition),
        contextIsolation: true,
        sandbox: true,
      },
    });
    this.window.on("closed", () => {
      this.stopPageInspection();
      void this.cdp?.detach();
      this.window = undefined;
      this.cdp = undefined;
      this.pageAdapter = undefined;
      this.verificationVisible = false;
      this.emit("closed");
    });
    return this.window;
  }

  private startPageInspection() {
    this.stopPageInspection();
    this.inspectionTimer = setInterval(() => void this.inspectPage(), 1500);
    void this.inspectPage();
  }

  private stopPageInspection() {
    if (this.inspectionTimer) clearInterval(this.inspectionTimer);
    this.inspectionTimer = undefined;
  }

  private async inspectPage() {
    if (!this.window || this.window.isDestroyed() || !this.pageAdapter) return;
    try {
      const challengeVisible = await this.pageAdapter.detectHumanVerification();
      if (challengeVisible && !this.verificationVisible) this.emit("human-verification");
      this.verificationVisible = challengeVisible;
    } catch (error) {
      this.emit("inspection-error", error);
    }
  }
}
