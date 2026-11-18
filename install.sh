#!/usr/bin/env bash
# dsh-routing-suite 一键安装（Linux/macOS；镜像 install.ps1）：装配注入器 + 安装 router presets bundle + 自检。
# 注入器装配：优先源码构建（npm prepare），失败自动回退官方 Release tgz（SUPER_INJECTOR_VERSION 覆盖版本，默认 0.3.5）。
# 预设装配：DSH 0.2.1+ 不再读取 ~/.dsh/.agent-presets/，预设以 bundle 包（bundles/router-presets）安装。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# DSH_HOME 优先：部署环境 homedir 可能与 DSH_HOME 不一致，不能只靠 $HOME
DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
INJECTOR_DIR="$ROOT/injector"
PRESET_BUNDLE_DIR="$ROOT/bundles/router-presets"
PRESET_EXTERNAL_DIR="$DSH_HOME/external/dsh-router-presets"

# 输出着色（非终端自动禁用）
if [ -t 1 ]; then
  C_CYAN=$'\e[36m'; C_GREEN=$'\e[32m'; C_YELLOW=$'\e[33m'; C_RED=$'\e[31m'; C_RESET=$'\e[0m'
else
  C_CYAN=''; C_GREEN=''; C_YELLOW=''; C_RED=''; C_RESET=''
fi

info() { printf '%s=== %s ===%s\n' "$C_CYAN" "$1" "$C_RESET"; }
ok()   { printf '%s✓ %s%s\n'  "$C_GREEN" "$1" "$C_RESET"; }
warn() { printf '%s! %s%s\n'  "$C_YELLOW" "$1" "$C_RESET"; }
err()  { printf '%s✗ %s%s\n'  "$C_RED" "$1" "$C_RESET"; }

info '[0/4] 环境预检'
if ! command -v node >/dev/null 2>&1; then
  err '未找到 node（构建注入器 lib/ 需要 Node.js，请先安装或加载 nvm）'
fi
if ! command -v dsh >/dev/null 2>&1; then
  warn 'dsh 不在 PATH——装配注入器时将回退到 npx @deepseek-ai/dsh'
fi
echo "仓库目录 : $ROOT"
echo "DSH_HOME  : $DSH_HOME"

info '[1/4] 装配注入器'

# 装配包目录：源码构建成功 = 仓库内 injector/；否则 = Release tgz 解压目录
PKG_DIR="$INJECTOR_DIR"

if [ ! -f "$PKG_DIR/lib/index.js" ]; then
  warn 'injector/lib 缺失——尝试 npm install 触发 prepare 钩子构建（首次需网络拉取 tsdown）...'
  ( cd "$INJECTOR_DIR" && npm install --no-audit --no-fund ) || warn 'npm install 失败（可忽略）'
  if [ -f "$INJECTOR_DIR/lib/index.js" ]; then
    ok 'injector/lib 构建完成'
  else
    # 源码构建依赖私有 @deepseek-ai peer 包（package-lock 锁定），公共 npm registry 404 → 回退官方 Release tgz
    SPI_VERSION="${SUPER_INJECTOR_VERSION:-0.3.5}"
    SPI_DIST_DIR="$DSH_HOME/external/dsh-super-injector"
    SPI_TGZ="https://github.com/yjh051108/dsh-super-injector/releases/download/v${SPI_VERSION}/dsh-external-dsh-super-injector-${SPI_VERSION}.tgz"
    if [ ! -f "$SPI_DIST_DIR/lib/index.js" ]; then
      warn "源码构建不可行——自动下载官方预构建 Release v${SPI_VERSION} ..."
      warn "  $SPI_TGZ"
      mkdir -p "$SPI_DIST_DIR"
      if curl -fL --retry 2 -m 120 "$SPI_TGZ" | tar -xzf - -C "$SPI_DIST_DIR" --strip-components=1; then
        if [ -f "$SPI_DIST_DIR/lib/index.js" ]; then
          ok "Release 包就位：$SPI_DIST_DIR"
        else
          err "Release 包解压后缺少 lib/index.js——包内容异常，请到 https://github.com/yjh051108/dsh-super-injector/releases 核对"
        fi
      else
        err "Release 下载/解压失败（${SPI_TGZ}）——请手动下载 tgz 后重跑本脚本，或改用："
        warn '  B. github: 装配（prepare 钩子自动构建）：dsh plugin --profile web add github:yjh051108/dsh-super-injector'
        warn '  C. 有 DSH 源码 checkout 时：DSH_CHECKOUT=<checkout> bash scripts/build.sh 后再重跑本脚本'
      fi
    else
      ok "检测到已就位的 Release 包：$SPI_DIST_DIR"
    fi
    if [ -f "$SPI_DIST_DIR/lib/index.js" ]; then
      PKG_DIR="$SPI_DIST_DIR"
    fi
  fi
fi

PATCH_FILE="$DSH_HOME/profiles/web/cordis.patch.yml"
manual_fallback=0
if [ -f "$PATCH_FILE" ] && grep -q 'dsh-super-injector' "$PATCH_FILE"; then
  warn 'cordis.patch.yml 已含 dsh-super-injector——跳过装配（防 duplicate loader entry id）'
elif [ -f "$PKG_DIR/lib/index.js" ]; then
  if command -v dsh >/dev/null 2>&1; then
    dsh plugin --profile web add "$PKG_DIR" \
      || { err 'dsh plugin add 失败（见上方输出）——可改用手动装配（见下）'; manual_fallback=1; }
  else
    warn 'dsh 不在 PATH——改用 npx @deepseek-ai/dsh 装配'
    npx '@deepseek-ai/dsh' plugin --profile web add "$PKG_DIR" \
      || { err 'npx 装配失败（见上方输出）——可改用手动装配（见下）'; manual_fallback=1; }
  fi
  if [ "$manual_fallback" -eq 0 ]; then
    ok '注入器已装配（重启后由 bundles 接管）'
  else
    warn '手动装配回退（免 pnpm，与官方装配二选一）：'
    warn "  1) mkdir -p '$DSH_HOME/profiles/web/node_modules/@dsh-external'"
    warn "  2) ln -sfn '$PKG_DIR' '$DSH_HOME/profiles/web/node_modules/@dsh-external/dsh-super-injector'"
    warn "  3) 在 '$DSH_HOME/profiles/web/cordis.patch.yml' 的顶层数组里追加："
    warn '     - insert:'
    warn '         - id: dsh-super-injector'
    warn "           name: '@dsh-external/dsh-super-injector'"
    warn '           config: {}'
    warn '  4) 重启 DSH'
  fi
else
  warn '未获得可装配的注入器包（lib 缺失）——请按上方提示处理后再重跑本脚本'
fi

info '[2/4] 安装 router presets（DSH 0.2.1+ bundle 形态）'
if [ ! -f "$PRESET_BUNDLE_DIR/cordis.patch.yml" ]; then
  err "仓库缺少预设 bundle：${PRESET_BUNDLE_DIR}（跳过）"
else
  # bundles/router-presets 是生成物：改 preset/*/ 后先跑 node scripts/build-preset-bundle.mjs
  mkdir -p "$DSH_HOME/external"
  rm -rf "$PRESET_EXTERNAL_DIR"
  cp -R "$PRESET_BUNDLE_DIR" "$PRESET_EXTERNAL_DIR"
  if command -v dsh >/dev/null 2>&1; then
    dsh plugin --profile web add "$PRESET_EXTERNAL_DIR" && ok '预设 bundle 已装配（重启 DSH 后生效）' || err '预设 bundle 装配失败（见上方输出）'
  else
    npx '@deepseek-ai/dsh' plugin --profile web add "$PRESET_EXTERNAL_DIR" && ok '预设 bundle 已装配（重启 DSH 后生效）' || err '预设 bundle 装配失败（见上方输出）'
  fi
fi

info '[3/4] 自检'
failed=0
PRESET_LINK="$DSH_HOME/profiles/web/node_modules/@dsh-external/dsh-router-presets"
if [ -f "$PRESET_LINK/package.json" ]; then
  ok "bundle 已链接：$PRESET_LINK"
else
  err "bundle 未链接到 profile：$PRESET_LINK"
  failed=1
fi
if command -v dsh >/dev/null 2>&1; then
  for pid in router-standard router-spec; do
    if DSH_HOME="$DSH_HOME" dsh --profile web --dump-config 2>/dev/null | grep -q "preset-$pid"; then
      ok "preset-$pid 已进入装配树"
    else
      err "装配树里没有 preset-${pid}——检查 profile package.json 的 dsh.profile.bundles"
      failed=1
    fi
  done
else
  warn 'dsh 不在 PATH，跳过 --dump-config 自检'
fi
if [ -d "$DSH_HOME/.agent-presets" ]; then
  warn "检测到遗留目录 $DSH_HOME/.agent-presets：DSH 0.2.1+ 已不再读取，可安全删除"
fi
if [ "$failed" -ne 0 ]; then
  err '自检失败——请看上方提示；兼容说明见 docs/COMPAT.md'
fi

info '[4/4] 完成'
echo '1. 重启 DSH（web 服务）'
echo '2. GUI 新建会话 → 选择 Router Standard / Router Spec (experimental)'
echo '3. 发任务：生成任务自动 react，维护任务自动 spec，模糊任务进 weak 内路由'
echo '4. AI 自优化工具：dev_router_status / dev_router_mode / dev_mode_subagent'
