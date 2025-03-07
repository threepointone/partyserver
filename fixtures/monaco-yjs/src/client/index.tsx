import * as monaco from "monaco-editor";
import { WebSocket as BetterWebSocket } from "partysocket";
import { MonacoBinding } from "y-monaco";
import YProvider from "y-partyserver/provider";
import * as Y from "yjs";

window.MonacoEnvironment = {
  getWorkerUrl: (moduleId, label) => {
    if (label === "json") {
      // return "/dist/json.worker.bundle.js";
      return "/dist/monaco-editor/esm/vs/language/json/json.js";
    }
    if (label === "css" || label === "scss" || label === "less") {
      return "/dist/monaco-editor/esm/vs/language/css/css.js";
      // return "/dist/css.worker.bundle.js";
    }
    if (label === "html" || label === "handlebars" || label === "razor") {
      return "/dist/monaco-editor/esm/vs/language/html/html.js";
      // return "/dist/html.worker.bundle.js";
    }
    if (label === "typescript" || label === "javascript") {
      // return "/dist/ts.worker.bundle.js";
      return "/dist/monaco-editor/esm/vs/language/typescript/ts.js";
    }
    return "/dist/monaco-editor/esm/vs/editor/editor.worker.js";
    // return "/dist/editor.worker.bundle.js";
  }
};

window.addEventListener("load", () => {
  const ydoc = new Y.Doc();
  const provider = new YProvider(window.location.origin, "monaco-demo", ydoc, {
    party: "monaco",
    // @ts-expect-error I don't know typescript
    WebSocketPolyfill: BetterWebSocket
  });

  provider.ws?.send("do-the-thing");

  const type = ydoc.getText("monaco");

  const editor = monaco.editor.create(
    /** @type {HTMLElement} */ document.getElementById("monaco-editor")!,
    {
      value: "",
      language: "javascript",
      theme: "vs-dark"
    }
  );
  new MonacoBinding(
    type,
    /** @type {monaco.editor.ITextModel} */ editor.getModel()!,
    new Set([editor]),
    provider.awareness
  );

  const connectBtn =
    /** @type {HTMLElement} */ document.getElementById("y-connect-btn")!;
  connectBtn.addEventListener("click", () => {
    if (provider.shouldConnect) {
      provider.disconnect();
      connectBtn.textContent = "Connect";
    } else {
      provider.connect().catch(console.error);
      connectBtn.textContent = "Disconnect";
    }
  });
});
