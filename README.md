# dsh-tool-todo-plus

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）的任务清单插件——`@deepseek-ai/dsh-tool-todo` 官方 `todo_write` 工具的增强 fork。

在官方版基础上增加：

- **浮动任务面板**：模型创建/更新清单时，自动以紧凑浮窗弹出（不推挤聊天区），实时跟随清单变化；可**收起为胶囊**（显示当前进行中项，ZCode 计划面板同款交互），点胶囊展开回来
- **优先级字段**：`TodoItem` 增加可选 `priority`（`high` / `medium` / `low`），工具结果与浮窗均渲染优先级徽章
- **完整清单渲染**：工具结果渲染完整 markdown 清单（官方版只有一行计数）
- **行为纪律**：工具 description 内置"何时用/不用、整表替换、单 `in_progress`、完成即刻标记"的完整指引，并在存在官方工具时声明优先使用本插件
- **手动入口**：会话标题栏"任务清单"按钮 + 右侧栏"新标签页"引导页入口框，面板关闭后随时重开

与官方 `todo_write` **共存**（本插件注册为 `todo_write_plus`），互不冲突；会话日志复用官方 `todo/write` 事件类型，双向兼容。

## 安装

### 方式一：桌面端插件页（推荐）

打开 dsh 桌面端 → 侧边栏「插件」→ 安装本地包 → 选择 Release 中的 `dsh-tool-todo-plus-x.y.z.tgz` → 完全重启应用。

### 方式二：git 直装

```bash
dsh plugin --profile <你的profile名> add https://github.com/<owner>/dsh-tool-todo-plus.git
```

### 方式三：源码构建

```bash
pnpm install
pnpm build        # tsc 类型检查 + esbuild 产出 lib/index.js（宿主半）与 lib/client.js（客户端半）
npm pack          # 产出可安装的 tgz
```

要求：Node.js ≥ 24。

## 配置

在 bundle 行的 `config` 里设置（见 `cordis.patch.yml`）：

| 字段 | 默认 | 说明 |
|---|---|---|
| `allowParallelInProgress` | `false` | 是否允许多个任务同时 `in_progress`。`false` 为单活跃纪律（同 ZCode），多标即拒绝；`true` 适合有并行工作的部署 |
| `toolName` | `'todo_write'` | 注册的工具名。桌面端等使用 agent preset 的部署无法禁用官方 `tool-todo` 行，设为 `'todo_write_plus'` 可与官方共存，避免双注册竞态 |

## 与官方版的兼容性

- 会话事件沿用官方 `todo/write` 类型（在官方构建期事件词汇表内），日志可互相读取，会话重载无兼容性风险
- 官方持久化 invariant 不拒绝 `priority` 字段；官方投影 schema 会剥离未知键
- 工具名被占用时本插件记日志后优雅让位（entry 正常激活），不会导致 agent preset 审计失败

## 安全

- 宿主半与客户端半均为自包含产物（运行时零 npm 依赖；客户端仅依赖平台模块表中的 react）
- 客户端半无任何网络请求、无 localStorage 写入、无 `eval`/`innerHTML`
- 工具参数经 schema（enum + `additionalProperties: false`）与运行时校验双层过滤；渲染走 React 文本节点（自动转义）
- 构建管线内置 [`scripts/disable-eval.mjs`](scripts/disable-eval.mjs)：移除内联的 Schemastery 字符串回调动态执行点（本插件不使用该机制），使产物无任何 `new Function`/`eval`
- 已通过 Mimosa 深度安全扫描（0 发现、0 依赖风险，封印 `sha256:60dfb872…`）

## 已知限制

- 桌面端 agent preset 声明的官方 `tool-todo` 行不受 profile 补丁控制，因此默认共存而非替换；`toolName` 可用于规避冲突
- 浮窗关闭后，同页面再次自动弹出需要新的清单写入触发；也可用标题栏按钮手动打开
- 官方消息区的内联任务面板由官方客户端渲染，不显示 `priority`（priority 在工具结果与浮窗中可见）

## 上游致谢

本插件是 [`@deepseek-ai/dsh-tool-todo`](https://github.com/deepseek-ai/deepseek-harness/tree/main/packages/todo/tool-todo) 的增强 fork，持久化、投影与并行策略语义沿用上游实现。上游以 [MIT](./LICENSE) 许可发布。

## 许可证

[MIT](./LICENSE)
