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
import type { ReactNode } from 'react';
declare module 'react-dom' {
    function createRoot(container: Element | DocumentFragment): {
        render(node: ReactNode): void;
        unmount(): void;
    };
}
interface ClientCtx {
    slots: {
        inject(slot: string, register: () => void): void;
        register(def: {
            name: string;
            id?: string;
            key?: string;
            order?: number;
        }, component: unknown): () => void;
    };
    logger: {
        warn(...args: unknown[]): void;
    };
}
/**
 * 客户端半插件入口。由客户端模块系统在物化时调用（懒 CJS 工厂）。
 * 只导出命名成员（apply/inject），绝不加 export default——
 * Loader 的 unwrapExports 会折叠模块并丢弃 inject（官方 postmortem 0001）。
 */
export declare function apply(ctx: ClientCtx): void;
export declare const inject: string[];
export {};
