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
var import_react_dom = require("react-dom");
var import_jsx_runtime = require("react/jsx-runtime");
var BRIDGE_ID = "todo-plus-bridge";
var HEADER_ACTION_ID = "todo-plus-header-action";
var todos = [];
var panelOpen = false;
var collapsed = false;
var listeners = /* @__PURE__ */ new Set();
function emit() {
  for (const listener of listeners) listener();
}
function setTodos(next) {
  const value = next ?? [];
  const changed = value.length !== todos.length || value.some((t, i) => t !== todos[i]);
  if (!changed) return;
  todos = value;
  if (value.length > 0) panelOpen = true;
  emit();
}
function setPanelOpen(open) {
  if (panelOpen === open) return;
  panelOpen = open;
  emit();
}
function setCollapsed(next) {
  if (collapsed === next) return;
  collapsed = next;
  emit();
}
var subscribe = (listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
function dotColor(status) {
  if (status === "completed") return "#3fb950";
  if (status === "in_progress") return "#58a6ff";
  return "#8b949e";
}
function capsuleSummary(items) {
  const current = items.find((t) => t.status === "in_progress");
  if (current !== void 0) return { icon: "\u2192", text: current.content, color: "#58a6ff" };
  let lastDone;
  for (const t of items) if (t.status === "completed") lastDone = t;
  if (lastDone !== void 0) return { icon: "\u2713", text: lastDone.content, color: "#3fb950" };
  if (items.length > 0) {
    const done = items.filter((t) => t.status === "completed").length;
    return { icon: "\u2630", text: `\u5F85\u529E ${done}/${items.length}` };
  }
  return null;
}
var smallButtonStyle = {
  fontSize: 11,
  padding: "2px 8px",
  borderRadius: "var(--dsw-radius-sm, 8px)",
  border: "1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.28))",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
  opacity: 0.8
};
function TodoBridge(props) {
  const value = props.useProjection?.("todos") ?? null;
  (0, import_react.useEffect)(() => {
    setTodos(value);
  }, [value]);
  return null;
}
function TodoHeaderAction(_props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "button",
    {
      type: "button",
      title: "\u4EFB\u52A1\u6E05\u5355",
      "aria-label": "\u4EFB\u52A1\u6E05\u5355",
      onClick: () => setPanelOpen(!panelOpen),
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 12,
        padding: "3px 9px",
        borderRadius: "var(--dsw-radius-sm, 8px)",
        border: "1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.28))",
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
function TodoCard() {
  const items = (0, import_react.useSyncExternalStore)(subscribe, () => todos, () => todos);
  const collapsedNow = (0, import_react.useSyncExternalStore)(subscribe, () => collapsed, () => collapsed);
  const completed = items.filter((t) => t.status === "completed").length;
  const inProgress = items.filter((t) => t.status === "in_progress").length;
  const header = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    fontWeight: 600,
    opacity: 0.85,
    marginBottom: collapsedNow ? 0 : 10
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u4EFB\u52A1\u6E05\u5355" }),
    !collapsedNow && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { fontWeight: 400, opacity: 0.7 }, children: [
      completed,
      "/",
      items.length,
      inProgress > 0 ? ` \xB7 ${inProgress} \u8FDB\u884C\u4E2D` : ""
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { flex: 1 } }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", onClick: () => setCollapsed(!collapsedNow), title: collapsedNow ? "\u5C55\u5F00\u72B6\u6001" : "\u6536\u8D77\u4E3A\u80F6\u56CA", style: smallButtonStyle, children: collapsedNow ? "\u5C55\u5F00\u72B6\u6001" : "\u6536\u8D77\u4E3A\u80F6\u56CA" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", onClick: () => setPanelOpen(false), title: "\u5173\u95ED", "aria-label": "\u5173\u95ED\u4EFB\u52A1\u6E05\u5355\u9762\u677F", style: smallButtonStyle, children: "\u2715" })
  ] });
  if (items.length === 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { padding: "10px 14px 12px" }, children: [
      header,
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 12, opacity: 0.6 }, children: "\u6682\u65E0\u4EFB\u52A1\u3002\u6A21\u578B\u8C03\u7528 todo_write_plus \u540E\uFF0C\u6E05\u5355\u4F1A\u5B9E\u65F6\u51FA\u73B0\u5728\u8FD9\u91CC\u3002" })
    ] });
  }
  if (collapsedNow) {
    const summary = capsuleSummary(items);
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { padding: "8px 10px" }, children: [
      header,
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "button",
        {
          type: "button",
          onClick: () => setCollapsed(false),
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
            border: "1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.28))",
            background: "transparent",
            color: "inherit",
            cursor: "pointer"
          },
          children: summary === null ? "\u4EFB\u52A1\u6E05\u5355" : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { "aria-hidden": true, style: { flex: "none", color: summary.color ?? "inherit", opacity: summary.color === void 0 ? 0.75 : 1 }, children: summary.icon }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: summary.text })
          ] })
        }
      )
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { padding: "10px 14px 14px", fontFamily: "inherit" }, children: [
    header,
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { style: { listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }, children: items.map((todo) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { style: { display: "flex", gap: 8, alignItems: "baseline", fontSize: 13, lineHeight: 1.5 }, children: [
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
function TodoOverlay() {
  const open = (0, import_react.useSyncExternalStore)(subscribe, () => panelOpen, () => panelOpen);
  const collapsedNow = (0, import_react.useSyncExternalStore)(subscribe, () => collapsed, () => collapsed);
  if (!open) return null;
  const width = collapsedNow ? 240 : 380;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
    position: "absolute",
    top: 68,
    right: 20,
    width,
    maxHeight: "calc(100vh - 140px)",
    overflowY: "auto",
    // 浮层材质复刻 dsh 原生菜单（实测其悬浮面板配方）：
    // 半透明表面 + blur(40px) 毛玻璃；描边不是 border，而是 boxShadow 里的
    // 0.5px 发丝环（暗色主题为白 16%）+ 两层 4%~5% 超柔投影；圆角取
    // --dsw-radius-lg(16px)。全部走宿主 token，亮暗主题自动跟随。
    background: "var(--dsw-menu-surface-fill, rgba(67, 69, 74, 0.45))",
    backdropFilter: "blur(40px) saturate(1.5)",
    WebkitBackdropFilter: "blur(40px) saturate(1.5)",
    boxShadow: "0 0 0 0.5px var(--dsw-alias-border-l3, rgba(255,255,255,0.16)), 0 3px 8px rgba(0,0,0,0.04), 0 0 20px rgba(0,0,0,0.05)",
    borderRadius: "var(--dsw-radius-lg, 16px)",
    color: "var(--dsw-alias-label-primary, #e6e6e6)",
    pointerEvents: "auto",
    transition: "width 240ms ease"
  }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TodoCard, {}) });
}
var overlayMounted = false;
function ensureOverlayRoot() {
  if (overlayMounted || typeof document === "undefined") return;
  const host = document.createElement("div");
  host.id = "dsh-todo-plus-overlay";
  host.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9999;";
  document.body.appendChild(host);
  (0, import_react_dom.createRoot)(host).render(/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TodoOverlay, {}));
  overlayMounted = true;
}
function apply(ctx) {
  ensureOverlayRoot();
  ctx.slots.inject("conversation.input.dock", () => {
    ctx.slots.register({ name: "conversation.input.dock", id: BRIDGE_ID, order: 50 }, TodoBridge);
  });
  ctx.slots.inject("conversation.session.header.actions", () => {
    ctx.slots.register({ name: "conversation.session.header.actions", id: HEADER_ACTION_ID, order: 50 }, TodoHeaderAction);
  });
}
var inject = ["slots"];
return module.exports; } });
