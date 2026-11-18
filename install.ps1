# dsh-routing-suite 一键安装（Windows PowerShell）
# 步骤：1) 装配注入器  2) 安装 router presets bundle  3) 自检 + 提示重启
# 注：DSH 0.2.1+ 不再读取 %USERPROFILE%\.dsh\.agent-presets\，预设以 bundle 包安装（bundles/router-presets）。
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

# DSH_HOME 优先：部署环境 USERPROFILE 可能与 DSH_HOME 不一致
$dshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }
$profileDir = Join-Path $dshHome 'profiles\web'

Write-Host '=== [1/3] 装配注入器 ===' -ForegroundColor Cyan
$injector = Join-Path $root 'injector'
if (-not (Test-Path (Join-Path $injector 'lib\index.js'))) {
  # 全新 clone 没有 lib/（构建产物不入库）。github: 装配（方式 B）会在安装时由
  # prepare 钩子自动构建；本地目录装配若构建不可行，请改用 Release tgz（方式 A）。
  Write-Host 'injector/lib 缺失——尝试 npm install 触发 prepare 钩子构建（若私有 peer 拉取失败会自动跳过）...' -ForegroundColor Yellow
  Push-Location $injector
  try {
    & npm install --no-audit --no-fund 2>&1 | Out-Host
  } catch {
    Write-Host 'npm install 失败（可忽略）' -ForegroundColor DarkGray
  } finally {
    Pop-Location
  }
  if (-not (Test-Path (Join-Path $injector 'lib\index.js'))) {
    Write-Host '自动构建不可行——注入器请改用以下方式装配：' -ForegroundColor Yellow
    Write-Host '  A. Release tgz（预构建，推荐）：https://github.com/yjh051108/dsh-super-injector/releases' -ForegroundColor Yellow
    Write-Host '  B. github: 装配（prepare 钩子自动构建）：dsh plugin --profile web add github:yjh051108/dsh-super-injector' -ForegroundColor Yellow
  } else {
    Write-Host 'injector/lib 构建完成' -ForegroundColor Green
  }
}
if (Test-Path (Join-Path $injector 'lib\index.js')) {
  # dsh CLI 可能不在 PATH（用 npx @deepseek-ai/dsh web 启动的场景）；优先 dsh，fallback 到 npx
  $dshCmd = Get-Command dsh -ErrorAction SilentlyContinue
  if ($dshCmd) {
    & dsh plugin --profile web add $injector 2>&1 | Out-Host
  } else {
    & npx '@deepseek-ai/dsh' plugin --profile web add $injector 2>&1 | Out-Host
  }
  Write-Host '注入器已装配（重启后由 bundles 接管）' -ForegroundColor Green
}

Write-Host '=== [2/3] 安装 router presets（bundle 形态） ===' -ForegroundColor Cyan
$presetBundle = Join-Path $root 'bundles\router-presets'
$presetExternal = Join-Path $dshHome 'external\dsh-router-presets'
if (-not (Test-Path (Join-Path $presetBundle 'cordis.patch.yml'))) {
  Write-Host "仓库缺少预设 bundle：$presetBundle（跳过）" -ForegroundColor Red
} else {
  $externalRoot = Split-Path -Parent $presetExternal
  New-Item -ItemType Directory -Force -Path $externalRoot | Out-Null
  if (Test-Path $presetExternal) { Remove-Item -Recurse -Force $presetExternal }
  Copy-Item -Recurse $presetBundle $presetExternal
  $dshCmd = Get-Command dsh -ErrorAction SilentlyContinue
  if ($dshCmd) {
    & dsh plugin --profile web add $presetExternal 2>&1 | Out-Host
  } else {
    & npx '@deepseek-ai/dsh' plugin --profile web add $presetExternal 2>&1 | Out-Host
  }
  Write-Host '预设 bundle 已装配（重启 DSH 后生效）' -ForegroundColor Green
}

Write-Host '=== [3/3] 自检 ===' -ForegroundColor Cyan
$failed = $false
$presetLink = Join-Path $profileDir 'node_modules\@dsh-external\dsh-router-presets\package.json'
if (Test-Path $presetLink) {
  Write-Host "OK: bundle 已链接 -> $presetLink" -ForegroundColor Green
} else {
  Write-Host "FAIL: bundle 未链接到 profile（$presetLink）" -ForegroundColor Red
  $failed = $true
}
$legacy = Join-Path $dshHome '.agent-presets'
if (Test-Path $legacy) {
  Write-Host "! 检测到遗留目录 $legacy：DSH 0.2.1+ 已不再读取，可安全删除" -ForegroundColor Yellow
}
if ($failed) {
  Write-Host '自检失败——请看上方提示；兼容说明见 docs/COMPAT.md' -ForegroundColor Red
}

Write-Host '=== 完成 ===' -ForegroundColor Cyan
Write-Host '1. 重启 DSH（web 服务）' -ForegroundColor Yellow
Write-Host '2. GUI 新建会话 → 选择 Router Standard / Router Spec (experimental)' -ForegroundColor Yellow
Write-Host '3. 发任务：生成任务自动 react，维护任务自动 spec，模糊任务进 weak 内路由' -ForegroundColor Yellow
Write-Host '4. AI 自优化工具：dev_router_status / dev_router_mode / dev_mode_subagent' -ForegroundColor Yellow