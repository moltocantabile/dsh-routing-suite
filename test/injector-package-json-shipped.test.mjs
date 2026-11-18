import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const injectorRoot = resolve(repoRoot, 'injector')

/**
 * Regression guard: the injector is a *sub* package (injector/package.json).
 * The root "files" whitelist must ship it, otherwise a git-hosted install
 * (dsh plugin --profile web add github:...) drops the file and DSH fails to
 * boot with MODULE_NOT_FOUND on injector/lib/index.js.
 */
test('injector/package.json is shipped in the published tarball', (t) => {
  const raw = execFileSync(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['pack', '--dry-run', '--json', '--ignore-scripts'],
    { cwd: repoRoot, encoding: 'utf8', shell: process.platform === 'win32' },
  )

  // npm may print script output (e.g. "[prepare] ...") before the JSON payload;
  // locate the array start by matching '[' followed by a '{' object.
  const start = raw.search(/\[\s*\{/)
  assert.notEqual(start, -1, `no JSON payload found in npm pack output:\n${raw}`)
  const json = raw.slice(start)
  const [{ files }] = JSON.parse(json)
  const paths = files.map((f) => f.path)

  assert.ok(
    paths.includes('injector/package.json'),
    'injector/package.json must be listed in "files" of the root package.json',
  )

  // ── injector/lib 必须真的在 tarball 里（2026-11-18 独立发现 A）──────────────
  // 只加 files 条目**不够**：injector/.gitignore 里的 `lib/` 会压过根 files
  // 允许清单，npm pack 打出来一个没有 lib 的包，而根 main 指向
  // ./injector/lib/index.js ⇒ 从 git 装的包一启动就 MODULE_NOT_FOUND。
  // 修法是 injector/.npmignore（子目录 .npmignore 优先于同目录 .gitignore）。
  //
  // lib/ 是构建产物（不入库）：干净检出未构建时，pack 里当然不可能有它。
  // 这种情况不算发布回归，跳过并明确告知需要先构建——但结构守卫
  // （下面那条 .npmignore 测试）在任何检出上都跑，覆盖真正的根因。
  const libBuilt = existsSync(resolve(injectorRoot, 'lib/index.js'))
  if (!libBuilt) {
    t.skip('injector/lib 未构建（干净检出）：先跑 `node injector/scripts/prepare.mjs` 或 `bash injector/scripts/build.sh` 再验 tarball；根因由下一条 .npmignore 测试覆盖')
    return
  }

  assert.ok(
    paths.includes('injector/lib/index.js'),
    'injector/lib/index.js must be shipped (root main entry point)',
  )
  // exports["./client"] 指向它；UI 面板与 reload 都靠这个入口。
  assert.ok(
    paths.includes('injector/lib/client.js'),
    'injector/lib/client.js must be shipped (root exports["./client"] entry point)',
  )
})

/**
 * 根因守卫（不依赖构建产物，任何检出都能跑）：injector/.npmignore 必须存在，
 * 且不得把 lib/ 排除掉——否则根 files 里的 "injector/lib" 形同虚设。
 */
test('injector/.npmignore must exist and must not exclude lib/', () => {
  const npmignore = resolve(injectorRoot, '.npmignore')
  assert.ok(
    existsSync(npmignore),
    'injector/.npmignore is required: without it injector/.gitignore\'s `lib/` wins over the root "files" allowlist and the tarball ships no injector/lib',
  )
  const lines = readFileSync(npmignore, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'))

  for (const line of lines) {
    assert.ok(
      !/^!?\/?lib\/?$/.test(line),
      `injector/.npmignore must not exclude lib/ (found "${line}") — that silently drops the package entry point from the tarball`,
    )
  }
})