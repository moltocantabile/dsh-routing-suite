# AGENTS.md — dsh-router-standard 预设开发指南

> **中心思想（理念与精神）** —— 这是本预设研发的最高纲领，一切决策以它为准。
>
> 1. **研发核心是「底层注意力机制」和「交付质量收敛」，不是自研工具。** 工具（page_check 等）
>    大道至简——删掉反复出 bug 的自研工具，让模型自己装 CLI 自测（bash 跑 playwright/headless Chrome），
>    预设专注注意力机制 + delivery_check 门禁。
> 2. **从「模型底层特性」入手，用数据说话，拒绝形而上学。** 每一条引导/机制都要在真实会话或 api1
>    实测（读 `reasoning_content`）验证过，不凭空造机制、不为填充而改。
> 3. **深度思考无所谓，重要的是「提高思考质量、打破局限思维」。** 不压制思考、不催速；
>    但警惕"局部最优思维"（卡在单点细节反复循环）——引导模型保持整体可用、别被顽固细节卡住交付。
> 4. **道德为主、法治为辅。** 引导内在动机（"做扎实、给安全感、不焦虑下阶段"）优于外部强制规则；
>    gate（delivery_check）兜底施压但不制造焦虑。
> 5. **不惯性、不时务**：报废的技术不优化、直接删；不因"以前这么做"而延续；每个判断基于当下的实测。
> 6. **重成果，思时间**：看思考质量/是否专注/是否偏离，而非跑多久；每会话 2h 预算上限。
> 7. **对外：公开产线要稳定**；对数据：标签+实验记录，测完归档到 `dsh-实测归档/`，测试环境保持干净。
>
> 相关演进见 `CHANGELOG.md`；核心机制判断见 `docs/` 与归档 `核心机制反馈-v123-优化方向.md`。

> `dsh-routing-suite/preset` = 路由预设源码仓库（子模块），含三大预设：
> **router-standard（v34，主力）** / **router-react（v17）** / **router-spec（v10)**。
> 本文档给 agent/开发者：怎么改、怎么验、怎么同步到 DSH、怎么生效。
> 权威规范（哲学/设计）见 `README.md` 与 `docs/`；演进史见 `CHANGELOG.md`。

## 开发链路全貌（DSH 0.2.1+）

```
改源码（preset/<id>/，无版本别名） → selftest 就地验证 → node scripts/build-preset-bundle.mjs
→ bundles/router-presets/（bundle 包）→ 安装到 profile → 重启 DSH → 新会话生效
```

DSH 0.2.1 起**预设是 bundle 包**：`$DSH_HOME/.agent-presets/` 目录不再被读取，
`agent.cordis.yml` 只是构建输入，最终由 `bundles/router-presets/cordis.patch.yml`
以 `preset-<id>` 声明行（`@deepseek-ai/dsh-agent-preset` + 内联 `config.plugins`）装配。
兼容细节见 `../docs/COMPAT.md`。

| 预设 | 源码目录 | bundle 内 id | 当前版本 |
|---|---|---|---|
| router-standard | `preset/router-standard/` | `preset-router-standard`（order 1） | v34 |
| router-spec | `preset/router-spec/` | `preset-router-spec`（order 2） | v10 |
| router-react | `preset/router-react/` | `preset-router-react`（order 3） | v17 |

## 编辑基准（改哪里）

**改源码目录的无版本别名**，不是带版本号文件：

- `preset/router-standard/router-bootstrap.mjs` ← 主编辑对象（机制）
- `preset/router-standard/router-core.mjs` ← 路由逻辑
- `preset/router-standard/agent.cordis.yml` ← 装配配置（persona/sections/工具行）

> `-v34.mjs` 等带版本文件是当前版快照；无版本别名是纯源，两者需保持一致（生成器会同步进 bundle assets）。
> 三个文件常联动改：bootstrap（机制）+ core（逻辑）+ agent.cordis.yml（工具面/版本戳）。

## 验证（改完就地测）

```bash
node preset/router-standard/router-bootstrap-v34.selftest.mjs   # → SELFTEST PASS
cd preset && node --test router.test.mjs router.integration.test.mjs   # 50/50
```

## 同步到 DSH（让改动能跑）

```bash
# 1. 由 preset/*/ 重新生成 bundle（幂等；assets 一并同步）
node scripts/build-preset-bundle.mjs

# 2. 装/覆盖到 profile（dsh plugin add 会自动把包名加进 dsh.profile.bundles）
rm -rf ~/.dsh/external/dsh-router-presets
cp -R bundles/router-presets ~/.dsh/external/dsh-router-presets
dsh plugin --profile web add ~/.dsh/external/dsh-router-presets

# 3. 重启 DSH（bundle 层在启动时读取；预设行随之重新装配）
#    验证：dsh --profile web --dump-config | grep preset-router
```

> 改 `preset/*/agent.cordis.yml` 而不重跑生成器 = bundle 陈旧，别忘第 1 步。
> 生成物可提交（`bundles/` 入库），CI 守卫建议：`node scripts/build-preset-bundle.mjs && git diff --exit-code bundles/`。

## 关键坑（实测血泪）

1. **`.agent-presets` 已死**：0.2.1 不读该目录，旧「平铺复制」安装会静默失效（自检还会假绿）。
2. **persona 配置键**：0.2.1 要求 `prefix:`（旧键 `text:` 挂载即抛 `$.prefix missing required value`）；生成器已改名。
3. **相对资源名**：插件行 `./x.mjs?v=N` 按 **profile 目录**解析会 404；生成器改成包内 specifier
   `@dsh-external/dsh-router-presets/assets/<preset>/<file>.mjs`。
4. **workflow 引擎**：包名 `@deepseek-ai/dsh-workflow-ptc`（`provider: spawn`）；宿主行在 web profile 是 disabled，
   必须由预设在 delegation isolate 组内提供。
5. **无版本别名 ≠ 历史**：`router-bootstrap.mjs`/`router-core.mjs` 是当前版兼容别名（probe/测试引用），
   **勿删、勿移**；历史版本在 `docs/archive/`。

## 版控边界（.gitignore）

- `probe/` 是**历史实验快照**（脚本已断链，不修依赖），数据/大件入 `.gitignore`。
- **保留**：`probe/*.mjs`、`probe/*.py`、`probe/README.md`（历史档案）。
- **忽略**：`probe/deepseek-v4-pro-weights`/`dsh-2020-dataset`/`deepseek-tokenizer`/`results`/`sessions`/候选池 json。
- probe 详细说明见 `probe/README.md`。

## 工作流速查

```bash
# 1. 改编辑基准（preset/<id>/ 无版本别名）
# 2. 就地验证（selftest / node --test）
# 3. 重新生成 bundle：node scripts/build-preset-bundle.mjs
# 4. 装到 profile（cp 到 ~/.dsh/external + dsh plugin add）+ 重启 DSH
```
