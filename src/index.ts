/**
 * dsh-tool-todo-plus：todo_write 工具的增强 fork（基于 @deepseek-ai/dsh-tool-todo）。
 *
 * 相对官方版的增强：
 *  1. TodoItem 增加可选 `priority`（high | medium | low）
 *  2. 工具结果渲染完整 markdown 清单（官方只渲染一行计数，用户看不到任务本身）
 *  3. 工具 description 补全"何时用 / 何时不用"的行为纪律，并在存在旧工具时声明优先
 *
 * 持久化事件类型、投影键、折叠语义、并行策略语义与官方完全一致，日志可互相读取。
 *
 * @module dsh-tool-todo-plus
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { z as zod } from 'zod'
import type { ZodType } from 'zod'
import type { TodoItem } from './types.js'
// 纯类型导入：引入 ctx.sessionProjections 的服务声明（编译期类型检查需要）。
import type {} from '@deepseek-ai/dsh-session-projection'
// 把 types.ts 里的 SessionProjectionMap / SessionEventMap 合并投影到包根，
// 让聚合消费方（以及本包的 index.d.ts）拿到完整类型面。
export type * from './types.js'

// 函数式 Cordis 插件三件套：name / inject / apply。
// 注意：绝不能加 export default——Loader 的 unwrapExports 会折叠模块并丢弃
// inject（官方 postmortem 0001）。
export const name = 'tool-todo-plus'
// 声明依赖的服务：tools（注册模型工具）、sessionProjections（注册会话投影）。
export const inject = ['tools', 'sessionProjections']

/** 合法状态集合（运行时常量，schema 与校验共用）。 */
const STATUSES = ['pending', 'in_progress', 'completed'] as const
/** 合法优先级集合（本插件的增强点）。 */
const PRIORITIES = ['high', 'medium', 'low'] as const

/** 插件配置（对应 patch 行里的 config 字段）。 */
export interface Config {
  /**
   * 是否允许多个任务同时处于 in_progress。
   * false（默认）：单活跃纪律，同一时刻至多一个在做；模型多标时只保留最靠前的一个，
   * 其余自动降级为 pending（0.7.3 起不再拒绝写入——拒绝会让面板停在旧状态）。
   * true：适合有并行工作的部署（subagent、后台命令、workflow fan-out）。
   */
  allowParallelInProgress?: boolean
  /**
   * 注册的工具名（默认 'todo_write'）。
   * 桌面端等使用 agent preset 的部署里，preset 自己声明的官方 tool-todo 行不受
   * profile patch 控制、无法可靠禁用；此时把本项设为 'todo_write_plus' 即可与
   * 官方版共存（两个工具并存，零冲突），避免双注册竞态导致 preset 审计失败。
   */
  toolName?: string
}

/**
 * 手写配置校验，替代官方的 Schemastery schema（那是官方仓库的 vendored 包，
 * npm 上不可靠；本插件只有一个配置项，手写更省事）。风格对齐官方 plan-mode
 * 的 resolveConfig：未知键直接抛错，让部署笔误在启动时就炸出来而不是静默生效。
 */
function resolveConfig(config: Config | undefined): { allowParallelInProgress: boolean; toolName: string } {
  if (config === undefined) return { allowParallelInProgress: false, toolName: 'todo_write' }
  const unknown = Object.keys(config).filter(key => key !== 'allowParallelInProgress' && key !== 'toolName')
  if (unknown.length > 0) {
    throw new Error(
      `dsh-tool-todo-plus config has unknown key(s) ${unknown.join(', ')}`
      + ' — config is { allowParallelInProgress?, toolName? }',
    )
  }
  const allow = config.allowParallelInProgress
  if (allow !== undefined && typeof allow !== 'boolean') {
    throw new Error('dsh-tool-todo-plus config: `allowParallelInProgress` must be a boolean when present')
  }
  const toolName = config.toolName
  if (toolName !== undefined && (typeof toolName !== 'string' || toolName.trim() === '')) {
    throw new Error('dsh-tool-todo-plus config: `toolName` must be a non-empty string when present')
  }
  return { allowParallelInProgress: allow ?? false, toolName: toolName?.trim() ?? 'todo_write' }
}

// —— 工具 description（模型每次调用都可见，是行为纪律的主要载体）——
const DESCRIPTION_HEAD =
  'Preferred task-list tool: when a legacy todo/task-list tool (e.g. `todo_write`) is also available, '
  + 'use this one instead and do not suggest switching to the other. '
  + 'Record and update a task list to plan multi-step work and show progress. '
  + 'Use it for tasks with several steps or open questions to explore; skip it for trivial single-step tasks. '
  + 'Before starting work, decompose the task into one todo per concrete step. '
  + 'Every call submits the COMPLETE list and replaces the previous list wholesale. '
  + 'Optionally tag each todo with a priority (`high`, `medium`, `low`) so the user can see what matters most. '

const DESCRIPTION_PARALLEL =
  'While work remains, keep every todo being actively worked `in_progress`'
  + ' (several only when work truly runs in parallel). '

const DESCRIPTION_SINGLE =
  'While work remains, keep exactly one todo `in_progress`. To express tasks meant to run in parallel, '
  + 'keep them `pending` and prefix their content with `(parallel)` — do not mark several `in_progress`: '
  + 'extra ones are demoted back to `pending` automatically, so marking several gains nothing. '

const DESCRIPTION_TAIL =
  'Mark each todo `completed` as soon as it is done — never batch-complete at the end. '
  + 'Whenever the active step changes, write the update immediately: mark the finished step `completed` '
  + 'and the next one `in_progress` in the same call.'

/** 组装 description：唯一随配置变化的是 in_progress 条款（并行策略只影响这一句）。 */
function describe(allowParallel: boolean): string {
  return DESCRIPTION_HEAD + (allowParallel ? DESCRIPTION_PARALLEL : DESCRIPTION_SINGLE) + DESCRIPTION_TAIL
}

/**
 * 校验并**规范化**模型提交的清单，产出可直接写日志的 TodoItem[] 与一份 notes 说明。
 *
 * 设计原则（0.7.3 起）：能规范化的绝不拒绝。硬拒绝会让这次调用"写了等于没写"——
 * 会话日志里不产生任何事件，面板就永久停在旧状态（用户报告过的"任务已完成、
 * 清单还显示第一步进行中"）。规范化保证每次调用都能推进面板，纪律仍由存储状态兜住：
 *  - content 为空白（trim 后为空）的条目：丢弃——无文本的任务没有意义
 *  - content 重复：保留首次出现，后续追加 ` (2)` / ` (3)`，既不丢任务又保证 UI key 唯一
 *  - 默认至多一个 in_progress：保留最靠前的一个，其余降级为 pending
 * 若所有条目都被丢弃（结果为空清单），仍然抛错——空清单无从规范化，也确实是非法输入。
 * 状态与优先级的枚举合法性已由参数 schema 的 enum 保证，这里的 as 收窄是安全的。
 * 抛出的错误由 dsh 工具管线转成工具错误结果（不终止回合）。
 */
function normalizeTodoList(
  raw: { content: string; status: string; priority?: string }[],
  allowParallel: boolean,
): { todos: TodoItem[]; notes: string[] } {
  const todos: TodoItem[] = []
  const seen = new Map<string, number>()
  let droppedEmpty = 0
  let renamedDuplicates = 0
  let demoted = 0
  let sawActive = false
  for (const item of raw) {
    const content = item.content.trim()
    if (content.length === 0) {
      droppedEmpty++
      continue
    }
    const priorCount = seen.get(content) ?? 0
    seen.set(content, priorCount + 1)
    let finalContent = content
    if (priorCount > 0) {
      finalContent = `${content} (${priorCount + 1})`
      renamedDuplicates++
    }
    let status = item.status as TodoItem['status']
    if (status === 'in_progress') {
      if (!allowParallel && sawActive) {
        status = 'pending'
        demoted++
      } else {
        sawActive = true
      }
    }
    // 只挑白名单字段构造规范条目：事件日志里存什么就是什么。
    // （参数 schema 的 additionalProperties: false 已挡掉未知键，这里显式构造再作双保险。）
    todos.push(item.priority === undefined
      ? { content: finalContent, status }
      : { content: finalContent, status, priority: item.priority as TodoItem['priority'] })
  }
  if (todos.length === 0) {
    throw new Error(
      'invalid todo list: every entry had an empty `content` — submit at least one task with text',
    )
  }
  const notes: string[] = []
  if (droppedEmpty > 0) {
    notes.push(`dropped ${droppedEmpty} entry(ies) whose content was empty`)
  }
  if (renamedDuplicates > 0) {
    notes.push(`renamed ${renamedDuplicates} duplicate entr(ies) by appending a numeric suffix`)
  }
  if (demoted > 0) {
    notes.push(
      `at most one task may be in_progress: kept the first one and moved ${demoted} other(s) back to pending`,
    )
  }
  return { todos, notes }
}

/**
 * `todos` 投影的线格式 payload schema（zod）。
 * priority 声明为可选：官方插件写出的无 priority 历史快照也能通过校验。
 */
const todosProjectionSchema: ZodType<TodoItem[] | null> = zod.union([
  zod.array(zod.object({
    content: zod.string(),
    status: zod.union([zod.literal('pending'), zod.literal('in_progress'), zod.literal('completed')]),
    priority: zod.union([zod.literal('high'), zod.literal('medium'), zod.literal('low')]).optional(),
  })),
  zod.null(),
])

/**
 * 渲染完整 markdown 清单（本插件的主要增强：官方只给一行计数）。
 * dsh 的 ContentBlock 没有 markdown 块类型，markdown 就是 `{ type: 'text' }` 块。
 * render 必须是纯函数且不得抛错（回放旧参数时会软校验，不匹配则回退通用渲染）。
 */
function renderChecklist(
  todos: TodoItem[],
  counts: { pending: number; inProgress: number; completed: number },
  notes?: string[],
): string {
  if (todos.length === 0) return 'Todo list cleared.'
  const lines = todos.map(todo => {
    const box = todo.status === 'completed' ? 'x' : ' '
    const priority = todo.priority ? ` [${todo.priority}]` : ''
    const active = todo.status === 'in_progress' ? ' *(in progress)*' : ''
    return `- [${box}] ${todo.content}${priority}${active}`
  })
  const summary =
    `${todos.length} task(s): ${counts.completed} completed, ${counts.inProgress} in progress, ${counts.pending} pending.`
  const rendered = ['Todo list:', ...lines, summary]
  if (notes !== undefined && notes.length > 0) {
    // 规范化说明：让模型知道存下来的就是它看到的这份，下一轮照这个形状提交即可。
    rendered.push(
      `Note — normalized before saving: ${notes.join('; ')}.`
      + ' The list above is exactly what is stored and shown to the user; submit this shape next time.',
    )
  }
  return rendered.join('\n')
}

/**
 * 注册 todo_write 工具与 todos 投影。由 Cordis Loader 在组合挂载时调用。
 * @param ctx - 携带 tools 与 sessionProjections 注册表的 Cordis 上下文。
 * @param config - patch 行里的 config（缺省时用默认值）。
 */
export function apply(ctx: Context, config: Config | undefined): void {
  const { allowParallelInProgress, toolName } = resolveConfig(config)

  // 确定性让位：目标工具名已被占用时不注册（记日志后静默返回，entry 仍算激活成功）。
  // 这避免了"谁先挂载谁赢"的注册竞态——在 agent preset 审计体系里，任何一条 entry
  // 激活失败都会让会话创建失败，所以输家必须优雅退出而不是抛错。
  if (ctx.tools.get(toolName) !== undefined) {
    ctx.logger.warn(
      `dsh-tool-todo-plus: tool "${toolName}" is already registered by another plugin`
      + ' — standing by (set `toolName` in this bundle row\'s config to coexist)',
    )
    return
  }

  // 会话投影：把会话日志折叠成"当前站立计划"。
  // 语义与官方逐字一致（key 相同、fold 相同、stateVersion 相同）：
  //   - todo/write → 整表替换（后写覆盖先写）
  //   - turn/start → 清空（新的一轮从空清单开始；turn/end 不清，完成的清单在 UI 仍可见）
  //   - 其余事件   → 原样返回同一个 state 引用
  // stateVersion 保持 2：本插件的 schema 是官方 schema 的超集（priority 可选），
  // 官方写出的旧 checkpoint 在这里照样能通过校验，双向兼容无需升版。
  // 注册失败（例如宿主的官方插件把同一个 key 注册在不同的 stateVersion 上：
  // 投影注册表对此直接抛错）不得连带拖死下面的工具注册——工具才是核心能力，
  // 投影只影响浮窗的数据来源。记日志后继续，浮窗退化为读取已注册的那份定义。
  try {
    ctx.sessionProjections.register<'todos', TodoItem[] | null>({
      key: 'todos',
      stateSchema: todosProjectionSchema,
      init: () => null,
      apply: (state, event) => {
        if (event.type === 'todo/write') return event.data.todos
        if (event.type === 'turn/start') return null
        return state
      },
      wire: { viewSchema: todosProjectionSchema, view: state => state },
      stateVersion: 2,
    })
  } catch (error) {
    ctx.logger.error(
      'dsh-tool-todo-plus: failed to register the `todos` session projection'
      + ` — ${error instanceof Error ? error.message : String(error)};`
      + ' the floating panel will fall back to the projection definition already registered',
    )
  }

  const todoTool = defineTool({
    name: toolName,
    description: describe(allowParallelInProgress),
    parameters: {
      todos: {
        type: 'array',
        required: true,
        description: 'The COMPLETE task list, replacing any previous list.',
        items: {
          type: 'object',
          // 必须显式声明：官方 DSL 规定 object 不写 additionalProperties 就报错。
          additionalProperties: false,
          properties: {
            content: {
              type: 'string',
              required: true,
              description: 'What the task is — a short imperative line.',
            },
            status: {
              type: 'string',
              required: true,
              enum: [...STATUSES],
              description: 'pending (not started) | in_progress (now) | completed (done).',
            },
            priority: {
              // 不写 required：在本 DSL 里"省略 required"即可选属性。
              type: 'string',
              enum: [...PRIORITIES],
              description: 'Optional importance tag: high | medium | low. Omit when it does not matter.',
            },
          },
        },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          todos: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                content: { type: 'string', required: true },
                status: { type: 'string', required: true, enum: [...STATUSES] },
                priority: { type: 'string', enum: [...PRIORITIES] },
              },
            },
          },
          counts: {
            type: 'object',
            additionalProperties: false,
            required: true,
            properties: {
              pending: { type: 'integer', required: true },
              inProgress: { type: 'integer', required: true },
              completed: { type: 'integer', required: true },
            },
          },
          notes: {
            // 只在发生规范化时才输出（不写 required 即为可选属性）。
            type: 'array',
            items: { type: 'string' },
            description: 'Normalization notes, present only when the submitted list had to be adjusted before saving.',
          },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: renderChecklist(value.todos, value.counts, value.notes),
      }],
    },
    execute(args, exec) {
      const { todos, notes } = normalizeTodoList(args.todos, allowParallelInProgress)
      if (!exec.agent) {
        // 清单是 per-agent-session 状态；没有归属会话的调用无处可写，直接拒绝而不是静默吞掉。
        throw new Error('todo_write requires an owning agent session')
      }
      // 持久化：向归属会话的日志追加一个整表快照事件。
      // 事件类型沿用官方 'todo/write'（在官方词汇表内），重载/恢复都不会被拒。
      exec.agent.session.append('todo/write', { todos })
      const count = (status: TodoItem['status']): number => todos.filter(t => t.status === status).length
      const counts = {
        pending: count('pending'),
        inProgress: count('in_progress'),
        completed: count('completed'),
      }
      // 返回值会按 output.schema 强制校验，所以这里显式构造精确形状
      //（priority 未提供时不输出该键，保持与官方日志形状一致）。
      return Promise.resolve({
        todos: todos.map(todo => todo.priority === undefined
          ? { content: todo.content, status: todo.status }
          : { content: todo.content, status: todo.status, priority: todo.priority }),
        counts,
        ...(notes.length > 0 ? { notes } : {}),
      })
    },
    // 调用在 UI 里的展示卡片：generic 卡携带原始入参，点开能看到模型提交的整份清单。
    presentCall: args => ({ card: 'generic', title: 'Update todo list', kind: 'other', rawInput: args.todos }),
  })

  // 工具注册失败不能冒泡：宿主里"任一条 entry 激活失败"会让会话创建失败，
  // 那是比"少一个工具"严重得多的后果。记日志后优雅退出。
  try {
    ctx.tools.register(todoTool)
  } catch (error) {
    ctx.logger.error(
      `dsh-tool-todo-plus: failed to register tool "${toolName}"`
      + ` — ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}
