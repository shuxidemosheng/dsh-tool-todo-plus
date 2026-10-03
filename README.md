# dsh-tool-todo-plus

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）的任务清单插件——[`@deepseek-ai/dsh-tool-todo`](https://github.com/deepseek-ai/deepseek-harness) 官方 `todo_write` 工具的增强 fork：**优先级标签 + 完整清单渲染 + 会话内浮动任务面板**。

仓库：`https://github.com/shuxidemosheng/dsh-tool-todo-plus`

## 它是什么

一个"模型侧工具 + 用户侧面板"的组合：

- **模型侧**：注册增强版任务清单工具。是否建清单由模型根据任务复杂度自主判断（多步骤任务通常会建），你也可以在消息里直接要求"先列个任务清单"来引导。
- **用户侧**：模型每次写入清单，会话内自动弹出浮动面板并实时跟随更新；面板是纯展示层，不会无中生有。

## 功能

### 增强工具（模型侧）

- **优先级标签**：`TodoItem` 增加可选 `priority`（`high` / `medium` / `low`），对齐 ZCode 的 TodoWrite
- **完整清单渲染**：工具结果向模型返回完整 markdown 清单（官方版只有一行计数）
- **行为纪律**：工具 description 内置"何时用/不用、整表替换、单 `in_progress`、完成即刻标记"的完整指引，并在存在官方工具时声明优先使用本插件
- **参数双保险**：参数 schema（enum + `additionalProperties: false`）之外再做运行时校验——非空、去重、默认至多一个 `in_progress`（多标即拒绝，模型会收到纠正信息重试）

### 浮动任务面板（用户侧）

- **独立浮窗**：插件自绘 overlay，不推挤聊天区，也**不会展开右侧栏**；只在会话界面显示，切到插件页等其他界面自动隐藏
- **两种形态**：展开态（状态点 / 划线 / 优先级徽章 / 进度计数 / "进行中"标记）⇄ 胶囊态（ZCode 计划面板同款内容优先级链：进行中项 `→` → 最近完成项 `✓` → `☰ 待办 完成/总数`），点击即时切换
- **自动弹出规则**：
  - 模型**实时写入** → 自动弹出（面板刚关掉也会为新任务重开）
  - 重新进入会话 / 切换会话 / 重启应用 → 历史清单只同步数据，**不**弹面板（关了就保持关着）
- **手动入口**：会话标题栏"☰ 任务清单"按钮随时开关；`✕` 关闭
- **原生外观**：颜色、圆角、阴影、毛玻璃材质全部解析 dsh 宿主的 `--dsw-*` 设计 token，亮暗主题自动跟随

### 与官方版共存

- 本插件在桌面端注册为 **`todo_write_plus`**，与官方 `todo_write` 并存，零冲突
- 会话日志复用官方 `todo/write` 事件类型：与官方插件写出的日志可互相读取，会话重载无兼容性风险
- 工具名万一被占用，本插件记日志后优雅让位（entry 正常激活），不会导致 agent preset 审计失败

## 安装

### 方式一：桌面端 git 直装（推荐）

在 **Git Bash** 中执行（先完全退出 DeepSeek Harness，含系统托盘）：

```bash
ELECTRON_RUN_AS_NODE=1 "/d/DeepSeek Harness/DeepSeek Harness.exe" --expose-internals "D:/DeepSeek Harness/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-desktop-host/lib/cli.js" plugin --profile desktop add https://github.com/shuxidemosheng/dsh-tool-todo-plus.git
```

然后启动应用。安装后可验证版本：

```bash
grep '"version"' ~/.dsh/profiles/desktop/node_modules/dsh-tool-todo-plus/package.json
```

**更新到新版**：重跑同一条安装命令即可（会从 GitHub 拉取 main 分支最新版），装完重启应用。

### 方式二：CLI profile

有 `dsh` 命令行的环境（CLI 安装的 dsh）：

```bash
dsh plugin --profile <你的profile名> add https://github.com/shuxidemosheng/dsh-tool-todo-plus.git
```

### 方式三：桌面端插件页

打开 dsh 桌面端 → 侧边栏「插件」→ 添加插件 → 粘贴仓库地址 `https://github.com/shuxidemosheng/dsh-tool-todo-plus` 或选择本地 tgz → 安装（失败会自动回滚）。同样需要先完全退出应用。

### 方式四：源码构建

```bash
pnpm install
pnpm build        # tsc + esbuild：产出 lib/index.js（宿主半）与 lib/client.js（客户端半），并打 eval 补丁
npm pack          # 产出可安装的 tgz
```

要求：Node.js ≥ 24。

## 配置

在 `cordis.patch.yml` bundle 行的 `config` 里设置（仓库自带的 patch 已按桌面端推荐值配置）：

| 字段 | 默认 | 说明 |
|---|---|---|
| `allowParallelInProgress` | `false` | 是否允许多个任务同时 `in_progress`。`false` 为单活跃纪律（同 ZCode），多标即拒绝；`true` 适合有并行工作的部署（subagent、后台命令、workflow fan-out） |
| `toolName` | `'todo_write'` | 注册的工具名。桌面端等使用 agent preset 的部署无法禁用官方 `tool-todo` 行，设为 `'todo_write_plus'`（本仓库默认）可与官方共存 |

## 兼容性说明

- 官方持久化 invariant 只校验 `content`/`status`，不拒绝 `priority` 字段；官方投影 schema 剥离未知键——带 `priority` 的条目在官方组件眼中只是普通条目，双向兼容
- 投影 key（`todos`）与折叠语义和官方逐字一致，`stateVersion` 保持 2：官方写出的旧 checkpoint 在本插件下照常通过校验
- 官方在消息区自带一个内联任务面板（由官方客户端渲染，不显示 `priority`）；优先级在工具结果与本插件浮窗中可见

## 已知限制

- 浮窗的"实时写入自动弹出"以会话边界后的 **2 秒静默窗口**区分历史回放与实时写入：若单个会话的历史恢复超过 2 秒，尾部仍可能误弹一次（手动关掉即可）
- 桌面端 agent preset 声明的官方 `tool-todo` 行不受 profile 补丁控制，因此默认共存而非替换
- 浮窗不显示在会话界面之外（设计行为）

## 安全

- **零运行时 npm 依赖**：宿主半与客户端半均为自包含产物；客户端仅使用平台模块表提供的 `react` / `react-dom`
- **无副作用面**：客户端半无任何网络请求、无 localStorage 写入、无 `eval` / `innerHTML`；宿主半只注册工具与投影、向会话日志追加事件，不触文件系统与网络
- **渲染安全**：浮窗全部走 React 文本节点（自动转义），任务内容不会被当作 HTML 执行
- **参数过滤**：工具入参经 schema（enum + `additionalProperties: false`）与运行时校验双层过滤，只落白名单字段
- **无 eval 产物**：构建管线内置 [`scripts/disable-eval.mjs`](scripts/disable-eval.mjs)，移除内联 Schemastery 字符串回调的动态执行点（本插件不使用该机制），产物中无任何 `new Function` / `eval`
- **Mimosa 深度安全扫描通过**：0 发现、0 依赖风险（覆盖完成）
  - scanId：`scan-2026-10-03T06-47-56.770Z-9be5a02256b7`
  - 封印：`sha256:0fd37bad7781d75485688ac93b4bcdb34df0459bf245fafbbdaa19e65d47c22a`

## 上游致谢

本插件是 [`@deepseek-ai/dsh-tool-todo`](https://github.com/deepseek-ai/deepseek-harness) 的增强 fork：持久化事件、投影折叠语义与并行策略沿用上游实现，浮窗的胶囊优先级链移植自 ZCode 计划面板（[zai-org/ZCode](https://github.com/zai-org/ZCode)）的行为逻辑。上游以 [MIT](./LICENSE) 许可发布。

## 许可证

[MIT](./LICENSE)
