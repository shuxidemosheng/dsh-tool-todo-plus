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
import type { Context } from '@deepseek-ai/cordis';
export type * from './types.js';
export declare const name = "tool-todo-plus";
export declare const inject: string[];
/** 插件配置（对应 patch 行里的 config 字段）。 */
export interface Config {
    /**
     * 是否允许多个任务同时处于 in_progress。
     * false（默认）：单活跃纪律，同一时刻至多一个在做，多标即拒绝——与 ZCode TodoWrite 一致。
     * true：适合有并行工作的部署（subagent、后台命令、workflow fan-out）。
     */
    allowParallelInProgress?: boolean;
    /**
     * 注册的工具名（默认 'todo_write'）。
     * 桌面端等使用 agent preset 的部署里，preset 自己声明的官方 tool-todo 行不受
     * profile patch 控制、无法可靠禁用；此时把本项设为 'todo_write_plus' 即可与
     * 官方版共存（两个工具并存，零冲突），避免双注册竞态导致 preset 审计失败。
     */
    toolName?: string;
}
/**
 * 注册 todo_write 工具与 todos 投影。由 Cordis Loader 在组合挂载时调用。
 * @param ctx - 携带 tools 与 sessionProjections 注册表的 Cordis 上下文。
 * @param config - patch 行里的 config（缺省时用默认值）。
 */
export declare function apply(ctx: Context, config: Config | undefined): void;
