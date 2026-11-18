/**
 * 操作统计口径回归测试（2026-11-18 用户要求：只显示本次启动、不落盘）
 *
 * 背景：统计原先写 `~/.dsh/super-injector/stats.json` 跨重启累计，页面上的数字
 * 讲的是"这台机器历史上发生过什么"——掺着旧版本调试期留下的 5 个空 reason
 * `inject ✗`，与当前进程无关、也无从判读。现在口径改为**仅本次启动、内存计数**。
 *
 * 锁两条：
 *   ① 源码里不许再出现任何统计落盘通道（statsFile / saveStats / 写 stats.json）；
 *   ② 必须保留进程内跨自重载的载体（globalThis 上的固定 symbol）——自重载是同一次
 *      启动，若改回 fiber 级内存，读数会在每次重载时清零，等于失去意义。
 *
 * 运行：npm test
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const SRC = fs.readFileSync(path.join(ROOT, 'src/index.ts'), 'utf8')
const LIB_PATH = path.join(ROOT, 'lib/index.js')
const LIB = fs.existsSync(LIB_PATH) ? fs.readFileSync(LIB_PATH, 'utf8') : undefined

describe('操作统计：本次启动口径、不落盘', () => {
  test('没有任何统计落盘通道', () => {
    for (const banned of ['statsFile', 'saveStats', "'stats.json'", '"stats.json"']) {
      assert.ok(!SRC.includes(banned), `src 仍引用 ${banned} —— 统计又被持久化了`)
    }
    // 只允许 registry / self-reload / staging 这几类持久化文件
    assert.match(SRC, /registry\.json/, 'registry.json 才是该落盘的（注入清单跨重启恢复）')
  })

  test('保留进程内跨自重载的统计槽', () => {
    assert.match(SRC, /Symbol\.for\(['"]dsh-super-injector\.opStats['"]\)/,
      '统计槽丢失：自重载会把读数清零（同一次启动应连续累计）')
    assert.match(SRC, /const opStats: OpStatsMap = loadStats\(\)/,
      'opStats 必须取自进程级槽位')
  })

  test('install 死计数器已移除（dev_install_package 剪掉后无人递增）', () => {
    assert.doesNotMatch(SRC, /install:\s*\{ ok: 0, fail: 0 \}/, 'install 桶还在 —— 永远显示 0✓/0✗ 的噪音')
    assert.doesNotMatch(SRC, /'inject' \| 'reload' \| 'uninject' \| 'install'/, 'OpKind 仍含 install')
  })

  test('junction 自愈与复活自愈分桶（✗ 的语义相反，混桶就读不出是不是故障）', () => {
    assert.match(SRC, /'inject' \| 'reload' \| 'uninject' \| 'selfHeal' \| 'heal'/,
      'OpKind 缺 heal：复活自愈仍记在 selfHeal 上')
    // dev_heal_links 走 selfHeal；重启器两处成功 + 一处失败走 heal
    assert.match(SRC, /recordOp\('selfHeal', healed\.length === 0/, 'dev_heal_links 的 selfHeal 口径被改')
    assert.equal((SRC.match(/recordOp\('heal', true\)/g) ?? []).length, 2,
      '复活自愈成功应有两处（touch patch / fallback loader.create）计入 heal')
    assert.match(SRC, /recordOp\('heal', false, /, '复活自愈失败没记 heal ✗ ⇒ 面板看不到真故障')
  })

  test('已构建产物与 src 同步', { skip: LIB === undefined && 'lib/index.js 未构建' }, () => {
    assert.ok(LIB !== undefined)
    assert.ok(!LIB.includes('saveStats'), 'lib 陈旧：仍含统计落盘实现，重跑 tsdown / prepare.mjs')
    assert.ok(LIB.includes('dsh-super-injector.opStats'), 'lib 陈旧：缺进程级统计槽，重跑构建')
  })
})