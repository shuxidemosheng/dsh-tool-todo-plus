window.__ModuleLoader__.load({ id: "dsh-tool-todo-plus", factory: (require) => { var module = { exports: {} }; var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client.tsx
var client_exports = {};
__export(client_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(client_exports);
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var TAB_ID = "dsh-tool-todo-plus";
var TAB_KIND = "todo-plus";
var snapshot = [];
var listeners = /* @__PURE__ */ new Set();
function setTodos(next) {
  const value = next ?? [];
  if (value === snapshot) return;
  snapshot = value;
  for (const listener of listeners) listener();
}
var subscribe = (listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
var getSnapshot = () => snapshot;
var BRIDGE_ID = "todo-plus-bridge";
var HEADER_ACTION_ID = "todo-plus-header-action";
var FLOAT_WIDTH = 380;
var FLOAT_HEIGHT = 520;
var CAPSULE_WIDTH = 300;
var CAPSULE_HEIGHT = 120;
var floatedTabs = /* @__PURE__ */ new Set();
function floatRect(width, height) {
  const w = Math.min(width, Math.max(200, window.innerWidth - 48));
  const h = Math.min(height, Math.max(90, window.innerHeight - 120));
  return { x: Math.max(12, window.innerWidth - w - 20), y: 68, width: w, height: h };
}
function floatPanelIn(ctx, tabId, paneId, width, height) {
  const rect = floatRect(width, height);
  if (paneId !== void 0) {
    try {
      ctx.sidebarRight.dock(paneId);
    } catch {
    }
  }
  try {
    ctx.sidebarRight.float(tabId, rect);
  } catch {
  }
}
function TodoBridge(props) {
  const todos = props.useProjection?.("todos") ?? null;
  (0, import_react.useEffect)(() => {
    setTodos(todos);
  }, [todos]);
  const signature = todos === null || todos.length === 0 ? "" : JSON.stringify(todos);
  const lastSignature = (0, import_react.useRef)("");
  (0, import_react.useEffect)(() => {
    if (signature === "" || signature === lastSignature.current) return;
    lastSignature.current = signature;
    const sr = sidebarRight;
    if (sr === void 0) return;
    try {
      sr.openTab(TAB_KIND);
    } catch (error) {
      console.warn("[dsh-tool-todo-plus] open panel failed:", error);
    }
  }, [signature]);
  return null;
}
function dotColor(status) {
  if (status === "completed") return "#3fb950";
  if (status === "in_progress") return "#58a6ff";
  return "#8b949e";
}
function TodoHeaderAction(_props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "button",
    {
      type: "button",
      title: "\u4EFB\u52A1\u6E05\u5355",
      "aria-label": "\u4EFB\u52A1\u6E05\u5355",
      onClick: () => {
        try {
          sidebarRight?.openTab(TAB_KIND);
        } catch {
        }
      },
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 12,
        padding: "3px 9px",
        borderRadius: 6,
        border: "1px solid rgba(128,128,128,0.45)",
        background: "transparent",
        color: "inherit",
        cursor: "pointer",
        opacity: 0.85
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { "aria-hidden": true, children: "\u2630" }),
        "\u4EFB\u52A1\u6E05\u5355"
      ]
    }
  );
}
function capsuleSummary(todos) {
  const current = todos.find((t) => t.status === "in_progress");
  if (current !== void 0) {
    return { icon: "\u2192", text: current.content, color: "#58a6ff" };
  }
  let lastDone;
  for (const t of todos) if (t.status === "completed") lastDone = t;
  if (lastDone !== void 0) {
    return { icon: "\u2713", text: lastDone.content, color: "#3fb950" };
  }
  if (todos.length > 0) {
    const done = todos.filter((t) => t.status === "completed").length;
    return { icon: "\u2630", text: `\u5F85\u529E ${done}/${todos.length}` };
  }
  return null;
}
function TodoSidebarBody(props) {
  (0, import_react.useSyncExternalStore)(subscribe, getSnapshot);
  const useTabInfo = props.useTabInfo;
  const info = useTabInfo ? useTabInfo() : void 0;
  const tabId = info?.tab?.id;
  const paneId = info?.panel?.id;
  const [collapsed, setCollapsed] = (0, import_react.useState)(false);
  (0, import_react.useEffect)(() => {
    const sr = sidebarRight;
    if (tabId === void 0 || sr === void 0 || floatedTabs.has(tabId)) return;
    floatedTabs.add(tabId);
    floatPanelIn({ sidebarRight: sr }, tabId, paneId, FLOAT_WIDTH, FLOAT_HEIGHT);
  }, [tabId, paneId]);
  const todos = snapshot;
  const completed = todos.filter((t) => t.status === "completed").length;
  const inProgress = todos.filter((t) => t.status === "in_progress").length;
  const progressLabel = `${completed}/${todos.length}${inProgress > 0 ? ` \xB7 ${inProgress} \u8FDB\u884C\u4E2D` : ""}`;
  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    const sr = sidebarRight;
    if (sr === void 0 || tabId === void 0) return;
    floatPanelIn(
      { sidebarRight: sr },
      tabId,
      paneId,
      next ? CAPSULE_WIDTH : FLOAT_WIDTH,
      next ? CAPSULE_HEIGHT : FLOAT_HEIGHT
    );
  };
  if (collapsed) {
    const summary = capsuleSummary(todos);
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { padding: "8px 10px" }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "button",
      {
        type: "button",
        onClick: toggleCollapsed,
        title: "\u5C55\u5F00\u72B6\u6001",
        "aria-label": "\u5C55\u5F00\u72B6\u6001",
        style: {
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          maxWidth: "100%",
          fontSize: 12,
          padding: "5px 12px",
          borderRadius: 999,
          border: "1px solid rgba(128,128,128,0.45)",
          background: "transparent",
          color: "inherit",
          cursor: "pointer"
        },
        children: summary === null ? "\u4EFB\u52A1\u6E05\u5355" : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { "aria-hidden": true, style: {
            flex: "none",
            color: summary.color ?? "inherit",
            opacity: summary.color === void 0 ? 0.75 : 1
          }, children: summary.icon }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap"
          }, children: summary.text })
        ] })
      }
    ) });
  }
  if (todos.length === 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { padding: "12px 14px", fontSize: 12, opacity: 0.6 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { display: "flex", justifyContent: "flex-end", marginBottom: 6 }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", onClick: toggleCollapsed, style: {
        fontSize: 11,
        padding: "2px 8px",
        borderRadius: 6,
        border: "1px solid rgba(128,128,128,0.45)",
        background: "transparent",
        color: "inherit",
        cursor: "pointer",
        opacity: 0.8
      }, children: "\u6536\u8D77\u4E3A\u80F6\u56CA" }) }),
      "\u6682\u65E0\u4EFB\u52A1\u3002\u6A21\u578B\u8C03\u7528 todo_write_plus \u540E\uFF0C\u6E05\u5355\u4F1A\u5B9E\u65F6\u51FA\u73B0\u5728\u8FD9\u91CC\u3002"
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { padding: "10px 14px 14px", fontFamily: "inherit" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontSize: 12,
      fontWeight: 600,
      opacity: 0.85,
      marginBottom: 10
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u4EFB\u52A1\u6E05\u5355" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontWeight: 400, opacity: 0.7 }, children: progressLabel }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { flex: 1 } }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", onClick: toggleCollapsed, title: "\u6536\u8D77\u4E3A\u80F6\u56CA", style: {
        fontSize: 11,
        padding: "2px 8px",
        borderRadius: 6,
        border: "1px solid rgba(128,128,128,0.45)",
        background: "transparent",
        color: "inherit",
        cursor: "pointer",
        opacity: 0.8
      }, children: "\u6536\u8D77\u4E3A\u80F6\u56CA" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { style: { listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }, children: todos.map((todo) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { style: { display: "flex", gap: 8, alignItems: "baseline", fontSize: 13, lineHeight: 1.5 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { "aria-hidden": true, style: {
        flex: "none",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: dotColor(todo.status),
        marginTop: 5,
        boxShadow: todo.status === "in_progress" ? "0 0 0 3px rgba(88,166,255,0.2)" : "none"
      } }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: {
        textDecoration: todo.status === "completed" ? "line-through" : "none",
        opacity: todo.status === "completed" ? 0.55 : todo.status === "pending" ? 0.75 : 1,
        wordBreak: "break-word"
      }, children: [
        todo.content,
        todo.priority ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
          marginLeft: 6,
          fontSize: 11,
          padding: "1px 5px",
          borderRadius: 4,
          border: "1px solid currentColor",
          opacity: 0.65,
          verticalAlign: "1px"
        }, children: todo.priority }) : null,
        todo.status === "in_progress" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { marginLeft: 6, fontSize: 11, opacity: 0.6, fontStyle: "italic" }, children: "\u8FDB\u884C\u4E2D" }) : null
      ] })
    ] }, todo.content)) })
  ] });
}
var sidebarRight;
function apply(ctx) {
  sidebarRight = ctx.sidebarRight;
  ctx.sidebarRightTabs.register({
    id: TAB_ID,
    kind: TAB_KIND,
    priority: "extension",
    title: () => "\u4EFB\u52A1\u6E05\u5355",
    keepMounted: true,
    // 引导页入口框：让本类型出现在右侧栏"新标签页"列表里。
    // 缺了这个字段，面板被关闭后用户在界面上找不到任何重开入口（实测踩过）。
    guide: [{
      id: TAB_ID,
      order: 100,
      title: () => "\u4EFB\u52A1\u6E05\u5355",
      description: () => "\u663E\u793A\u5F53\u524D\u4EFB\u52A1\u6E05\u5355\u4E0E\u8FDB\u5EA6"
    }]
  });
  ctx.slots.inject("sidebar.right.pane.tab", () => {
    ctx.slots.register({ name: "sidebar.right.pane.tab", key: TAB_ID }, TodoSidebarBody);
  });
  ctx.slots.inject("conversation.input.dock", () => {
    ctx.slots.register({ name: "conversation.input.dock", id: BRIDGE_ID, order: 50 }, TodoBridge);
  });
  ctx.slots.inject("conversation.session.header.actions", () => {
    ctx.slots.register({ name: "conversation.session.header.actions", id: HEADER_ACTION_ID, order: 50 }, TodoHeaderAction);
  });
}
var inject = ["slots", "sidebarRight", "sidebarRightTabs"];
return module.exports; } });
