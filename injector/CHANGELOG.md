# Changelog

本项目版本与仓库提交对应，格式参照 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

> **版本以 git tag 为准**：已发布 v0.3.1 / v0.3.3（GitHub Releases 资产）；未打 tag 的
> 小节为开发史（其内容随下一个发布一并交付）。

## [未发布] — 2026-11-18（DSH 0.2.1-rc.2 / macOS 兼容修复）

### 变更（Creator-mode 重审：脚手架产物改成标准 bundle，双通道可装）

- **`dev_scaffold_plugin` 现在发标准 bundle**：此前只写 `dsh.client`、**从不写
  `dsh.bundle`、也不生成 `cordis.patch.yml`** ⇒ 产物**两条通道都走不通**：官方
  `dsh plugin add` 把它当普通依赖（CLI 只打一行 warning、entry 永不被装配），
  `plugin_manager{install_bundle}` 直接 `not-bundle`（`plugin-manager/lib/index.js:2074`），
  只有注入器能吃下它。现在四种形态统一发 `dsh.bundle.patch` + `cordis.patch.yml`
  （`- insert:` 一行同名 entry）+ `files` 白名单，一个产物同时支持
  **持久装配**（`dsh plugin add` / 插件页）与**运行时注入**（`dev_inject_plugin`）。
- **补展示资源**：新增 `locale/en.json`（`meta.title` / `meta.description`——官方
  inventory 的标题/描述就来自这里，缺了显示裸模块名）与 `icon.svg`（占位图标，
  官方要求 SVG/PNG/JPEG/WebP 且 <256 KiB），并在 `exports` 暴露 `./locale/*.json`
  与 `./icon`。与 Creator 预置技能 `cordis-plugin-development` 的展示清单对齐。
- **静态引导改写（前缀缓存去冲突）**：`systemPrompt.context` 那段原文把
  `dev_plugin_status → … → dev_uninject_plugin` 写成"从零体验唯一路径"，与同一
  前缀里 Creator 技能的"author a bundle → `plugin_manager`"叙事**互相打架**
  （两条通道叙事 ⇒ 注意力稀释 + 选错通道：持久安装本不需要 build）。现只声明
  **不可替代的运行时能力**并显式让出持久安装：注入/热重载/卸载/`dev_stage_*`
  归 dev_*，持久安装/启停/卸载归官方装配层。
- **工具描述与产物 README 同步**：`dev_scaffold_plugin` description 说明双通道，
  生成物 README 给出 3a 持久装配 / 3b 运行时注入两条下一步。
- **回归锁**（`tests/scaffold-bundle.test.mjs`）：① package.json 必发
  `dsh.bundle.patch`（禁止退回 client-only 分支）；② 必须真写出
  `cordis.patch.yml` / `locale/en.json` / `icon.svg`；③ `files`/`exports` 覆盖新产物
  （防 `npm pack` 丢文件）；④ 已构建 `lib/index.js` 必须与 src 同步（陈旧 lib
  ⇒ 运行中的注入器仍发旧模板）。

### 实测（DSH 0.2.1-rc.2，一次性 `DSH_HOME`，本机 `~/.dsh` 与 3080 未受影响）

`dev_scaffold_plugin` → `dev_build_plugin` → `dsh plugin --profile web add <目录>` →
`--dump-config` 出现 `- id: scaffold-check-tool2` → 起 `dsh web`：**无
`did not activate` / `failed to import` / `ERR_MODULE_NOT_FOUND`**。toolkit 与
ui-panel 两种形态都通过（ui-panel 的 `lib/client.js` 亦产出）。产物 host 为零
非 `node:` 外部依赖的自包含 bundle——这也是 link: 安装这次不再报裸说明符的原因。

### 文档同步（剪枝遗留的漂移）

- `preset/README.md`：删掉指向已移除工具 `dev_reload_preset` 与 `.agent-presets/`
  平铺复制的用法段（0.2.1 已不读该目录），改成 bundle 生成 + `dsh plugin add` + 重启
  的真实链路，"血泪"第 1 条随之更正为「`.agent-presets` 已死」。
- `preset/docs/FEEDBACK-v34.md`：两处落地清单里的 `dev_reload_preset` 换成
  「重新生成 bundle 并重装」。
- `injector/README.md`：工具全家桶表补齐 6 个缺失条目（`dev_heal_links` /
  `dev_fix_patch` / `dev_scaffold_plugin` / `dev_build_plugin` / `dev_release_plugin` /
  `dev_self_test`，共 17 个）；新增**「与 DSH 内置 Creator 模式的分工」**小节
  （安装时/装配时 vs 运行时，含"官方无法删运行时条目"等实测边界）；生态定位表加
  Creator 模式一行；设计原则补第 2 条「不抢官方的活」。

### 上一轮（同日期）变更保留如下

### 变更（UI 对齐 DSH 设计体系）

- **设置页面板重写为原生观感**：旧实现用 `--theme-border/--theme-text/--theme-accent`
  等变量——这套变量在 DSH 0.2.1 里**根本不存在**（全站只有 `--dsw-*`），每个
  `var(--theme-x, #深色硬编码)` 都静默走兜底 ⇒ 浅色主题下整页发黑；叠加等宽字体、
  1.5px 边框、6px 圆角、手写 `.st.on/.st.off` 药丸，与原生设置页明显不是一套。
  现改为：
  - 全部走 `--dsw-*` 设计 token（`--dsw-alias-label-*` / `--dsw-alias-settings-card-*`
    / `--dsw-radius-*` / `--dsw-alias-state-*`），`.5px` 细线、卡片行、
    `color-mix` 淡底——与官方「插件」页同款配方；
  - 使用平台 UI 原语 `@deepseek-ai/dsh-client-ui-primitives`（seed 模块：
    `Button` / `Input` / `Tag` / `StateDot` + 官方图标），不再手搓按钮药丸；
  - 结构与官方 section 同构：`h2` 18/600 + 13/20 三级灰说明 + 状态行 + 卡片列表；
  - 样式按官方模式注入一次（`style[data-plugin-css]` 去重守卫）。
- **页面语义收敛为「注入插件」**：持久安装/启停由官方侧栏「插件」页承担，
  本页只负责官方看不到卸载入口的**运行时注入条目**。
- **60s 常驻轮询移除**：改为挂载时拉取 + 操作后刷新（减少空转请求）。

### 移除（DSH 0.2.1 已覆盖，避免双实现漂移）

- `dev_reload_preset`：**死代码**——它改写 `~/.dsh/.agent-presets/<id>/agent.cordis.yml`
  的 `?v=N`，而 0.2.1 已不再读该目录（官方 skill 明写 "Nothing reads that directory
  any more"，本机该目录也不存在）。预设现在是 bundle 里的 `@deepseek-ai/dsh-agent-preset`
  声明行，由设置页「Agent 预设」/ patch 编辑 + HMR 重组承担。
- `dev_install_package`：官方 `plugin-manager` 的 `installBundle` 做同一件事且更完整
  （pnpm 语义 + 失败回滚 package.json/lockfile + 引擎/peer 兼容拒绝 + 取消/重试 +
  `hmr.reconcileProfile` 热应用）。替代路径：侧栏「插件 → 添加插件」、
  `dsh plugin --profile web add <spec>`、Creator 预设的 `plugin_manager{install_bundle}`。
  （本部署 `tool-plugin-manager` 默认 disabled，故 agent 侧改用 CLI/预设。）
- `startIngest` + `POST /super-injector/api/ingest`：官方「添加插件 ▸ 让 agent 创建插件」
  （Creator 预设 + `cordis-plugin-development` skill）覆盖该流程，且产出是 bundle，
  能被官方安装器管理；手搓会话 seed 的版本反而产出非 bundle 包。
- **进程级 `unhandledRejection` 常驻兜底**：它把**任何**插件（含 DSH 自身）的逃逸
  rejection 都降级成日志，等于把致命 bug 静默掉（代码注释里也承认）。`dev_stage_call`
  的**调用窗口内**捕获保留（安全、只影响自身）。

### 修复（合并上游 PR）

- **patch 去重锚定顶层列（上游 #6）**：`scripts/fix-patch.mjs` 与宿主内联
  `extractPatchBlocks` 的 `- id:` 正则都**没有锚点**，`- insert:` 块里**缩进**的
  子条目会被当成顶层条目，与同 id 的顶层 config 块判重后把后者删掉——实测事故是
  web profile 里 dsh-vision 的 baseURL/model 被吃掉，`view_image` 回落到错端点报
  401。现顶层只认第 0 列，缩进条目按 nested 分桶，二者同名共存。
  顺带修同族的两个缺陷：①声称"保留最后一条"实际保留第一条（loader 是顺序覆盖
  语义，必须留最后）②重写一次文件头注释就永久丢失（提取器丢弃顶格注释）。
- **`dsh plugin` 装出来的包缺 `injector/lib`（上游 #105 不足，本轮补 `.npmignore`）**：
  嵌套 `injector/.gitignore` 的 `lib/` 会覆盖根 `files` 白名单，`npm pack` 打出
  10~11 个文件但没有 `lib/`，而根 `main` 指向 `./injector/lib/index.js` ⇒
  `dsh plugin add github:…` 装上一个加载即炸的包。新增 `injector/.npmignore`
  （目录级 .npmignore 取代 .gitignore），实测 17 个文件、`injector/lib/index.js`
  到位，根测试 `test/injector-package-json-shipped.test.mjs` 由红转绿。
- **脚手架模板产出的面板开箱即空白（上游 #45 同题，本轮重写）**：
  `dev_scaffold_plugin` 的 ui-panel / hybrid 客户端模板仍在生成
  `component: () => ({ render() {...} })`（0.1.x 实例工厂）⇒ 在 0.2.x 上 React
  拿到纯对象 ⇒ 每个脚手架产出的面板都"出生即空白"。模板改为 React 组件 +
  `ctx.slots.register(descriptor, Panel)` 位置参数，并加了断言锁住（防回潮）。
- **`scripts/fix-patch.mjs` 忽略 `DSH_HOME`**：它硬写 `~/.dsh/profiles`，隔离
  测试 / 多实例部署会改错文件。改为 `DSH_HOME || ~/.dsh`（与宿主一致）。

### 修复（无 DSH 源码检出的机器上产线全断）

- **构建依赖三级回退**：`build.sh` 原本硬性要求 `DSH_CHECKOUT`（源码检出），
  本机只有 npm 全局安装的 dsh ⇒ `dev_build_plugin` / `dev_self_test` 第一步就死，
  脚手架产线整体不可用。现按 ① DSH_CHECKOUT 源码检出 ② 本目录 `npm install`
  过的 node_modules ③ **已安装的 dsh 本体**（自带全部 `@deepseek-ai/*` 与
  `@types/node`，且与运行时同版本）依次回退；tsc 缺失时用 `npx -p typescript`
  拉（与既有 tsdown 回退同一策略）。`scripts/build.sh` 与脚手架内嵌模板同步改，
  `dev_build_plugin` 不再在 checkout 缺失时直接拒绝。
- **自检测试插件改为零依赖**：原测试插件 `import { defineTool } from
  '@deepseek-ai/dsh-tools'`，而宿主用 `import()` 直接加载插件入口、裸说明符按
  插件目录解析 ⇒ 注入的临时目录里没有完整依赖闭包（连带 `dsh-scope`）⇒
  在 0.2.1 上必然 `ERR_MODULE_NOT_FOUND`，自检把「注入」判 FAIL。自检要证的是
  注入/重载/卸载链路，不是工具注册，故入口只导出 `name`/`apply`、零 import；
  工具注册路径由 `dev_stage_*` 覆盖。自检从 0/1（checkout 门）→ **9/9 PASS**。
- **自检不再自带一份 build.sh**：它曾内联一份精简版（只认 DSH_CHECKOUT），与
  脚手架模板双源漂移；现直接复用 `SCAFFOLD_BUILD_SH`。

### 修复（脚手架产物在 0.2.1 上加载不了 —— 闭环断裂）

- **脚手架/构建改为 tsdown 打包 host（不再只留 tsc 产物）**：宿主用 `import()`
  直接加载插件入口，`@deepseek-ai/*` 是裸说明符、按**插件自身目录**解析；而
  注入/官方 link 安装的目录里没有 peer 依赖闭包（`dsh-tools` 自己还依赖
  `dsh-scope`/`dsh-brand`/`dsh-sandbox`…）⇒ tsc 产物加载即 `ERR_MODULE_NOT_FOUND`，
  实测整条链路 `dev_scaffold_plugin → dev_build_plugin → dev_inject_plugin` 每一步
  都报 `host ✗`。现改为 tsdown 打包成**自包含 bundle**（`node:` 内置保持 external；
  UI 仍 CJS + `__ModuleLoader__` 包装、`react` 等 seed 保持外部）。实测：
  toolkit / ui-panel 两种形态 `host ✓`、`client ✓`。
- **依赖物化改为完整闭包**：回退路径原只接 7 个顶层包，导致 tsdown 打包时
  `dsh-scope` 等传递依赖解析不到、被当成 external 留在产物里。现整目录
  link/copy 已安装 dsh 的 `node_modules/@deepseek-ai`（运行时同版本闭包）；
  优先 symlink（构建期只读、避免 GB 级复制），无符号链接权限时回退 copy。
- **typecheck 降级为 advisory**：客户端类型依赖 `react` /
  `@deepseek-ai/dsh-client-ui-slots` 等**前端 seed 模块**的类型包，本地回退里
  没有（只有完整源码 checkout 才齐）。类型缺失不再阻断构建（tsdown 打包不需要
  类型，运行期由宿主 seed 解析），完整 checkout 上仍可 `npm run typecheck`。
- **自愈 touch 注释不再永久污染 patch**：自愈靠 touch patch 文件触发
  `include.refresh`，旧实现每次重试都 `appendFileSync('# super-injector heal <ts>')`
  且从不清理 —— 实测用户 `cordis.patch.yml` 尾部堆了 7 行孤儿注释。现注释为
  **临时**标记（成功/失败后删除），并在装配时 `purgeHealMarks()` 清扫漏删的
  （宿主在 3s 验证窗口内被重载时会漏）。

### 新增（回归锁）

- `tests/client-render.test.mjs`：读**构建产物** `lib/client.js`，在 ModuleLoader 包装下
  求值 + jsdom 真挂载，锁三件事：①注册的是 React 组件而非 `{render()}` 工厂
  （空白页病案 ①）②DOM 有列表行/状态标签/卸载按钮（空白页病案 ②）
  ③样式表**只含 `--dsw-*`**、不得出现 `--theme-*` 与等宽正文字体（本次视觉脱轨）。
  另覆盖空列表分支。devDependencies 增 `react` / `react-dom` / `jsdom`（仅测试用）。


> 同步上游 main（v0.3.6 线）后，在 DSH 0.2.1-rc.2 + macOS arm64 上实测定位并修复。

### 修复

- **设置页「插件」空白（DSH 0.2.1 UI 契约，实机定位）**：`settings.section` 的
  `component` 在 0.2.1 必须是 **React 组件**——shell（ui-settings-general）经 renderSlot
  用 `jsx(Comp, props)` 挂载（renderer 无任何旧形态兼容分支）。旧实现 `component: () =>
  ({ render() {...} })` 是 0.1.x 实例工厂形态：React 调用后得到纯对象 →
  "Objects are not valid as a React child" → 页面空白。已重写
  `src/client/index.ts` 为 React FC（`useState/useEffect/useRef`，无 JSX），注册改
  官方双参形态 `ctx.slots.register({...}, Component)`，功能不变（列表/加载统计/卸载/
  路径注入/内化/拖放提示/60s 轮询）。验证：ModuleLoader 包装下 bundle 求值 +
  react-dom/server `renderToString` 输出 2319B 有效 HTML（含全部 UI 文案）。
  > 溯源：上游 1952733 已有同契约修复（`1aa12ad`，DOM useEffect 桥 + label 改
  > 「插件管理」）；本次 sync 用 injector 仓库旧快照覆盖了 injector/，把该修复
  > 一并回退成 0.1.x 实例工厂形态——空白页是 sync 回归，不是原设计缺实现。
  > 现实现保留官方契约与 label「插件管理」，内部为原生 React 元素（非 DOM 桥），
  > 行为与原设计一一对应。
- **POSIX symlink 删除（macOS/Linux 硬 bug）**：删 profile 链接 / 链接自愈 / 构建物化 / stripLinks
  处一律 `rmdirSync`。Windows junction 是目录语义可行，POSIX symlink 会 `ENOTDIR` ⇒
  卸载删不掉链接、自愈重建报 `EEXIST`、构建报 `ERR_FS_CP_EINVAL`。改为
  **`unlinkSync` 优先、失败回退 `rmdirSync`**（两者都不递归进目标）。
- **release 形态 `npm test` 变绿**：`tests/dangle.test.mjs` 依赖 `lib/watch-dangle.js`，
  而 tsdown 只产出 `lib/index.js`。tsdown 配置增加 `watch-dangle` 入口，发布构建也产出该模块。
- **锁文件重新生成**：上游 0.3.6 的 `package-lock.json` 钉了公网已 404 的
  `@deepseek-ai/dsh-type-meta@0.0.1-rc.1`，导致 `npm install` 直接失败、prepare 被跳过。
  已重新生成锁文件（`npm install` + 自包含 bundle 验证通过），不再引用该版本。

### 修复（0.2.1 loader 契约：自重载不再需要重启）

- 0.2.1 的 loader entry **没有 `_dispose`**（`cordis-plugin-loader`/`dsh-*` lib 中 0 处），旧自重载
  分支直接抛 `selfEntry 无官方 _dispose（loader 契约缺失）`，只能靠自愈（touch patch /
  `loader.create`）复活。现增加官方替代路径（`typeof entry._dispose !== 'function'` 时启用）：
  - `entry.parent.remove(entry.id, true)` —— 只 dispose 旧 fiber、保留 options 行
    （`group.remove(id,isDispose)`，返回 `void`，不要再当 Promise 用）
  - `await oldFiber.dispose()` —— 等旧纤维真正下落，再建新纤维（避免工具/服务重复注册）
  - **清 `entry.options.disabled`** —— 实测坑：loader 的 `internal/plugin` 监听会在纤维卸载时
    把 `options.disabled = true`（防幽灵复活）；不清就直接 `create` ⇒ `update()` 在 disabled
    早退：无 fiber、无报错、apply 不跑（表面成功、实际注入器已死）。
  - `entry.parent.create(entry.options)` → **验收 fiber 必须 active**，否则抛错落 heal（绝不假绿）。
- **验证**：隔离 `DSH_HOME` 启动探针插件（`@probe/hot-reload`）实测 remove→dispose→清 disabled→
  create：同 id 重建、fiber 208→242、apply 再执行一次、entries 仍为 1（PASS）。
- **顺带修 `npm run typecheck`**：`cleanupStaleEntries` 里把 `group.remove()`（`void`）当 Promise
  测 truthiness / `.then` 的 3 处报错（TS1345/TS2339）已按 `unknown` + thenable 探测改写，tsc 干净。
- 仍建议：注入器代码升级后若自重载遇到异常，看 `self-heal.log` 的 `reload-official`/`reload-ok`
  记录；正常时不再需要重启宿主。

## [未发布] — 2026-10-15（Desktop 实测：profile 错位 + loader.internal 缺失）

> 本次三处修复均在 DSH Desktop（profile `desktop`、loader 1.0.5、宿主未开
> `--expose-internals`）实测定位并验证。改动落在 `src/index.ts` 与 `scripts/build.sh`。

### 修复（缺陷 A：profile 名硬编码 'web' ⇒ 注入全部失效）

- **根因**：源码把 profile 名写死为 `'web'`（`join(dshHome,'profiles','web','node_modules')`），
  且宿主进程**没有** `DSH_PROFILE` / `DSH_PROFILE_DIR`（实测均为 null，另加桌面端走的是
  `profiles/desktop`）⇒ junction 全建到 `web` profile，当前进程的 loader 看不到 ⇒
  `dev_inject_plugin` 恒报 `host ✗`。
- **决定性证据**：同一插件、同一条注入命令，先在 `profiles/desktop` 手工建好 junction
  后 `host ✗` → `host ✓`、entry 转 `phase 2 = ACTIVE`；根因唯一。
- **修复**：新增 `deriveProfileNodeModules()`，按 **`ctx.baseUrl`**（loader 自己就按它解析，
  实测值 `file:///C:/Users/<u>/.dsh/profiles/desktop/`）→ `DSH_PROFILE_DIR` → `DSH_PROFILE`
  → 唯一 profile 目录 → `'web'` 兜底 的顺序推导；并用 `currentProfileName()` 统一
  `dev_install_package` 的缺省 profile。
- **同族修复**：`readProfileBundles()` 原也写死 `profiles/web/package.json`（读到的是
  **另一个 profile** 的 bundles，防重护栏判错）⇒ 改为跟随当前 profile。

### 修复（缺陷 B：loader.internal 恒 undefined ⇒ 重载/自检/清单全线不可用）

- **根因**：loader 1.0.5 的 `ModuleLoader.fromInternal()` 需要 `--expose-internals`；
  宿主 `execArgv` 为空 ⇒ `ctx.loader.internal` **恒为 undefined**。而插件多处裸用
  `ctx.loader.internal`，其中 `listPlugins()` 用非空断言 `internal!` ⇒
  `dev_plugin_status` 整个工具崩（`Cannot read properties of undefined (reading 'loadCache')`）；
  `reloadPackage()` 首行直接 return `loader.internal 不可用` ⇒ 热重载/自重载/预检全废
  —— **连"自重载自修复"这条唯一能免重启修自己的路都被堵死**（必须重启宿主）。
- **修复**：①`listPlugins()` 改可选访问（拿不到缓存只少一行 entry 路径，清单照常输出）；
  ②`reloadPackage()` 改为**无缓存降级**：用空 Map 替身让 purge/backup/restore 退化为
  no-op，并以 `?v=<时间戳>` 的 cache-busting URL 强制重读磁盘（loader 的 `import` 在
  internal 缺失时会回落原生 `import`，见 loader `lib/index.js:214-227`），重载链路继续可用。

### 修复（build.sh 链接名与源码 import 不一致 ⇒ 编不出 lib）

- 提交 `1df6cde` 把源码 import 从裸名改成 scoped（`@deepseek-ai/cordis` 等），但
  `scripts/build.sh` 的 `link_pkg` 仍链裸名 `cordis/cosmokit/schemastery`，且缺
  `@deepseek-ai/dsh-llm` ⇒ `tsc` 直接报 6 个 `TS2307`，`lib/` 编不出来。
- **修复**：链接名与 import 说明符逐字对齐，并补 `@deepseek-ai/dsh-llm`。
- 另修 HEAD 上既有的 `TS7006`（`dev_install_package` 的 `execute(args)` 缺标注）。

### 验证

- 修复后 `lib/index.js` 正常产出、`node --check` 通过、`import()` 成功
  （导出 `name/Config/apply/inject` 齐全）。
- `deriveProfileNodeModules` 实测对 `ctx.baseUrl` 推出的 `node_modules` 与期望值
  **逐字相等**；`readProfileBundles` 实测读到 desktop 的 15 条 bundles。
- ⚠️ 已知环境限制：本机 `F:\dsh-ide` / `dsh-harness` 均为**未构建**源码检出，
  且 app 运行时包**不含 `.d.ts`**（类型被剥）⇒ 无法在本机做到零 tsc 错误的完整
  type-check；本次以"产物正确 + 可加载"为验收判据。`dev_self_test` 的
  「测试插件构建」项依赖一个**已构建**的 checkout 才能全绿。

### 修复（依赖目录被掏空后无法自愈 —— isHealthyLink 误判）

- **症状（实测）**：插件自身依赖的 4 个 junction 目标被清空（`items=0`，时间戳集中在
  同一秒），随后 `import()` 直接失败：`Cannot find package ...\dsh-tools\index.js`。
- **已证实的缺陷**：`isHealthyLink()` 只做 `readdirSync(p)` 判"能读目录即健康"，
  而**目标被掏空时 readdirSync 仍然成功（返回 []）** ⇒ 空目标被误判为健康
  ⇒ 断电/异常后的自愈 **永不重建** ⇒ 依赖静默坏掉，直到加载失败才暴露。
  - 实测判据：造一个"空目标 junction"，旧实现返回 `true`（错误），修复后返回 `false`。
- **修复**：判据收紧为 `readdirSync(p).length > 0`——**空目标 = 不健康、必须重建**
  （空目录对"包链接"而言绝不可能是可用状态）。
- **未证实的部分（如实记录）**：**没能复现"掏空动作本身"**。逐一实测了 5 种删除形态
  （`rmSync(junction,{recursive})` 跨卷/嵌套/链式/父目录递归、同卷三段 junction 链）
  与全部 4 个删除 API（`rmdirSync` / `unlinkSync` / `rmSync` rec·非 rec），
  **目标全部完好**——即在本机 Windows + Node 24 上这些调用都是安全的。
  故本次只修"**坏掉之后无法自愈**"这一已证实环节，掏空的**触发源仍未定位**
  （时间上只与 `dev_self_test` 同秒，属相关而非因果，不足以定罪）。

### 加固（链接清理改为"绝不递归进目标"）

- 新增 `removeLinkOnly()`：**链接只用 rmdir/unlink**（语义上仅删链接、不触目标），
  仅真目录才递归删。替换了注入路径与自检兜底路径里的
  `rmSync(linkDir, { recursive: true })`。
- 理由：本机实测该调用**确实安全**（5 种形态都未删穿目标），但它是**依赖目录的唯一
  清理通道**，而"递归删能穿透 junction 删掉目标内容"是 Windows 上的长期已知坑——
  一旦踩中就是静默毁依赖。改为按类型分派后，这类风险在语义上被消除。

## [0.3.3] — 2026-08-15（已发布，git tag v0.3.3）

### 更新（高性能引导升级为 P1-P23 完整认知）

- **规范铁律 7 条 → 10 条**：新增「近距离信号原则」（所有行为引导必须在用户消息之后注入，远距离同指令衰减甚至反向——P13/P14/P20）、「弱域内路由」（模糊任务交模型自分类，按模型选 persona——P8/P11）、「单任务长链路三锚」（回顾+收敛+反跑题，完成率 0%→100%——P22/P23）
- **缓存原则强化**：system 前缀任何动态变化 = 全量缓存 miss（命中便宜 10 倍）；固定文本引导保持 92-94% 命中
- **高性能引导认知表**：首轮锚定 / 近距离引导 / 弱域内路由 / deep-guide / 单任务三锚 / plan-mode 保留——六机制落地方式与实测数字
- 参考链接更新：[dsh-router-standard](https://github.com/yjh051108/dsh-router-standard) v0.1.0（含论文与 P1-P23 全数据）

### 验证

- v0.3.3 为**实装发布**（含 lib 变更，非文档-only）：注入器自检 8/8 PASS（测试插件构建 /
  注入 host ✓ / 热重载 uid 变化 / 自重载节流 / 预检拦截 / lib 恢复 / 卸载即净 / patch 写入
  合法性），Windows 官方装配路径实测
- 历史说明：v0.3.1 之后至 v0.3.3 之前的提交（0.3.2 特性、0.3.3 文档、patch 去重）未单独打
  tag——v0.3.1 的 Release 资产含其中部分内容，完整内容随 v0.3.3 交付

### 修复（v0.3.3 实装：Windows 装配实测三 bug + 自包含打包）

- **writePatch/extractPatchBlocks 粘连 bug（patch 串位）**：条目块后的顶格注释被并入前一块，
  块间重写无换行 → 注释与下一 `- id:` 粘连成一行，`disabled: true` 错挂上一条目（实测：
  卸载自检插件后注入器行被禁用）。修复：每块保留行尾换行、顶格注释单独成块，块间 join 不再粘连
- **DSH_HOME 优先（homedir 错家）**：web 进程 homedir 与 DSH_HOME 不一致时（如服务账户/
  跨用户部署），registry/profileNodeModules/日志全错位，junction 建到错误 profile → loader
  找不到包。修复：`process.env.DSH_HOME || homedir()/.dsh` 统一路径（scaffold 模板同步）
- **自检 tmpDir 去硬编码**：移除自检临时目录的硬编码个人路径（盘符/用户名不再出现），改 DSH_HOME 下
  稳定目录；`reloadPackage` 磁盘降级改 import **realpath URL**（junction URL 会被 tsx 旧缓存
  命中，tmpDir 迁移后重载失效——实测 uid 不变）
- **findBash 拒绝 WSL**：Windows 装 WSL 时 System32\bash.exe 抢先 PATH 命中，构建必挂
  （"适用于 Linux 的 Windows 子系统没有已安装的分发版"）。修复：Git/PortableGit 路径优先，
  PATH 探测结果含 wsl 标记即拒绝
- **宿主自包含打包（issue #1 根治）**：tsdown 新增 host bundle，把 @deepseek-ai/dsh-tools /
  schemastery 等运行时依赖打进 lib/index.js——官方装配（`dsh plugin add <目录>`，link: 依赖
  不装 peers）不再出现 `Cannot find package '@deepseek-ai/dsh-tools'`，任何装配路径均可加载
- **杂物清理**：移除源码中的个人引用（engram 注释/默认匹配名）、`dev_reload_package` 描述
  不再带默认插件名；`Config` 显式标注（junction 依赖下 declaration 报 TS2742）
- 自检 8/8 PASS（含 patch 写入合法性 + 热重载 uid 变化）

## [0.3.2] — 2026-08-15

### 新增（高性能引导：首轮锚定 + 工具 schema 精简）

- **骨架模板自带高性能引导**：`dev_scaffold_plugin` 生成的 toolkit 骨架头部注释新增两条
  高性能铁律（工具 schema 精简——description 短句化、详解不进 schema；首轮锚定——工具面
  ≥5 时首轮只露核心 1-2 个、首个 `tool/call` 后恢复全部），`apply()` 末尾附**可启用的首轮
  锚定实现块**（`system-prompt/assemble` Waterfall 过滤器 + `agent.session.events` 持久化
  推导晋升，resume 安全，只裁剪本插件工具）
- **README 规范铁律 5 条 → 7 条**（新增「首轮锚定」「工具 schema 精简」），新增
  「高性能插件（首轮锚定 · 为什么 & 怎么做）」小节：原理、三步启用、session JSONL 验证法
- **SPEC 铁律 6 条 → 8 条**，新增第 6 节「性能引导契约」：事件契约（Waterfall 必须
  `await next()`、`agent` 判空、晋升从持久日志推导、工具执行失败也算晋升）、过滤边界
  （只裁剪本插件工具）、成本模型（首轮无缓存 prefill 全量计费、17.6 万字符实测、schema
  面 vs 文本内容的微探针证据）

### 参考与致谢

- 首轮锚定机制源自 **xiaobright** 的
  [`dsh-anchored-standard`](https://github.com/xiaobright/dsh-anchored-standard)
  （MIT，两阶段锚定 preset 与 `tool-bootstrap.mjs` 实现，Project2 实测 98/99）
- 原理分析与统计证据来自 **xiaobright** 的
  [`modeltest`](https://github.com/xiaobright/modeltest)（V4.1b，frozen：
  harness 对照分析 / 触发机制实验 / 轨迹统计）

### 验证

- tsc 编译通过；新骨架实测：`dev_scaffold_plugin` 生成文件含铁律注释与锚定块
- 运行副本（cloud-restore 云源自举）同步 `lib/` 后自重载，前后均 active

## [0.3.1] — 2026-08-14

### 修复（pixel-forge 事件根治——坏 client 挂死 HARNESS）

- **autoRestore 恢复前 client 校验**：坏 client 插件（缺 inject）恢复时**跳过 + 审计**（此前恢复路径无校验——坏插件在 registry → 新会话启动 → client apply 失败 → 整个 HARNESS "Failed to load plugins"——用户被迫手动修）
- **校验正则兼容单双引号**：用户手修的双引号 `inject = ["slots"]` 被误判为"缺 inject"的 bug
- **clientSkeletonProblems 公共化**：注入阻断 / 恢复跳过共用同一校验逻辑（一条防线两处生效）

### 新增

- 注入前 client 骨架校验升级（v0.3.0 并入）：同时检查编译产物 lib/client.js（只有 lib 无 src 不绕过）+ 缺 inject 阻断注入

### 验证

- 双引号 inject 假插件注入通过（不误判）
- 坏 client 假插件注入阻断
- 自检 8/8 无回归

## [0.2.6] — 2026-08-14

### 修复

- **watch 自动重载前预检**（用户反馈"太自由容易自杀"）：build 半途/改错导致的损坏 lib 不可加载时**拒绝自动重载**（旧代码继续运行）+ `watch-precheck-blocked` 审计——与手动自重载的预检拦截同一道防线。实测：music-forge 构建半途被拦一次，build 完成后正常注入
- **systemPrompt.context 重复注册容忍**：自重载 rebuild 不再因 `duplicate` 整体 failed（此前导致注入器死亡 + 自愈 3 连败）
- **恢复路径验证**：注入器 failed 后用 **touch patch（include.refresh 进程内重装配）复活**——免杀进程的"延迟重启"（实测 6 秒恢复 + 自检 8/8）

### 兼容

- **DSH 0.1.0-rc.6（正式开源版）验证通过**：注入器一行未改直接运行，自检 8/8；peerDeps 范围声明（`>=0.0.1-rc <2`）在 rc.5 → rc.6 升级中实证"升级不报废"

## [0.2.4] — 2026-08-13

### 修复

- **发布包可独立安装（实测验证）**：tgz 增加 `scripts/build.sh`（此前 `files: ['lib']` 未带构建脚本）——解压副本此前缺 node_modules 依赖链接，`dsh plugin add` 后 `ERR_MODULE_NOT_FOUND` 装不上。现在解压后 `DSH_CHECKOUT=<checkout> bash scripts/build.sh` 即可建依赖链接。**实测**：下载 v0.2.4 tgz → 解压 → 建依赖 → 重启 → 注入器从云端副本加载并工作（自举验证通过）
- **自重载降级匹配用 realpath**：缓存无匹配降级从磁盘加载后，按包名重新匹配会失败（副本目录如 `cloud-restore` 不含包名）——改 `realpathSync(lib)` 匹配 loadCache 真实 key（实测：云端副本自重载链路修复）

### 质量

- 云源自举实验：卸载本地注入器 → 下载 GitHub release 副本 → 装配 → 运行中注入器 = 云端版（entry URL 指向副本），工具/自检全部可用

## [0.1.0] — 2026-08-12

### 新增

- **超级模组注入器**：运行时注入任意本地 DSH 插件包（junction 链接 + `loader.create`，不碰 patch / package.json / bundles 列表、不重启进程），注入清单自动恢复（`~/.dsh/super-injector/registry.json`）
- **热重载全家桶**（融合 dsh-bundle-hmr）：`dev_reload_package` 整包重载（清缓存 → 重新 import → 重建 fiber，失败回滚保留旧代）、`dev_plugin_status` 装配清单、`dev_install_package` 双路径安装（profile package.json + junction + loader.create）
- **卸载器**：`dev_uninject_plugin` 卸 loader entry（fiber dispose 全清理）→ 清注入清单 → 删 junction，免重启；引导器自身受保护不可卸载
- **路由残留自愈**：`dev_clear_routes` 直捣 webserver 内部路由表（exact/prefixes/upgrades），按 path 前缀删除孤儿路由，插件热重载残留 `duplicate route` 免重启即可清除
- **强制登记守卫**：`reloadPackage` 重建失败若报 `duplicate / already registered` → 判定未登记裸注册 → 明确报错（要求插件把资源注册挂 `ctx.effect`）+ 自动清理残留路由
- **开发侧挂区（staging）**：测试/开发工具挂"后侧"不进 tools schema（缓存零污染），`dev_stage_call` 测试、`dev_stage_promote` 一键转正（唯一一次缓存刷新）、`dev_stage_demote` 撤回——杜绝开发期工具波动打穿 DeepSeek 前缀缓存

### 优化

- **注入缓存友好化**：注入文本固定 + order 9998 尾部化（参考官方 system prompt 设计），移除 llm/stream 动态旁路——system 前缀恒定，缓存命中不再受注入波动影响

### 修复

- `getOuterStack is not a function`：`registry.plugin` 第三参必须是函数（`() => []`），双路径修正
- 工具 schema 兜底 + `safeRegister` 冲突容忍（同名工具跳过注册而非崩溃）
- 注入防重改权威判断（`hasActiveEntry`）+ 失败残留清理

## [0.1.1] — 2026-08-13

### 修复

- `dev_stage_demote` 无法注销已转正工具：`dev_stage_promote` 注册改挂 `ctx.effect` 并保存 disposer，demote 时真正从正式工具集注销（此前只删 staging 条目，正式注册残留）
- `purgeCache` 防御：loader.internal 缺失时安全跳过（不再非空断言炸 inject 路径）
- registry 原子写（tmp + rename）：中断不残留半截 JSON 毒化自动恢复

### 优化

- `dev_inject_plugin` dir 参数必填 + 空值兜底报错
- `hasActiveEntry` fiber 状态魔数（2）改为语义常量（FIBER_NAMES 反查 'active'）
- 预防正式版：peerDeps 放宽（`@deepseek-ai/dsh-tools >=0.0.1-rc <2`、`cordis >=4.0.0-rc <5`）
- 文档：README 新增「生态定位：官方之下的运行时标准层」章节

## [0.2.3] — 2026-08-13

### 修复（外部测评 P0/P1 + 作死压力测试驱动）

- **自重载链路断裂根治（P0）**：缓存无匹配不再 INFO 退出——降级从磁盘 URL 直接加载（junction/urlMatch 目录的 lib/index.js），`loader.import` 重新解析磁盘填充缓存后继续重载流程。此前缓存丢失（并行 build/自检交错 purge）会让自重载/热重载直接失效，只能人工 touch/重启；现链路自愈（实测：清空缓存 → 自重载直接从磁盘加载成功，审计 `cache-miss-healed`）
- **watch 悬空抑制（压测③）**：目录消失/悬空 junction（源被删/改名）时，watch 不再盲目 reload（此前虚增 ✓ 且无审计）——跳过重载 + `watch-dangling` 审计一次（30s 节流防刷屏）
- **uninject 统计口径（压测②）**：无匹配 = no-op 幂等，既不计 ✓ 也不计 ✗（此前：早期计 ✗ 产生 9✗ 假失败；后改计 ✓ 高估成功）
- **注入错误区分（压测①）**：`目录不存在或不可访问` 与 `存在但无 package.json` 分开报错

### 新增

- **操作失败可审计**：stats.json 增加 `lastFailures`（最近 5 条失败：类型 + 时间戳 + 原因），`dev_plugin_status` 展示「最近失败」区——9✗ 假失败等历史可追溯
- `dev_uninject_plugin` 的 match 参数改为必填 + 空值守卫（此前空参 `match.includes` TypeError）

### 质量

- 作死/压力测试（subagent 极限场景）：连环自重载 / 坏语法自杀 / 注入不存在目录 / 重复注入幂等 / 卸载不存在插件 / 缺参守卫 / 注入后删源码（悬空 junction）/ 注入卸载循环 3 轮 / 连跑自检 2 次——**六条防线全部扛住，零崩溃零残留，11 步全 PASS**
- 修后自检 8/8 全绿 + 卸载 no-op 统计不再污染（31✓/9✗ 恒定）

## [0.2.2] — 2026-08-13

### 新增

- **INSTALL.md 傻瓜式安装手册**：Release 包 / git / 手动 patch 三方式 + 验证 + 10 行排查表 + 卸载回滚小节 + Windows（Git Bash/cmd 双语法）说明 + 版本号占位（`<版本>` 不写死）
- **`[injected]` 标记**：`dev_plugin_status` 对运行时注入的插件标注（与 bundle 装配区分，hash id 不再难认）
- **`dev_self_test` 热重载自包含**：重载自检插件自身（固定 specifier + 固定目录，缓存一致），不再依赖环境里的外部插件（如 engram）

### 优化

- `dev_self_test` 预期拒绝场景（节流/预检拦截）改 `[EXPECTED]` 前缀——计入 PASS，不再误导新手
- client 状态区分：无 client 声明 → `client 跳过（属预期）`；有声明注册失败 → 真 `✗` + 诊断指引
- `dev_uninject_plugin` 描述补"另写 profile patch disabled 条目（防 include.refresh 加回）"，与实测行为一致
- 引导提示词补一行从零体验路径（dev_plugin_status → dev_self_test → dev_scaffold_plugin → dev_build_plugin → dev_inject_plugin → dev_uninject_plugin）

### 修复

- 注入 junction 悬空重建：`existsSync` 对悬空 junction 返回 false（跟随目标）导致 symlink EEXIST——改 `lstatSync` 判断链接存在 + `rmSync` 删除重建
- `uninject` 幂等：已存在同名 disabled 条目时跳过（此前重复卸载会累积 patch 条目）
- 自检 patch 清理：列表存在时不再追加 `[]`（防双顶层值回归）

### 质量

- 零上下文 subagent 三轮评测闭环：9/10 → 9.5/10 → **10/10**（七条 polish 全部落地 + 8/8 回归连续通过）

## [0.2.1] — 2026-08-13

### 优化

- `dev_self_test` 预期拒绝场景改 `[EXPECTED]` 前缀（不误导新手）
- client 状态区分「无声明（预期跳过）」与「有声明注册失败（真 ✗ + 诊断指引）」
- 引导提示词补从零体验路径一行

## [0.2.0] — 2026-08-13

### 新增

- **插件生产线三件套**：
  - `dev_scaffold_plugin`：四种形态骨架（toolkit 工具包 / daemon-loop 守护循环(timer+LLM) / ui-panel UI 面板 / hybrid 混合）——peerDeps 范围声明、ctx.effect 规范、build.sh 模板（DSH_CHECKOUT 自动探测）
  - `dev_build_plugin`：探测 checkout → tsc + tsdown（client）+ npm pack → tgz
  - `dev_release_plugin`：gh release create + tag + tgz 附件 + notes 模板
- **`dev_self_test` 一键回归**：注入 → 热重载 → 自重载节流 → 预检拦截 → 卸载即净 → patch 合法性，8 项全自动、自恢复无污染
- **patch 写入守卫 `writePatch`**：统一 profile patch 写入（顶层 `[]` 兼容 + 幂等），杜绝 YAML 双顶层值
- **审计日志轮转**：self-heal.log 超 1MB 自动滚动（保留 2 代）
- **操作统计落盘**：`stats.json` 跨重启累计（dev_plugin_status 显示历史成功率）
- **官方 entry 仲裁**：幽灵 entry 压制官方（disabled）时自动清理恢复（kill-zombie 自动化）
- **README 插件开发指南**：「30 行写一个会思考的插件」+ 规范铁律 + 生态借鉴

### 优化

- watch 指纹轻量化：只扫 `.js`（跳过 .map/.d.ts，stat 开销省 50%+）
- 引导提示词：静态到头（order -90）动态到尾（消息尾）缓存原则注释化

### 修复

- junction 悬空检测（inject 复用悬空链接 → import ENOENT）
- `uninject` 幂等缺失（重复卸载累积 patch 条目）

## 未发布

- 见 [README.md](./README.md) 与仓库提交历史
