import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { copyCaptureScript } from "../dist-electron/copy-capture.js";

function page({ input, selection = "", eventText } = {}) {
  const nativeCalls = [];
  const writes = [];
  const target = {
    dispatchEvent(event) {
      if (eventText !== undefined) event.clipboardData.setData("text/plain", eventText);
      return true;
    },
  };
  const document = {
    activeElement: input ? { ...input, ...target } : target,
    execCommand(command, ...args) {
      nativeCalls.push({ command, args, receiver: this });
      return "native-result";
    },
    ...target,
  };
  const window = {
    getSelection: () => ({ toString: () => selection, anchorNode: { nodeType: 1, ...target } }),
  };
  class DataTransfer {
    data = new Map();
    get types() {
      return [...this.data.keys()];
    }
    setData(type, text) {
      this.data.set(type, text);
    }
    getData(type) {
      return this.data.get(type) ?? "";
    }
  }
  class ClipboardEvent {
    constructor(type, options) {
      this.type = type;
      Object.assign(this, options);
    }
    preventDefault() {
      this.defaultPrevented = true;
    }
  }
  const navigator = {
    clipboard: {
      async writeText(value) {
        writes.push(value);
      },
      async write(value) {
        writes.push(value);
      },
    },
  };
  const context = vm.createContext({ window, document, navigator, DataTransfer, ClipboardEvent });
  const script = copyCaptureScript("capture");
  vm.runInContext(script, context);
  return { window, document, navigator, context, script, nativeCalls, writes };
}

test("captures the selected input range without invoking native copy", () => {
  const fixture = page({
    input: {
      tagName: "TEXTAREA",
      value: "prefix-DATA-suffix",
      selectionStart: 7,
      selectionEnd: 11,
    },
  });
  assert.equal(fixture.document.execCommand("COPY"), true);
  assert.equal(fixture.window.capture.text, "DATA");
  assert.equal(fixture.nativeCalls.length, 0);
  assert.equal(fixture.writes.length, 0);
});

test("captures selected page text and copy event payloads", () => {
  const selected = page({ selection: "shipment results" });
  selected.document.execCommand("copy");
  assert.equal(selected.window.capture.text, "shipment results");
  assert.equal(selected.nativeCalls.length, 0);
  const event = page({ selection: "placeholder", eventText: "custom clipboard payload" });
  event.document.execCommand("copy");
  assert.equal(event.window.capture.text, "custom clipboard payload");
  assert.equal(event.nativeCalls.length, 0);
});

test("keeps non-copy execCommand calls working with their original receiver and arguments", () => {
  const fixture = page();
  assert.equal(fixture.document.execCommand("selectAll", false, "argument"), "native-result");
  assert.equal(fixture.nativeCalls[0].receiver, fixture.document);
  assert.deepEqual(fixture.nativeCalls[0].args, [false, "argument"]);
});

test("clears stale copied text and retains an early cached execCommand reference", () => {
  const fixture = page({ selection: "first batch" });
  const cached = fixture.document.execCommand.bind(fixture.document);
  cached("copy");
  vm.runInContext(fixture.script, fixture.context);
  assert.equal(fixture.window.capture.text, null);
  fixture.window.getSelection = () => ({ toString: () => "second batch" });
  cached("copy");
  assert.equal(fixture.window.capture.text, "second batch");
  assert.equal(fixture.nativeCalls.length, 0);
});

test("an empty copy cannot reuse a previous result", () => {
  const fixture = page({ selection: "old result" });
  fixture.document.execCommand("copy");
  vm.runInContext(fixture.script, fixture.context);
  fixture.window.getSelection = () => null;
  fixture.document.execCommand("copy");
  assert.equal(fixture.window.capture.text, "");
  assert.equal(fixture.nativeCalls.length, 0);
});

test("blocks Clipboard API writes rather than changing the system clipboard", async () => {
  const fixture = page();
  await assert.rejects(
    fixture.navigator.clipboard.writeText("must not reach clipboard"),
    /execCommand/,
  );
  await assert.rejects(fixture.navigator.clipboard.write([]), /execCommand/);
  assert.equal(fixture.writes.length, 0);
  assert.match(fixture.window.capture.error, /execCommand/);
});
