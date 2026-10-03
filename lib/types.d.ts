/**
 * dsh-tool-todo-plus 的纯类型定义：TodoItem、todo/write 会话事件、todos 投影键声明。
 *
 * 事件类型名刻意沿用官方 @deepseek-ai/dsh-tool-todo 的 `todo/write`——它属于官方
 * 构建期事件词汇表（KNOWN_SESSION_EVENT_TYPES）。第三方如果发明全新的事件类型名，
 * 会话日志在重载时可能因"未知类型且未标 ignorable"被拒绝加载；复用官方类型名则
 * 彻底规避该风险，本插件与官方插件写出的日志可互相读取。
 *
 * @module dsh-tool-todo-plus/types
 */
/**
 * 任务清单中的一项。
 *
 * 与官方 TodoItem 的唯一差异是可选的 `priority` 字段（对齐 ZCode 的 TodoWrite）。
 * 官方的持久化 invariant 只校验 content/status，不拒绝多余字段；官方投影的 zod
 * schema 默认剥离未知键。因此带 priority 的条目在官方组件眼中只是普通条目，
 * 两个方向都兼容。
 */
export interface TodoItem {
    /** 任务内容——一句简短的祈使句。 */
    content: string;
    /** 生命周期状态。in_progress 表示正在做；是否允许多个同时 in_progress 由部署配置决定。 */
    status: 'pending' | 'in_progress' | 'completed';
    /** 可选优先级标签（本插件的增强点）；省略表示不标优先级。 */
    priority?: 'high' | 'medium' | 'low';
}
declare module '@deepseek-ai/dsh-session/types' {
    interface SessionEventMap {
        /** 整表快照；回放时后写覆盖先写。仅用于日志与 UI 状态，不参与派生历史。 */
        'todo/write': {
            todos: TodoItem[];
        };
    }
}
declare module '@deepseek-ai/dsh-session-projection/types' {
    interface SessionProjectionStateMap {
        todos: TodoItem[] | null;
    }
    interface SessionProjectionMap {
        /**
         * 当前整份任务清单（最近一次 `todo/write` 快照），首次写入前为 `null`。
         * 整值规则：每次 `todo/write` 携带完整替换列表，折叠时后写覆盖先写。
         */
        todos: TodoItem[] | null;
    }
}
