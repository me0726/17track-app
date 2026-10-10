import type { CdpClient } from "./cdp-client.js";

export interface TrackingResult {
  trackingNumber: string;
  carrier?: string;
  statusText?: string;
  deliveredAt?: string;
  raw?: unknown;
}

export interface TrackingPageAdapter {
  detectHumanVerification(): Promise<boolean>;
  isBatchReady(): Promise<boolean>;
  readResults(): Promise<TrackingResult[]>;
}

export class CdpTrackingPageAdapter implements TrackingPageAdapter {
  constructor(private readonly cdp: CdpClient) {}

  async detectHumanVerification() {
    // TODO: replace with selectors and signals observed in the real 17TRACK verification flow.
    return (
      (await this.cdp.evaluate<boolean>(`(() => {
      const bodyText = document.body?.innerText || "";
      const textMatch = /(验证码|人机验证|安全验证|请完成验证|captcha|verify you are human)/i.test(bodyText);
      const elementMatch = Boolean(document.querySelector('[class*="captcha"], [id*="captcha"], iframe[src*="captcha"]'));
      return textMatch || elementMatch;
    })()`)) ?? false
    );
  }

  async isBatchReady() {
    // TODO: inspect the current 17TRACK result/loading indicators and implement a reliable readiness check.
    try {
      return (
        (await this.cdp.evaluate<boolean>(
          `document.body?.innerText.indexOf("查询中，请稍候…")<0 && document.querySelector("#yq-tracking-operation button:nth-of-type(2)")!=undefined`,
        )) ?? false
      );
    }catch (e) {
      console.error("检查文档ready失败",e);
      return false;
    }
  }

  async readResults(): Promise<TrackingResult[]> {
    this.cdp.evaluate<void>(
      `document.querySelector("#yq-tracking-operation button:nth-of-type(2)").click()`,
    );
    // TODO: inspect the page's rendered result cards or app state and map them to TrackingResult.
    // Keep all 17TRACK-specific selectors and fields in this adapter.
    let value = await this.cdp.evaluate<string>(`window.latestPastedText()`);
    console.log(value);
    return [];
  }
}
