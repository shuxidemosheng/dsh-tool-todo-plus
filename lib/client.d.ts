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
interface SidebarRightTabDef {
    id: string;
    kind: string;
    priority?: string;
    title?: (address?: string) => string;
    keepMounted?: boolean;
    patterns?: string[];
    /**
     * "新标签页"引导页上的入口框。**省略则本类型完全不出现在引导页**
     * （官方契约原文："Entry boxes for the guide page. Omit to stay off it."）——
     * 面板被关闭后这就是用户手动重开的入口之一。
     */
    guide?: readonly {
        id: string;
        order: number;
        title: () => string;
        description?: () => string;
    }[];
}
interface ClientCtx {
    sidebarRightTabs: {
        register(def: SidebarRightTabDef): () => void;
    };
    slots: {
        /** 延迟注册：槽位就绪后回调一次，回调里做 slots.register */
        inject(slot: string, register: () => void): void;
        register(def: {
            name: string;
            id?: string;
            key?: string;
            order?: number;
        }, component: unknown): () => void;
    };
    sidebarRight: {
        openTab(kind: string, options?: Record<string, unknown>): unknown;
        /** 把 tab 移到浮动宿主（ZCode 式小浮窗）；rect 缺省时按级联位置放置 */
        float(tabId: string, rect?: {
            x: number;
            y: number;
            width: number;
            height: number;
        }): void;
        /** 把浮动 pane 收回停靠宿主 */
        dock(paneId: string): void;
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
