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
export {};
