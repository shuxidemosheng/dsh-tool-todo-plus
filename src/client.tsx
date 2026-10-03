/**
 * dsh-tool-todo-plus 客户端半：浮动"任务清单"小窗（ZCode 计划面板风格）。
 *
 * 架构（全部走公开槽位机制，不碰客户端内部）：
 *
 *   conversation.input.dock 槽位（会话域，运行时提供 useProjection）
 *     └─ TodoBridge（隐形组件，渲染 null）：订阅 'todos' 投影 → 写入模块级 store
 *        └─ 每次清单写入（非空）都 openTab——幂等：面板开着就聚焦，关了就重开
 *
 *   sidebar.right.pane.tab 槽位（keyed，运行时平铺注入 useTabInfo）
 *     └─ TodoSidebarBody：useSyncExternalStore 读 store → 渲染清单
 *        └─ 挂载时自举 float（真实 tab 记录 id 只有这里拿得到）
 *        └─ 收起为胶囊 / 展开状态：dock(panelId) → float(tabId, 新 rect) 重设浮窗尺寸
 *
 * 为什么需要桥：两个槽位的运行时注入物不同——dock 有投影 hook，tab 没有。
 *
 * 构建约束：产物是懒 CJS 工厂（平台模块表解析 react），react 必须 external；
 * 其余一律 inline styles，避免任何平台表之外的模块请求。
 *
 * @module dsh-tool-todo-plus/client
 */

import { useSyncExternalStore, useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import type { TodoItem } from './types.js'

// —— 客户端 ctx 的最小本地类型 ——
// 刻意不 import 官方 client 包的类型（那些是平台外模块，只会引入 external 声明负担）；
// 这里的形状按 ui-conversation / ui-sidebar-right 的公开契约手写，运行时由平台装配。
interface SidebarRightTabDef {
  id: string
  kind: string
  priority?: string
  title?: (address?: string) => string
  keepMounted?: boolean
  patterns?: string[]
  /**
   * "新标签页"引导页上的入口框。**省略则本类型完全不出现在引导页**
   * （官方契约原文："Entry boxes for the guide page. Omit to stay off it."）——
   * 面板被关闭后这就是用户手动重开的入口之一。
   */
  guide?: readonly {
    id: string
    order: number
    title: () => string
    description?: () => string
  }[]
}
interface ClientCtx {
  sidebarRightTabs: { register(def: SidebarRightTabDef): () => void }
  slots: {
    /** 延迟注册：槽位就绪后回调一次，回调里做 slots.register */
    inject(slot: string, register: () => void): void
    register(def: { name: string; id?: string; key?: string; order?: number }, component: unknown): () => void
  }
  sidebarRight: {
    openTab(kind: string, options?: Record<string, unknown>): unknown
    /** 把 tab 移到浮动宿主（ZCode 式小浮窗）；rect 缺省时按级联位置放置 */
    float(tabId: string, rect?: { x: number; y: number; width: number; height: number }): void
    /** 把浮动 pane 收回停靠宿主 */
    dock(paneId: string): void
  }
  logger: { warn(...args: unknown[]): void }
}

const TAB_ID = 'dsh-tool-todo-plus'
const TAB_KIND = 'todo-plus'

// —— 跨槽位共享的任务清单 store（模块级，页面生命周期）——
let snapshot: readonly TodoItem[] = []
const listeners = new Set<() => void>()

function setTodos(next: readonly TodoItem[] | null | undefined): void {
  const value = next ?? []
  if (value === snapshot) return
  snapshot = value
  for (const listener of listeners) listener()
}

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
const getSnapshot = (): readonly TodoItem[] => snapshot

// —— 桥组件在 conversation.input.dock 里的注册条目 id ——
// order 取 50：官方 TodoPanel 用 0，我们排它后面（虽然渲染 null，不可见）
const BRIDGE_ID = 'todo-plus-bridge'

// —— 会话标题栏按钮的注册条目 id ——
// 面板被关闭后的一键重开入口（比"新标签页 → 引导页"更直接）
const HEADER_ACTION_ID = 'todo-plus-header-action'

// 浮窗尺寸：展开态 = ZCode 计划面板量级；胶囊态 = 小药丸窗口
const FLOAT_WIDTH = 380
const FLOAT_HEIGHT = 520
// 胶囊尺寸对齐 ZCode 的 max-w-80（20rem = 320px）量级
const CAPSULE_WIDTH = 300
const CAPSULE_HEIGHT = 120

/** 已浮动过的 tab 记录 id（每个 tab 实例只自举 float 一次） */
const floatedTabs = new Set<string>()

/** 计算展开/胶囊的浮窗矩形（贴右侧、标题栏下方，随视口收敛） */
function floatRect(width: number, height: number): { x: number; y: number; width: number; height: number } {
  const w = Math.min(width, Math.max(200, window.innerWidth - 48))
  const h = Math.min(height, Math.max(90, window.innerHeight - 120))
  return { x: Math.max(12, window.innerWidth - w - 20), y: 68, width: w, height: h }
}

/**
 * 把 tab 放到浮动宿主并设置尺寸（展开态 / 胶囊态共用）。
 *
 * 关键语义：已浮动的 tab 再次调用 float() 会被静默忽略——控制器只校验目标是
 * 不是 dock 宿主，不报错也不改尺寸（实测确认）。所以先无条件 dock(paneId)：
 * 对已停靠的 pane 它是 no-op（首挂载时安全），对浮动 pane 它把 tab 收回停靠宿主，
 * 随后 float(tabId, rect) 就能以新矩形重新浮出。
 */
function floatPanelIn(ctx: ClientCtx, tabId: string, paneId: string | undefined, width: number, height: number): void {
  const rect = floatRect(width, height)
  if (paneId !== undefined) {
    try {
      ctx.sidebarRight.dock(paneId)
    } catch {
      // dock 未生效时仍尝试 float，保持当前形态
    }
  }
  try {
    ctx.sidebarRight.float(tabId, rect)
  } catch {
    // 保持当前形态
  }
}

/**
 * 隐形桥组件：订阅 'todos' 投影 → 写 store；每次清单写入（非空）都确保面板打开。
 * 渲染 null，在 dock 通栏里不可见（官方 TodoPanel 空清单时也返回 null，同机制）。
 */
function TodoBridge(props: {
  /** dock 槽位运行时注入的投影订阅 hook（形状对齐内置 TodoDock 的用法） */
  useProjection?: (key: 'todos') => readonly TodoItem[] | null
}): ReactElement | null {
  const todos = props.useProjection?.('todos') ?? null

  useEffect(() => { setTodos(todos) }, [todos])

  // 内容签名：投影 hook 可能在每次渲染都返回新数组引用，直接以数组做依赖会导致
  // 任意重渲染都触发 openTab（用户关掉面板后立刻被强行弹回）。用序列化签名比对，
  // 只在清单内容真正变化时确保面板打开——面板已开则聚焦，已关则重开。
  const signature = todos === null || todos.length === 0 ? '' : JSON.stringify(todos)
  const lastSignature = useRef('')
  useEffect(() => {
    if (signature === '' || signature === lastSignature.current) return
    lastSignature.current = signature
    const sr = sidebarRight
    if (sr === undefined) return
    try {
      sr.openTab(TAB_KIND)
    } catch (error) {
      console.warn('[dsh-tool-todo-plus] open panel failed:', error)
    }
  }, [signature])

  return null
}

/** 单条任务的状态点颜色（沿用内置面板的 done/ongoing/idle 语义） */
function dotColor(status: TodoItem['status']): string {
  if (status === 'completed') return '#3fb950' // 绿：已完成
  if (status === 'in_progress') return '#58a6ff' // 蓝：进行中
  return '#8b949e' // 灰：待办
}

/**
 * 会话标题栏的"任务清单"按钮：一键打开/聚焦面板。
 * 这是面板被关闭后的主要重开入口（另一个入口是右侧栏"新标签页"引导页里的 guide 框）。
 * 不需要槽位注入的 props——服务引用走模块级闭包。
 */
function TodoHeaderAction(_props: unknown): ReactElement {
  return (
    <button
      type="button"
      title="任务清单"
      aria-label="任务清单"
      onClick={() => {
        try {
          sidebarRight?.openTab(TAB_KIND)
        } catch {
          // 打开失败（例如会话布局尚未就绪）时静默，不影响标题栏
        }
      }}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: 12, padding: '3px 9px', borderRadius: 6,
        border: '1px solid rgba(128,128,128,0.45)', background: 'transparent',
        color: 'inherit', cursor: 'pointer', opacity: 0.85,
      }}
    >
      <span aria-hidden>☰</span>
      任务清单
    </button>
  )
}

/**
 * 胶囊摘要内容——移植 ZCode `ConversationStatusPanel` 的胶囊优先级链。
 * ZCode 源码里的完整链是 `currentPlanItem → 活动 Goal → Git 变更 → 已完成 Goal
 * → completedPlanItem → todo 计数 → 会话计划 → 运行中活动数`；本插件只关心任务
 * 清单，因此取其中与 todo 相关的三档：
 *   1. 进行中项：箭头图标 + 该项文本（最高优先，这也是 ZCode 胶囊默认展示的形态）
 *   2. 最近完成项：绿色对勾 + 文本
 *   3. 待办计数：清单图标 + 完成数/总数
 * 全空返回 null（ZCode 的胶囊在无内容时整体不渲染）。
 */
function capsuleSummary(todos: readonly TodoItem[]): {
  icon: string
  text: string
  color?: string
} | null {
  const current = todos.find(t => t.status === 'in_progress')
  if (current !== undefined) {
    return { icon: '→', text: current.content, color: '#58a6ff' }
  }
  let lastDone: TodoItem | undefined
  for (const t of todos) if (t.status === 'completed') lastDone = t
  if (lastDone !== undefined) {
    return { icon: '✓', text: lastDone.content, color: '#3fb950' }
  }
  if (todos.length > 0) {
    const done = todos.filter(t => t.status === 'completed').length
    return { icon: '☰', text: `待办 ${done}/${todos.length}` }
  }
  return null
}

/** tab 正文注入的形状（对齐官方 PlanPreview：hooks 以平铺 props 传入） */
interface BodyProps {
  useTabInfo?: () => {
    panel?: { id?: string }
    tab?: { id?: string }
  }
  t?: (key: string) => string
}

/**
 * 面板正文：展开态 = 清单卡片；胶囊态 = 小药丸。头部按钮互相切换。
 * 挂载时把自己的 tab 浮动化——只有这里能从 useTabInfo 拿到 minter 生成的
 * 真实 tab 记录 id（定义 id 不是记录 id，直接 float 定义 id 查无此 tab）。
 */
function TodoSidebarBody(props: BodyProps): ReactElement {
  useSyncExternalStore(subscribe, getSnapshot)
  // useTabInfo 由槽位渲染器对同一槽位恒定注入（平铺 prop），"有无"分支稳定，
  // 不违反 React hook 顺序规则。
  const useTabInfo = props.useTabInfo
  const info = useTabInfo ? useTabInfo() : undefined
  const tabId = info?.tab?.id
  const paneId = info?.panel?.id

  const [collapsed, setCollapsed] = useState(false)

  // 挂载自举：把 tab 从停靠宿主浮出（每个 tab 实例一次）
  useEffect(() => {
    const sr = sidebarRight
    if (tabId === undefined || sr === undefined || floatedTabs.has(tabId)) return
    floatedTabs.add(tabId)
    floatPanelIn({ sidebarRight: sr } as ClientCtx, tabId, paneId, FLOAT_WIDTH, FLOAT_HEIGHT)
  }, [tabId, paneId])

  const todos = snapshot
  const completed = todos.filter(t => t.status === 'completed').length
  const inProgress = todos.filter(t => t.status === 'in_progress').length
  const progressLabel = `${completed}/${todos.length}${inProgress > 0 ? ` · ${inProgress} 进行中` : ''}`

  /** 收起为胶囊 / 展开状态：切换内容形态并重设浮窗尺寸 */
  const toggleCollapsed = (): void => {
    const next = !collapsed
    setCollapsed(next)
    const sr = sidebarRight
    if (sr === undefined || tabId === undefined) return
    floatPanelIn({ sidebarRight: sr } as ClientCtx, tabId, paneId,
      next ? CAPSULE_WIDTH : FLOAT_WIDTH,
      next ? CAPSULE_HEIGHT : FLOAT_HEIGHT)
  }

  if (collapsed) {
    const summary = capsuleSummary(todos)
    return (
      <div style={{ padding: '8px 10px' }}>
        <button
          type="button"
          onClick={toggleCollapsed}
          title="展开状态"
          aria-label="展开状态"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            maxWidth: '100%', fontSize: 12, padding: '5px 12px', borderRadius: 999,
            border: '1px solid rgba(128,128,128,0.45)', background: 'transparent',
            color: 'inherit', cursor: 'pointer',
          }}
        >
          {summary === null ? '任务清单' : (
            <>
              <span aria-hidden style={{
                flex: 'none',
                color: summary.color ?? 'inherit',
                opacity: summary.color === undefined ? 0.75 : 1,
              }}>
                {summary.icon}
              </span>
              <span style={{
                minWidth: 0, overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {summary.text}
              </span>
            </>
          )}
        </button>
      </div>
    )
  }

  if (todos.length === 0) {
    return (
      <div style={{ padding: '12px 14px', fontSize: 12, opacity: 0.6 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
          <button type="button" onClick={toggleCollapsed} style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 6,
            border: '1px solid rgba(128,128,128,0.45)', background: 'transparent',
            color: 'inherit', cursor: 'pointer', opacity: 0.8,
          }}>
            收起为胶囊
          </button>
        </div>
        暂无任务。模型调用 todo_write_plus 后，清单会实时出现在这里。
      </div>
    )
  }

  return (
    <div style={{ padding: '10px 14px 14px', fontFamily: 'inherit' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 12, fontWeight: 600, opacity: 0.85, marginBottom: 10,
      }}>
        <span>任务清单</span>
        <span style={{ fontWeight: 400, opacity: 0.7 }}>
          {progressLabel}
        </span>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={toggleCollapsed} title="收起为胶囊" style={{
          fontSize: 11, padding: '2px 8px', borderRadius: 6,
          border: '1px solid rgba(128,128,128,0.45)', background: 'transparent',
          color: 'inherit', cursor: 'pointer', opacity: 0.8,
        }}>
          收起为胶囊
        </button>
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
        {todos.map(todo => (
          <li key={todo.content} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 13, lineHeight: 1.5 }}>
            <span aria-hidden style={{
              flex: 'none', width: 8, height: 8, borderRadius: '50%',
              background: dotColor(todo.status),
              marginTop: 5,
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

// apply 时捕获的右侧栏服务引用（组件树里拿不到 ctx，靠闭包传递）
let sidebarRight: ClientCtx['sidebarRight'] | undefined

/**
 * 客户端半插件入口。由客户端模块系统在物化时调用（懒 CJS 工厂）。
 * 只导出命名成员（apply/inject），绝不加 export default——
 * Loader 的 unwrapExports 会折叠模块并丢弃 inject（官方 postmortem 0001）。
 */
export function apply(ctx: ClientCtx): void {
  sidebarRight = ctx.sidebarRight

  // 第一阶段：tab 类型注册（kind 是 tab 类型名；priority: 'extension' 是第三方最高档）
  ctx.sidebarRightTabs.register({
    id: TAB_ID,
    kind: TAB_KIND,
    priority: 'extension',
    title: () => '任务清单',
    keepMounted: true,
    // 引导页入口框：让本类型出现在右侧栏"新标签页"列表里。
    // 缺了这个字段，面板被关闭后用户在界面上找不到任何重开入口（实测踩过）。
    guide: [{
      id: TAB_ID,
      order: 100,
      title: () => '任务清单',
      description: () => '显示当前任务清单与进度',
    }],
  })

  // 第二阶段：tab 正文（keyed 槽位，key = 类型注册的 id）
  ctx.slots.inject('sidebar.right.pane.tab', () => {
    ctx.slots.register({ name: 'sidebar.right.pane.tab', key: TAB_ID }, TodoSidebarBody)
  })

  // 数据桥：dock 槽位（有 useProjection）订阅投影，喂给模块级 store
  ctx.slots.inject('conversation.input.dock', () => {
    ctx.slots.register({ name: 'conversation.input.dock', id: BRIDGE_ID, order: 50 }, TodoBridge)
  })

  // 会话标题栏的一键重开按钮（面板被关闭后的主要入口）
  ctx.slots.inject('conversation.session.header.actions', () => {
    ctx.slots.register({ name: 'conversation.session.header.actions', id: HEADER_ACTION_ID, order: 50 }, TodoHeaderAction)
  })
}

export const inject = ['slots', 'sidebarRight', 'sidebarRightTabs']
