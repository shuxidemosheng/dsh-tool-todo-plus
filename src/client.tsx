/**
 * dsh-tool-todo-plus 客户端半：自绘浮动"任务清单"卡片（ZCode 计划面板风格）。
 *
 * 架构（刻意不使用右侧栏 tab 系统——openTab 会强制展开整个右侧栏，无法只开浮窗）：
 *
 *   conversation.input.dock 槽位（会话域，运行时提供 useProjection）
 *     └─ TodoBridge（隐形组件，渲染 null）：订阅 'todos' 投影 → 写入模块级 store
 *        └─ 清单内容变化时置 open=true
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

import { useSyncExternalStore, useEffect, useState } from 'react'
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

// —— 模块级共享状态：清单 + 面板开关 + 形态 ——
// 纪律：这三个变量是 useSyncExternalStore 的快照源，只在 emit() 前后成对更新；
// "内容没变就提前 return"必须发生在赋值之前，否则 React 会在下次渲染时发现
// 快照变了却没收到通知（getSnapshot 缓存被破坏）。
let todos: readonly TodoItem[] = []
let panelOpen = false
let collapsed = false
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

function setTodos(next: readonly TodoItem[] | null | undefined): void {
  const value = next ?? []
  const changed = value.length !== todos.length || value.some((t, i) => t !== todos[i])
  if (!changed) return
  todos = value
  // 面板联动规则：每次清单内容变化都确保面板打开（关了就重开）；空清单不强制打开。
  if (value.length > 0) panelOpen = true
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
 * 渲染 null，在 dock 通栏里不可见（官方 TodoPanel 空清单时也返回 null，同机制）。
 */
function TodoBridge(props: {
  useProjection?: (key: 'todos') => readonly TodoItem[] | null
}): ReactElement | null {
  const value = props.useProjection?.('todos') ?? null
  useEffect(() => { setTodos(value) }, [value])
  return null
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

/** 浮动卡片容器：fixed 定位，pointer-events 只落在卡片上，不挡页面其余部分。 */
function TodoOverlay(): ReactElement | null {
  const open = useSyncExternalStore(subscribe, () => panelOpen, () => panelOpen)
  // 订阅 collapsed：宽度随形态即时切换（240 胶囊 / 380 展开）；清单本体由 TodoCard 自行订阅
  const collapsedNow = useSyncExternalStore(subscribe, () => collapsed, () => collapsed)
  if (!open) return null
  const width = collapsedNow ? 240 : 380
  return (
    <div style={{
      position: 'absolute', top: 68, right: 20, width,
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
