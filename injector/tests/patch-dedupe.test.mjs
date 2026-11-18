/**
 * patch-dedupe.test.mjs — patch 去重的两条硬约束（都是实测事故的回归锁）
 *
 * ══ 病案 ①（2026-08-15）：缩进误判吃掉顶层 config ══════════════════════════
 *   旧提取器用**无锚点**正则 `/^\s*- id:/`，把 `- insert:` 块里**缩进**的子条目
 *   也当成顶层条目。于是「insert 子条目 dsh-vision」与「顶层 dsh-vision 配置块」
 *   被判为重复 ⇒ 顶层那块被删 ⇒ web profile 里 dsh-vision 的 baseURL/model 消失，
 *   `view_image` 回落到默认端点，商汤 key 打到智谱报 401。
 *   判据：顶层与嵌套条目**分桶判重**——二者同名必须共存。
 *
 * ══ 病案 ②：声称"保留最后一条"、实际保留第一条 ════════════════════════════
 *   loader 的语义是**后面的行覆盖前面的**，所以去重必须留最后一条。
 *
 * ══ 病案 ③：重写一次文件头注释就没了 ═════════════════════════════════════
 *   提取器把顶格注释丢弃 ⇒ 只要触发一次重写，文件头注释/说明就永久消失。
 *
 * ⚠️ 测试跑**真身** `scripts/fix-patch.mjs`（零依赖、可独立运行），并用
 *   `DSH_HOME` 指到临时目录 —— 绝不碰真实 profile。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'

const SCRIPT = new URL('../scripts/fix-patch.mjs', import.meta.url).pathname

/** 在隔离的 DSH_HOME 里造一个 web profile，写入指定 patch 内容并跑修复器。 */
function runFix(patchBody) {
  const home = mkdtempSync(join(tmpdir(), 'spi-patchfix-'))
  const profDir = join(home, 'profiles', 'web')
  mkdirSync(profDir, { recursive: true })
  const patchFile = join(profDir, 'cordis.patch.yml')
  writeFileSync(patchFile, patchBody)
  const stdout = execFileSync('node', [SCRIPT, '--profile', 'web'], {
    env: { ...process.env, DSH_HOME: home },
    encoding: 'utf8',
  })
  return {
    stdout,
    after: readFileSync(patchFile, 'utf8'),
    backups: readdirSync(profDir).filter((f) => f.startsWith('cordis.patch.yml.bak-')),
  }
}

test('nested insert child and a same-id top-level entry must coexist (incident 2026-08-15)', () => {
  const { after, stdout } = runFix(
    `# 头部说明（重写后必须保留）
- insert:
    - id: dsh-vision
      name: '@probe/vision'
      config:
        baseURL: https://api.example.test
        model: probe-1

- id: dsh-vision
  name: '@probe/vision'
  config:
    baseURL: https://api.example.test
    model: probe-1

- id: todo
  name: '@probe/todo'
`,
  )
  assert.match(after, /^ {4}- id: dsh-vision$/m, 'nested insert child must survive')
  assert.match(after, /^- id: dsh-vision$/m, 'top-level config block must survive')
  assert.match(after, /baseURL: https:\/\/api\.example\.test/)
  assert.match(after, /^- id: todo$/m)
  assert.match(stdout, /健康：无重复 id/, 'top-level vs nested same-id is not a duplicate')
})

test('a genuine duplicate keeps the LAST occurrence and preserves header comments', () => {
  const { after, stdout, backups } = runFix(
    `# 头部说明（重写后必须保留）
- id: dup
  name: '@probe/first'

- id: dup
  name: '@probe/second'

- id: keep
  name: '@probe/keep'
`,
  )
  assert.match(stdout, /id "dup".*删除 1 条/)
  assert.ok(after.includes('@probe/second'), 'last occurrence must win (loader overrides by order)')
  assert.ok(!after.includes('@probe/first'), 'earlier duplicate must be dropped')
  assert.match(after, /^# 头部说明/m, 'top-level comment must be preserved')
  assert.match(after, /^- id: keep$/m)
  assert.equal(backups.length, 1, 'the original must be backed up before rewrite')
})

test('a clean patch is left untouched (no backup, no rewrite)', () => {
  const body = `# no duplicates here
- id: a
  name: '@probe/a'

- id: b
  name: '@probe/b'
`
  const { after, stdout, backups } = runFix(body)
  assert.equal(after, body, 'clean file must be byte-identical')
  assert.match(stdout, /健康：无重复 id/)
  assert.equal(backups.length, 0)
})