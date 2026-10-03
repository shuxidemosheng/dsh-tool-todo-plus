/**
 * dsh-tool-todo-plus 客户端半：自绘浮动"任务清单"卡片（ZCode 计划面板风格）。
 *
 * 架构（刻意不使用右侧栏 tab 系统——openTab 会强制展开整个右侧栏，无法只开浮窗）：
 *
 *   conversation.input.dock 槽位（会话域，运行时提供 useProjection）
 *     └─ TodoBridge（隐形组件，渲染 null）：订阅 'todos' 投影 → 写入模块级 store
 *        ├─ 挂载边界 = 会话界面边界：浮窗只在会话页显示
 *        └─ 会话边界后短窗口内的投影同步视为历史注水（不弹开），之后的才是实时写入
 *
 *   独立 React 根（createRoot 挂到 body 下的容器 div，与槽位渲染树完全分离）
 *     └─ TodoOverlay：position:fixed 浮动卡片，useSyncExternalStore 读 store
 *        ├─ 展开态：完整清单（状态点/划线/优先级徽章/进度计数）
 *        └─ 胶囊态：当前进行中项摘要（ZCode ConversationStatusPanel 的优先级链）
 *
 *   conversation.session.header.actions 槽位
 *     └─ TodoHeaderAction 按钮：开关浮动卡片（面板关闭后的手动入口）
 *
 * 构建约束：产物是懒 CJS 工厂（平台模块表解析 react/react-dom），两者必须
 * external；其余一律 inline styles，避免任何平台表之外的模块请求。
 *
 * @module dsh-tool-todo-plus/client
 */

import { useSyncExternalStore, useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { createRoot } from 'react-dom'
import type { TodoItem } from './types.js'

// @types/react-dom 只在 'react-dom/client' 子路径声明 createRoot，而平台模块表
// 只提供 'react-dom' 主入口（运行时主入口确实导出 createRoot）。声明合并让主
// 入口导入通过类型检查；运行时代码不变。
declare module 'react-dom' {
  export function createRoot(container: Element | DocumentFragment): {
    render(node: ReactNode): void
    unmount(): void
  }
}

// —— 客户端 ctx 的最小本地类型 ——
interface ClientCtx {
  slots: {
    inject(slot: string, register: () => void): void
    register(def: { name: string; id?: string; key?: string; order?: number }, component: unknown): () => void
  }
  logger: { warn(...args: unknown[]): void }
}

// —— 桥组件在 conversation.input.dock 里的注册条目 id ——
const BRIDGE_ID = 'todo-plus-bridge'
// —— 会话标题栏按钮的注册条目 id ——
const HEADER_ACTION_ID = 'todo-plus-header-action'
// —— 桥组件渲染的零尺寸锚点元素 id（浮窗水平定位参照）——
const ANCHOR_ID = 'dsh-todo-plus-anchor'

// —— 模块级共享状态：清单 + 面板开关 + 形态 + 会话视图在位标记 ——
// 纪律：这些变量是 useSyncExternalStore 的快照源，只在 emit() 前后成对更新；
// "内容没变就提前 return"必须发生在赋值之前，否则 React 会在下次渲染时发现
// 快照变了却没收到通知（getSnapshot 缓存被破坏）。
let todos: readonly TodoItem[] = []
let panelOpen = false
let collapsed = false
// 桥组件（TodoBridge）只挂载在会话视图里：它挂载 ⇔ 当前处于会话界面。
// 浮窗据此限定显示范围，不跟到插件页等其他界面。
let conversationActive = false
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

function setTodos(next: readonly TodoItem[] | null | undefined, opts?: { autoOpen?: boolean }): void {
  const value = next ?? []
  const changed = value.length !== todos.length || value.some((t, i) => t !== todos[i])
  if (!changed) return
  todos = value
  // 面板联动规则：模型的实时清单写入确保面板打开（关了就重开）；空清单不打开。
  // 投影"注水"（重进会话/切换会话时的首次历史同步）autoOpen=false——用户关了就保持关着。
  if (value.length > 0 && (opts?.autoOpen ?? true)) panelOpen = true
  emit()
}

function setPanelOpen(open: boolean): void {
  if (panelOpen === open) return
  panelOpen = open
  emit()
}

function setCollapsed(next: boolean): void {
  if (collapsed === next) return
  collapsed = next
  emit()
}

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

// —— 展示辅助 ——

/** 单条任务的状态点颜色（沿用内置面板的 done/ongoing/idle 语义） */
function dotColor(status: TodoItem['status']): string {
  if (status === 'completed') return '#3fb950'
  if (status === 'in_progress') return '#58a6ff'
  return '#8b949e'
}

/**
 * 胶囊摘要内容——移植 ZCode `ConversationStatusPanel` 的胶囊优先级链中与
 * 任务清单相关的三档：
 *   1. 进行中项（箭头，最高优先——ZCode 胶囊默认展示的形态）
 *   2. 最近完成项（绿对勾）
 *   3. 待办计数（清单图标 + 完成数/总数）
 */
function capsuleSummary(items: readonly TodoItem[]): { icon: string; text: string; color?: string } | null {
  const current = items.find(t => t.status === 'in_progress')
  if (current !== undefined) return { icon: '→', text: current.content, color: '#58a6ff' }
  let lastDone: TodoItem | undefined
  for (const t of items) if (t.status === 'completed') lastDone = t
  if (lastDone !== undefined) return { icon: '✓', text: lastDone.content, color: '#3fb950' }
  if (items.length > 0) {
    const done = items.filter(t => t.status === 'completed').length
    return { icon: '☰', text: `待办 ${done}/${items.length}` }
  }
  return null
}

const smallButtonStyle: CSSProperties = {
  fontSize: 11, padding: '2px 8px', borderRadius: 'var(--dsw-radius-sm, 8px)',
  border: '1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.28))', background: 'transparent',
  color: 'inherit', cursor: 'pointer', opacity: 0.8,
}

/**
 * 隐形桥组件：订阅 'todos' 投影 → 写入模块级 store。
 * 渲染一个零尺寸标记（视觉上不可见，官方 TodoPanel 空清单时也返回 null，同机制），
 * 兼作浮窗的水平定位锚点。
 *
 * 桥的挂载边界有三个用途：
 *   1. 会话范围：挂载 ⇔ 处于会话界面 → conversationActive 控制浮窗只在会话里显示；
 *   2. 注水判别：会话边界（挂载或 sessionId 变化）后的短时间内，投影会把会话里
 *      已有的清单分多次同步进来（实测不止一次发射），这些一律视为"历史注水"，
 *      只写数据不自动弹开；边界窗口之后的投影变化才是模型实时写入，才触发弹出。
 *
 * 已知局限：若单个会话的历史恢复耗时超过窗口期，尾部仍会被当成实时写入而弹开
 * （代价：用户手动关一次）；换来的确定性是窗口期后的实时写入总能正常弹出。
 */
const HYDRATION_WINDOW_MS = 2000

function TodoBridge(props: {
  useProjection?: (key: 'todos') => readonly TodoItem[] | null
  sessionId?: string | number
}): ReactElement {
  const value = props.useProjection?.('todos') ?? null
  const boundaryAt = useRef(0)
  useEffect(() => {
    // 会话边界：挂载和 sessionId 变化都会重置注水窗口
    boundaryAt.current = performance.now()
  }, [props.sessionId])
  useEffect(() => {
    conversationActive = true
    emit()
    return () => {
      conversationActive = false
      emit()
    }
  }, [])
  useEffect(() => {
    const live = performance.now() - boundaryAt.current > HYDRATION_WINDOW_MS
    setTodos(value, { autoOpen: live })
  }, [value])
  // 零尺寸标记：它挂在会话输入区（dock 槽位）里，浮窗用它做水平锚点——
  // 面板贴着对话内容列的右缘，而不是窗口右缘（窗口宽时避免落到内容区外的空白带）。
  return <span id={ANCHOR_ID} aria-hidden style={{ position: 'absolute', width: 0, height: 0 }} />
}

/** 会话标题栏的"任务清单"按钮：开关浮动卡片（面板被关闭后的手动入口）。 */
function TodoHeaderAction(_props: unknown): ReactElement {
  return (
    <button
      type="button"
      title="任务清单"
      aria-label="任务清单"
      onClick={() => setPanelOpen(!panelOpen)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: 12, padding: '3px 9px', borderRadius: 'var(--dsw-radius-sm, 8px)',
        border: '1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.28))', background: 'transparent',
        color: 'inherit', cursor: 'pointer', opacity: 0.85,
      }}
    >
      <span aria-hidden>☰</span>
      任务清单
    </button>
  )
}

/** 浮动卡片本体：展开态 = 清单卡片；胶囊态 = 当前任务摘要药丸。 */
function TodoCard(): ReactElement {
  const items = useSyncExternalStore(subscribe, () => todos, () => todos)
  // collapsed 也是快照源：不订阅的话，收起/展开按钮点了 emit 也不会触发本组件重渲染
  const collapsedNow = useSyncExternalStore(subscribe, () => collapsed, () => collapsed)
  const completed = items.filter(t => t.status === 'completed').length
  const inProgress = items.filter(t => t.status === 'in_progress').length

  const header = (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      fontSize: 12, fontWeight: 600, opacity: 0.85, marginBottom: collapsedNow ? 0 : 10,
    }}>
      <span>任务清单</span>
      {!collapsedNow && (
        <span style={{ fontWeight: 400, opacity: 0.7 }}>
          {completed}/{items.length}{inProgress > 0 ? ` · ${inProgress} 进行中` : ''}
        </span>
      )}
      <span style={{ flex: 1 }} />
      <button type="button" onClick={() => setCollapsed(!collapsedNow)} title={collapsedNow ? '展开状态' : '收起为胶囊'} style={smallButtonStyle}>
        {collapsedNow ? '展开状态' : '收起为胶囊'}
      </button>
      <button type="button" onClick={() => setPanelOpen(false)} title="关闭" aria-label="关闭任务清单面板" style={smallButtonStyle}>
        ✕
      </button>
    </div>
  )

  if (items.length === 0) {
    return (
      <div style={{ padding: '10px 14px 12px' }}>
        {header}
        <div style={{ fontSize: 12, opacity: 0.6 }}>
          暂无任务。模型调用 todo_write_plus 后，清单会实时出现在这里。
        </div>
      </div>
    )
  }

  if (collapsedNow) {
    // 胶囊：ZCode 优先级链——进行中项 → 最近完成项 → 待办计数
    const summary = capsuleSummary(items)
    return (
      <div style={{ padding: '8px 10px' }}>
        {header}
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          title="展开状态"
          aria-label="展开状态"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            maxWidth: '100%', fontSize: 12, padding: '5px 12px', borderRadius: 999,
            border: '1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.28))', background: 'transparent',
            color: 'inherit', cursor: 'pointer',
          }}
        >
          {summary === null ? '任务清单' : (
            <>
              <span aria-hidden style={{ flex: 'none', color: summary.color ?? 'inherit', opacity: summary.color === undefined ? 0.75 : 1 }}>
                {summary.icon}
              </span>
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {summary.text}
              </span>
            </>
          )}
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '10px 14px 14px', fontFamily: 'inherit' }}>
      {header}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
        {items.map(todo => (
          <li key={todo.content} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 13, lineHeight: 1.5 }}>
            <span aria-hidden style={{
              flex: 'none', width: 8, height: 8, borderRadius: '50%',
              background: dotColor(todo.status), marginTop: 5,
              boxShadow: todo.status === 'in_progress' ? '0 0 0 3px rgba(88,166,255,0.2)' : 'none',
            }} />
            <span style={{
              textDecoration: todo.status === 'completed' ? 'line-through' : 'none',
              opacity: todo.status === 'completed' ? 0.55 : todo.status === 'pending' ? 0.75 : 1,
              wordBreak: 'break-word',
            }}>
              {todo.content}
              {todo.priority ? (
                <span style={{
                  marginLeft: 6, fontSize: 11, padding: '1px 5px', borderRadius: 4,
                  border: '1px solid currentColor', opacity: 0.65, verticalAlign: '1px',
                }}>
                  {todo.priority}
                </span>
              ) : null}
              {todo.status === 'in_progress' ? (
                <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.6, fontStyle: 'italic' }}>
                  进行中
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * 浮窗水平锚点的右缘 x 坐标：从零尺寸标记向上找第一个有实质宽度（≥500px）的
 * 祖先——即对话内容列（composer stack）。不能直接用标记自身：它在 dock 容器的
 * 左缘（零尺寸），right=left。找不到（理论上仅会话视图外）返回 NaN。
 */
function anchorRightEdge(): number {
  let el: HTMLElement | null = document.getElementById(ANCHOR_ID)
  while (el && el !== document.body) {
    const rect = el.getBoundingClientRect()
    if (rect.width >= 500) return rect.right
    el = el.parentElement
  }
  return NaN
}

/** 浮动卡片容器：fixed 定位，pointer-events 只落在卡片上，不挡页面其余部分。 */
function TodoOverlay(): ReactElement | null {
  const open = useSyncExternalStore(subscribe, () => panelOpen, () => panelOpen)
  // 只在会话界面显示：桥组件卸载（去了插件页等）时 conversationActive=false，浮窗隐藏
  const active = useSyncExternalStore(subscribe, () => conversationActive, () => conversationActive)
  // 订阅 collapsed：宽度随形态即时切换（240 胶囊 / 380 展开）；清单本体由 TodoCard 自行订阅
  const collapsedNow = useSyncExternalStore(subscribe, () => collapsed, () => collapsed)
  // 窗口尺寸变化时锚点位置会变，强制重算一次
  const [, resizeTick] = useState(0)
  useEffect(() => {
    const onResize = () => resizeTick(n => n + 1)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  if (!open || !active) return null
  const width = collapsedNow ? 240 : 380
  // 水平锚定对话内容列的右缘：面板贴着对话列（同 ZCode 的面板在窗格内的观感），
  // 而不是窗口右缘（窗口宽时会落到内容区外的空白带）。锚点缺失时回退窗口右缘 20px。
  const anchorRight = anchorRightEdge()
  const anchored = Number.isFinite(anchorRight)
  const left = anchored
    ? Math.max(12, Math.min(anchorRight - width, window.innerWidth - width - 12))
    : NaN
  return (
    <div style={{
      position: 'absolute', top: 68, width,
      left: anchored ? left : undefined,
      right: anchored ? undefined : 20,
      maxHeight: 'calc(100vh - 140px)', overflowY: 'auto',
      // 浮层材质复刻 dsh 原生菜单（实测其悬浮面板配方）：
      // 半透明表面 + blur(40px) 毛玻璃；描边不是 border，而是 boxShadow 里的
      // 0.5px 发丝环（暗色主题为白 16%）+ 两层 4%~5% 超柔投影；圆角取
      // --dsw-radius-lg(16px)。全部走宿主 token，亮暗主题自动跟随。
      background: 'var(--dsw-menu-surface-fill, rgba(67, 69, 74, 0.45))',
      backdropFilter: 'blur(40px) saturate(1.5)',
      WebkitBackdropFilter: 'blur(40px) saturate(1.5)',
      boxShadow: '0 0 0 0.5px var(--dsw-alias-border-l3, rgba(255,255,255,0.16)), 0 3px 8px rgba(0,0,0,0.04), 0 0 20px rgba(0,0,0,0.05)',
      borderRadius: 'var(--dsw-radius-lg, 16px)',
      color: 'var(--dsw-alias-label-primary, #e6e6e6)',
      pointerEvents: 'auto',
      transition: 'width 240ms ease',
    }}>
      <TodoCard />
    </div>
  )
}

// —— 独立 React 根的挂载（与槽位渲染树完全分离）——
let overlayMounted = false

function ensureOverlayRoot(): void {
  if (overlayMounted || typeof document === 'undefined') return
  const host = document.createElement('div')
  host.id = 'dsh-todo-plus-overlay'
  // 容器不拦截任何事件；只有卡片本体（pointerEvents:auto）可交互
  host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;'
  document.body.appendChild(host)
  createRoot(host).render(<TodoOverlay />)
  overlayMounted = true
}

/**
 * 客户端半插件入口。由客户端模块系统在物化时调用（懒 CJS 工厂）。
 * 只导出命名成员（apply/inject），绝不加 export default——
 * Loader 的 unwrapExports 会折叠模块并丢弃 inject（官方 postmortem 0001）。
 */
export function apply(ctx: ClientCtx): void {
  // 独立浮窗的 React 根（document 就绪后挂载）
  ensureOverlayRoot()

  // 数据桥：dock 槽位（有 useProjection）订阅投影，喂给模块级 store
  ctx.slots.inject('conversation.input.dock', () => {
    ctx.slots.register({ name: 'conversation.input.dock', id: BRIDGE_ID, order: 50 }, TodoBridge)
  })

  // 会话标题栏按钮：手动开关浮窗
  ctx.slots.inject('conversation.session.header.actions', () => {
    ctx.slots.register({ name: 'conversation.session.header.actions', id: HEADER_ACTION_ID, order: 50 }, TodoHeaderAction)
  })
}

export const inject = ['slots']
