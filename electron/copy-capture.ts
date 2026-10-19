// Runs in the query page's main world before its scripts initialize.
export function copyCaptureScript(key: string): string {
  return `(() => {
    const key = ${JSON.stringify(key)};
    const capture = window[key] || (window[key] = { text: null, error: null });
    capture.text = null;
    capture.error = null;
    if (document.execCommand !== capture.execCommand) {
      const original = document.execCommand;
      capture.execCommand = function(command, ...args) {
        if (String(command).toLowerCase() !== "copy") return original.call(this, command, ...args);
        const active = document.activeElement;
        const inputSelected = active && /^(INPUT|TEXTAREA)$/.test(active.tagName)
          && typeof active.value === "string" && typeof active.selectionStart === "number";
        const selection = window.getSelection();
        let text = inputSelected
          ? active.value.slice(active.selectionStart, active.selectionEnd)
          : selection?.toString() || "";
        const node = selection?.anchorNode;
        const target = inputSelected ? active : (node?.nodeType === 1 ? node : node?.parentElement) || active || document;
        // Some copy libraries provide the payload through an event listener.
        const data = new DataTransfer();
        const event = new ClipboardEvent("copy", { clipboardData: data, bubbles: true, cancelable: true });
        event.preventDefault();
        target.dispatchEvent(event);
        if (data.types.includes("text/plain")) text = data.getData("text/plain");
        capture.text = text;
        return true;
      };
      document.execCommand = capture.execCommand;
    }
    // If the page switches to Clipboard API, fail rather than writing to the OS clipboard.
    const clipboard = navigator.clipboard;
    if (clipboard) {
      const rejectWrite = () => {
        capture.error = "复制按钮未通过 execCommand 提供文本，请检查网页复制方式";
        return Promise.reject(new Error(capture.error));
      };
      Object.defineProperty(clipboard, "writeText", { configurable: true, value: rejectWrite });
      Object.defineProperty(clipboard, "write", { configurable: true, value: rejectWrite });
    }
    return true;
  })()`;
}
