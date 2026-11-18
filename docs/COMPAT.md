# 兼容性说明：DSH 0.2.1-rc.2 · macOS / Linux

本文件记录「本仓库 → 当前 DSH 运行时」的兼容结论、已修问题与验证方式。
验证基准：**DSH 0.2.1-rc.2**（`dsh` 全局安装，Node v24.18.1，macOS arm64）。
上游仓库最后跟进的是 0.1.x / 0.2.0 时代的形态，**直接使用会有多处硬失败**；以下是已经修掉的部分。

## 一、组件状态

| 组件 | 状态 | 说明 |
|---|---|---|
| `injector/`（dsh-super-injector 0.3.6 + 本地补丁） | ✅ 可用 | 启动挂载、客户端 bundle、`--dump-config` 全部通过；注入器**自身**热重载在 0.2.1 上降级（见 §2.5） |
| `preset/` → `bundles/router-presets/` | ✅ 已迁移 | 0.2.1 不再读 `~/.dsh/.agent-presets/`，预设改为 bundle 包（见 §2.1） |
| `install.sh` | ✅ 可用 | 已修 macOS bash 3.2 崩溃（§3.1）；预设步骤改为安装 bundle |
| `preset/*/agent.cordis.yml` | 📦 构建输入 | 由 `scripts/build-preset-bundle.mjs` 生成 bundle patch，不再直接拷进 `.agent-presets` |

## 二、DSH 0.2.1 的破坏性变更与修法

### 2.1 预设发现机制重写：`.agent-presets/` 已废弃
0.2.1 起没有任何代码扫描 `$DSH_HOME/.agent-presets/`（旧目录里放 `preset.yml` + `agent.cordis.yml` 的方式失效；
连安装脚本的自检都会「假绿」）。新形态是**普通 bundle 包**：

- `package.json` 声明 `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }`；
- patch 里插入 `- id: preset-<id>` / `name: '@deepseek-ai/dsh-agent-preset'`，
  `config.plugins` 内联原来的 `agent.cordis.yml` 列表；
- 装进 profile：`dsh plugin --profile web add <bundle 目录>`，并把包名加进
  `~/.dsh/profiles/web/package.json` 的 `dsh.profile.bundles`（顺序在 `@deepseek-ai/dsh-web-app` 之后）。

本仓库的 `bundles/router-presets/` 就是迁移结果（由 `scripts/build-preset-bundle.mjs` 从 `preset/*/` 生成，勿手改）。

### 2.2 `@deepseek-ai/dsh-workflow-worker-thread` 已删除
0.2.1 的包名是 `@deepseek-ai/dsh-workflow-ptc`（config 仍接受 `provider: spawn`）。
注意 **web profile 里宿主自带的 `workflow-ptc` 行是 disabled**（`dsh-web-app/cordis.patch.yml`），
所以预设必须在自己的 delegation isolate 组里提供这一行；漏了则 workflow 工具没有引擎。

### 2.3 presets 的 persona 配置键：`text` → `prefix`
0.2.1 的 `dsh-persona` schema 要求 `prefix`（必填），旧键 `text` 会在挂载时抛
`$.prefix missing required value`，整个预设无法组合会话。迁移脚本统一改名（值原样保留）。
`{{model}}` / `{{cwd}}` 等模板变量由 prompt registry 提供，`prefix` 仍按模板严格插值。

### 2.4 预设内相对资源路径失效
插件行的相对 `name`（如 `./router-bootstrap-v34.mjs?v=88`）按 **profile 目录**解析，
不再按预设目录解析 → 404。迁移后资源随 bundle 包分发，行名改为包内 specifier：
`@dsh-external/dsh-router-presets/assets/<preset>/<file>.mjs`（`?v=` 缓存参数不再需要）。

### 2.5 注入器自身热重载在 0.2.1 上降级（重要）
0.2.1 的 loader entry **没有 `_dispose`**（`cordis-plugin-loader` 中 0 处出现）。
注入器的「自重载」路径仍会先 dispose 自身 fiber，再尝试 `_dispose` → 报
`selfEntry 无官方 _dispose（loader 契约缺失）`，随后走自愈（touch patch / `loader.create`）复活。
实际影响：**升级注入器代码后，热重载可能只复活旧代**，最稳妥是重启 DSH 一次。
官方 0.2.1 的替换 API 是 `entry.parent.remove(entry.id, true)`（第二参 `isDispose=true`，返回 `void`），
上游注入器尚未跟进；`src/index.ts:2166` 还有一处把 `remove()` 当 Promise 用的类型偏差（运行时无害，只影响 `npm run typecheck`）。

### 2.6 安装器（install.sh）在 macOS bash 3.2 上崩溃
macOS 自带 bash 3.2.57：`$target（` 这类「变量紧跟全角括号」会被解析成变量名的一部分，
在 `set -u` 下报 `target: unbound variable`，**每次重跑都会崩**（首次能过只是因为相关分支未走到）。
已修：所有变量一律加花括号 `${target}（…`。

### 2.7 npm 锁文件里钉了未发布的包
injector 0.3.6 上游 `package-lock.json` 钉了 `@deepseek-ai/dsh-type-meta@0.0.1-rc.1`（公网 404），
`npm install` 直接失败、prepare 构建被跳过。本仓库的锁文件已重新生成（不再引用该版本），
`rm -rf node_modules lib && npm install` 可复现自包含 bundle。

## 三、macOS / Linux 专项

### 3.1 bash 3.2 变量/全角标点（见 §2.6）
规则：shell 脚本里变量后接任何非 ASCII 字符时必须写 `${var}`。仓库已用脚本扫描过全部 `*.sh`。

### 3.2 行尾必须 LF
`.gitattributes` 固定 `*.sh text eol=lf`（CRLF 会让 `set -o pipefail` 报 invalid option name）。
上游 injector 单独发布时没有该文件，克隆到 macOS 后 `bash scripts/build.sh` 可能直接失败——本仓库已覆盖。

### 3.3 POSIX bash 工具行 `tool-bash-posix`
0.2.1 的宿主 `tool-bash` 行只在非 win32 启用；但**预设会接管工具清单**，宿主行不会进入预设会话，
导致 macOS/Linux 上阶段 3 验证报 `unknown tool`。预设里必须自带：
```yaml
- id: tool-bash-posix
  name: '@deepseek-ai/dsh-tool-bash'
  disabled: !!js process.platform === 'win32'
```
（与 Windows 的 gitbash 组互斥，不会重复注册。）

### 3.4 符号链接 vs Windows junction
注入器的「删链接」路径原来一律 `rmdirSync`：Windows junction 是目录语义可行，
POSIX 的 symlink 会 `ENOTDIR` —— 卸载删不掉 profile 链接、自愈重建报 `EEXIST`、构建物化报错。
已改为**先 `unlinkSync`，失败再 `rmdirSync`**（两者都不会递归进目标）。

### 3.5 `DSH_HOME`
`install.sh` 全程尊重 `DSH_HOME`（默认 `~/.dsh`）；隔离验证命令示例：
```bash
DSH_HOME=/tmp/dsh-test bash install.sh
```

## 四、验证方式

```bash
# 1. 静态/单元
cd injector && node --test tests/*.test.mjs          # 20/20
cd preset && node --test router.test.mjs router.integration.test.mjs   # 50/50

# 2. 组装检查（不启动服务）
dsh --profile web --dump-config | grep -E 'preset-router|dsh-super-injector'

# 3. 隔离启动（换 DSH_HOME，端口 0，不碰生产 3080）
DSH_HOME=/tmp/dsh-test/.dsh dsh web --port 0 --no-open
#   日志无 loader/preset 报错、打印 URL 即通过；验证后 kill

# 4. 真实环境
#   重启 dsh web → 新会话里能看到 Router Standard / Router Spec；
#   设置页插件管理能看到 @dsh-external/dsh-super-injector；
#   在会话里调 dev_plugin_status 确认 dev_* 工具已注册。
```

## 五、已知限制 / 未验证

- 注入器在 0.2.1 上**不支持干净的自自热重载**（§2.5）：升级注入器代码后请重启 DSH。
- preset 的 `router-react` 仍是实验分支，未加入默认安装（与上游 `install.sh` 一致）。
- `disabled: true` 的 codex / claude-code 子代理行指向未安装的 provider 包；保持禁用即无影响，启用前需先装对应包。
- 本文件基于静态审计 + 隔离启动验证；预设的**逐轮路由行为**（bootstrap 注入、阶段解锁）需在真实会话里回归，
  尤其是 `{{model}}`/`{{cwd}}` 模板变量与 `sessionEvents` 水位在新版本下的表现。