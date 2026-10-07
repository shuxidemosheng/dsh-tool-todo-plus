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
var ANCHOR_ID = "dsh-todo-plus-anchor";
var todos = [];
var panelOpen = false;
var collapsed = false;
var conversationActive = false;
var listStale = false;
var currentAction = "";
var POS_STORAGE_KEY = "dsh-todo-plus.panelPos";
var PANEL_WIDTH_COLLAPSED = 240;
var PANEL_WIDTH_EXPANDED = 380;
var panelPos = loadPanelPos();
var listeners = /* @__PURE__ */ new Set();
function loadPanelPos() {
  try {
    const raw = localStorage.getItem(POS_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (typeof p?.x === "number" && typeof p?.y === "number") return { x: p.x, y: p.y };
  } catch {
  }
  return null;
}
function savePanelPos() {
  try {
    if (panelPos) localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(panelPos));
    else localStorage.removeItem(POS_STORAGE_KEY);
  } catch {
  }
}
function clampPos(x, y, width) {
  const maxX = Math.max(8, window.innerWidth - width - 8);
  const maxY = Math.max(8, window.innerHeight - 60);
  return { x: Math.min(Math.max(8, x), maxX), y: Math.min(Math.max(8, y), maxY) };
}
function setPanelPos(pos, persist = false) {
  const changed = pos === null !== (panelPos === null) || pos !== null && panelPos !== null && (pos.x !== panelPos.x || pos.y !== panelPos.y);
  panelPos = pos;
  if (persist) savePanelPos();
  if (changed) emit();
}
function emit() {
  for (const listener of listeners) listener();
}
function setCurrentAction(action) {
  if (currentAction === action) return;
  currentAction = action;
  emit();
}
function setTodos(next, opts) {
  const value = next ?? [];
  if (next === null && (opts?.prev?.length ?? 0) > 0 && todos.length > 0) {
    if (!listStale) {
      listStale = true;
      emit();
    }
    return;
  }
  const changed = value.length !== todos.length || value.some((t, i) => t !== todos[i]);
  if (!changed && !listStale) return;
  todos = value;
  listStale = false;
  if (value.length > 0 && (opts?.autoOpen ?? true)) panelOpen = true;
  emit();
}
function resetSessionScope() {
  listStale = false;
  if (todos.length > 0) {
    todos = [];
    emit();
  }
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
var HYDRATION_WINDOW_MS = 2e3;
function deriveCurrentAction(s) {
  const nodes = s?.legacy?.nodes ?? s?.nodes;
  if (!nodes) return "";
  const vals = Object.values(nodes);
  const done = /* @__PURE__ */ new Set();
  let pending = null;
  for (let i = vals.length - 1; i >= 0 && i >= vals.length - 80; i--) {
    const n = vals[i];
    if (n?.kind === "tool-result" && n.callId !== void 0) {
      done.add(String(n.callId));
      if (pending) break;
    } else if (n?.kind === "assistant" && Array.isArray(n?.blocks)) {
      for (let j = n.blocks.length - 1; j >= 0; j--) {
        const b = n.blocks[j];
        const call = b?.call ?? (b?.callId ? b : null);
        if (call?.name && call.callId !== void 0) {
          if (!done.has(String(call.callId))) {
            pending = call;
            break;
          }
        }
      }
      if (pending) break;
    }
  }
  if (!pending?.name) return "";
  const name = String(pending.name);
  let detail = "";
  try {
    const a = JSON.parse(pending.argsRaw ?? "{}");
    detail = String(a.description ?? a.command ?? a.path ?? a.file_path ?? a.pattern ?? a.query ?? "").replace(/\s+/g, " ").slice(0, 44);
  } catch {
  }
  return detail ? `${name} \xB7 ${detail}` : name;
}
function TodoBridge(props) {
  const value = props.useProjection?.("todos") ?? null;
  const boundaryAt = (0, import_react.useRef)(0);
  const prevValue = (0, import_react.useRef)(null);
  const running = props.useSession?.((s) => !!s?.running);
  const chatAction = props.useChat?.((s) => deriveCurrentAction(s)) ?? "";
  (0, import_react.useEffect)(() => {
    boundaryAt.current = performance.now();
    resetSessionScope();
  }, [props.sessionId]);
  (0, import_react.useEffect)(() => {
    conversationActive = true;
    emit();
    return () => {
      conversationActive = false;
      emit();
    };
  }, []);
  (0, import_react.useEffect)(() => {
    const live = performance.now() - boundaryAt.current > HYDRATION_WINDOW_MS;
    setTodos(value, { autoOpen: live, prev: prevValue.current });
    prevValue.current = value;
  }, [value]);
  (0, import_react.useEffect)(() => {
    setCurrentAction(chatAction || (running ? "\u6267\u884C\u4E2D\u2026" : ""));
  }, [chatAction, running]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { id: ANCHOR_ID, "aria-hidden": true, style: { position: "absolute", width: 0, height: 0 } });
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
function TodoCard(props) {
  const items = (0, import_react.useSyncExternalStore)(subscribe, () => todos, () => todos);
  const collapsedNow = (0, import_react.useSyncExternalStore)(subscribe, () => collapsed, () => collapsed);
  const stale = (0, import_react.useSyncExternalStore)(subscribe, () => listStale, () => listStale);
  const action = (0, import_react.useSyncExternalStore)(subscribe, () => currentAction, () => currentAction);
  const completed = items.filter((t) => t.status === "completed").length;
  const inProgress = items.filter((t) => t.status === "in_progress").length;
  const widthNow = collapsedNow ? PANEL_WIDTH_COLLAPSED : PANEL_WIDTH_EXPANDED;
  const dragRef = (0, import_react.useRef)(null);
  const onHeaderPointerDown = (e) => {
    if (e.button !== 0 || e.target.closest("button")) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: props.panelPos.x, origY: props.panelPos.y };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
    }
  };
  const onHeaderPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    setPanelPos(clampPos(d.origX + e.clientX - d.startX, d.origY + e.clientY - d.startY, widthNow));
  };
  const onHeaderPointerUp = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    savePanelPos();
  };
  const onHeaderDoubleClick = (e) => {
    if (e.target.closest("button")) return;
    setPanelPos(null, true);
  };
  const actionLine = action ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 6, fontSize: 11, opacity: 0.6, minHeight: 16 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { "aria-hidden": true, children: "\u2699" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: action })
  ] }) : null;
  const header = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      onPointerDown: onHeaderPointerDown,
      onPointerMove: onHeaderPointerMove,
      onPointerUp: onHeaderPointerUp,
      onPointerCancel: onHeaderPointerUp,
      onDoubleClick: onHeaderDoubleClick,
      title: "\u62D6\u52A8\u79FB\u52A8\u9762\u677F\uFF1B\u53CC\u51FB\u590D\u4F4D\u5230\u9ED8\u8BA4\u4F4D\u7F6E",
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 12,
        fontWeight: 600,
        opacity: 0.85,
        marginBottom: collapsedNow ? 0 : 10,
        cursor: "grab",
        touchAction: "none",
        userSelect: "none"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u4EFB\u52A1\u6E05\u5355" }),
        stale && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { title: "\u65B0\u4E00\u8F6E\u5F00\u59CB\uFF0C\u7B49\u5F85\u6A21\u578B\u66F4\u65B0\u6E05\u5355", style: {
          fontWeight: 400,
          fontSize: 10,
          padding: "1px 6px",
          borderRadius: 999,
          border: "1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.28))",
          opacity: 0.7
        }, children: "\u4E0A\u4E00\u8F6E" }),
        !collapsedNow && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { fontWeight: 400, opacity: 0.7 }, children: [
          completed,
          "/",
          items.length,
          inProgress > 0 ? ` \xB7 ${inProgress} \u8FDB\u884C\u4E2D` : ""
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { flex: 1 } }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", onClick: () => setCollapsed(!collapsedNow), title: collapsedNow ? "\u5C55\u5F00\u72B6\u6001" : "\u6536\u8D77\u4E3A\u80F6\u56CA", style: smallButtonStyle, children: collapsedNow ? "\u5C55\u5F00\u72B6\u6001" : "\u6536\u8D77\u4E3A\u80F6\u56CA" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", onClick: () => setPanelOpen(false), title: "\u5173\u95ED", "aria-label": "\u5173\u95ED\u4EFB\u52A1\u6E05\u5355\u9762\u677F", style: smallButtonStyle, children: "\u2715" })
      ]
    }
  );
  if (items.length === 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { padding: "10px 14px 12px" }, children: [
      header,
      actionLine,
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 12, opacity: 0.6, marginTop: actionLine ? 6 : 0 }, children: "\u6682\u65E0\u4EFB\u52A1\u3002\u6A21\u578B\u8C03\u7528 todo_write_plus \u540E\uFF0C\u6E05\u5355\u4F1A\u5B9E\u65F6\u51FA\u73B0\u5728\u8FD9\u91CC\u3002" })
    ] });
  }
  if (collapsedNow) {
    const summary = capsuleSummary(items);
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { padding: "8px 10px" }, children: [
      header,
      actionLine,
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
            cursor: "pointer",
            opacity: stale ? 0.6 : void 0
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
    actionLine,
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { style: { listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8, opacity: stale ? 0.6 : void 0 }, children: items.map((todo) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { style: { display: "flex", gap: 8, alignItems: "baseline", fontSize: 13, lineHeight: 1.5 }, children: [
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
function anchorRightEdge() {
  let el = document.getElementById(ANCHOR_ID);
  while (el && el !== document.body) {
    const rect = el.getBoundingClientRect();
    if (rect.width >= 500) return rect.right;
    el = el.parentElement;
  }
  return NaN;
}
function TodoOverlay() {
  const open = (0, import_react.useSyncExternalStore)(subscribe, () => panelOpen, () => panelOpen);
  const active = (0, import_react.useSyncExternalStore)(subscribe, () => conversationActive, () => conversationActive);
  const collapsedNow = (0, import_react.useSyncExternalStore)(subscribe, () => collapsed, () => collapsed);
  const posNow = (0, import_react.useSyncExternalStore)(subscribe, () => panelPos, () => panelPos);
  const [, resizeTick] = (0, import_react.useState)(0);
  (0, import_react.useEffect)(() => {
    const onResize = () => resizeTick((n) => n + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  if (!open || !active) return null;
  const width = collapsedNow ? PANEL_WIDTH_COLLAPSED : PANEL_WIDTH_EXPANDED;
  const freePos = posNow ? clampPos(posNow.x, posNow.y, width) : null;
  const anchorRight = freePos ? NaN : anchorRightEdge();
  const anchored = !freePos && Number.isFinite(anchorRight);
  const anchoredLeft = anchored ? Math.max(12, Math.min(anchorRight - width, window.innerWidth - width - 12)) : NaN;
  const defaultTop = 100;
  const effPos = freePos ? { x: freePos.x, y: freePos.y } : anchored ? { x: anchoredLeft, y: defaultTop } : { x: window.innerWidth - width - 20, y: defaultTop };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
    position: "absolute",
    top: effPos.y,
    width,
    left: effPos.x,
    maxHeight: "calc(100vh - 180px)",
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
  }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TodoCard, { panelPos: effPos }) });
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
