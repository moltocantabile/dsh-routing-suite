/**
 * dsh-super-injector 注入插件 UI（settings.section 页面）。
 *
 * 范围（2026-11-18 精简）：只管理**运行时注入**的插件——这类条目没有 profile
 * patch 目标，官方「插件」页能看到（只读）却无法卸载，是本页唯一不可替代的职责。
 * 持久安装/启停已由 DSH 内置插件管理承担（侧栏「插件」页 / `dsh plugin add`），
 * 页面不再重复提供安装入口，也不再内化目录（官方 Add plugin ▸ Creator 覆盖）。
 *
 * 视觉：与 DSH 设置页同一套设计 token（--dsw-*）与 UI 原语
 * （@deepseek-ai/dsh-client-ui-primitives 是平台 seed 模块，运行时 require 即可；
 * 它不在 node_modules 里，故 tsdown 必须把它列为 external）。旧实现用的
 * `--theme-*` 变量在 0.2.1 里根本不存在，深色硬编码兜底导致页面在浅色主题下发黑，
 * 且 1.5px 边框/6px 圆角/等宽字体都与原生设置页不一致——本次整体重写。
 *
 * ⚠️ 组件形态（DSH 0.2.1 契约）：`settings.section` 的 component 必须是 React
 * 组件——shell 经 renderSlot 用 `jsx(Comp, props)` 挂载；`() => ({ render() })`
 * 实例工厂会得到纯对象 → 页面空白（2026-08 与 2026-11-18 两次实机定位）。
 */
import { createElement, useCallback, useEffect, useState } from 'react'
import type { JSX } from 'react'
import type { SlotsService } from '@deepseek-ai/dsh-client-ui-slots'
import {
  Button,
  IconRefreshOutlineRegular,
  IconTrashOutlineRegular,
  Input,
  StateDot,
  Tag,
} from '@deepseek-ai/dsh-client-ui-primitives'

type ClientContext = {
  slots: SlotsService
}

export const inject = ['slots']

const API = '/super-injector/api'

type EntryInfo = { dir: string; name: string; at?: string; active?: boolean }
type ListResp = { ok?: boolean; entries: EntryInfo[]; stats?: Record<string, { ok: number; fail: number }> }

/** 与官方设置页同构的样式：全部走 --dsw-* token，类名以 spi_ 前缀自作用域。 */
const CSS = `
.spi_section{display:flex;flex-direction:column;gap:14px;max-width:720px;color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-family);font-size:13px;line-height:20px}
.spi_heading{margin:0;font-size:18px;font-weight:600;line-height:26px}
.spi_intro{margin:0;color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:20px}
.spi_statusRow{display:flex;align-items:center;gap:8px;margin:0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.spi_statusText{display:inline-flex;align-items:center;gap:6px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.spi_grow{flex:1;min-width:0}
.spi_add{display:flex;align-items:center;gap:8px}
.spi_list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.spi_card{display:flex;flex-direction:column;gap:6px;min-width:0;padding:12px 14px;border:.5px solid var(--dsw-alias-settings-card-stroke);border-radius:var(--dsw-radius-xl);background:var(--dsw-alias-settings-card-fill)}
.spi_rowHead{display:flex;align-items:center;gap:10px;min-width:0}
.spi_name{flex:1;min-width:0;font-size:14px;font-weight:500;line-height:20px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.spi_path{display:block;font-family:var(--ds-font-family-code,var(--dsw-font-family));font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-module-platform);border-radius:var(--dsw-radius-sm);padding:1px 6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.spi_empty{margin:0;padding:14px 0;color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:20px}
.spi_note{margin:0;padding:8px 10px;border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-bg-module-platform);font-size:12px;line-height:18px;white-space:pre-wrap;word-break:break-word;max-height:180px;overflow:auto}
.spi_noteError{color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 8%, transparent)}
.spi_danger{color:var(--dsw-alias-state-error-primary)}
.spi_danger:hover{background:var(--dsw-alias-interactive-bg-hover-danger)}
`

const CSS_TAG_ID = '@dsh-external/dsh-super-injector/Panel.css'

/** 注入一次（官方 bundle 同款去重守卫）。 */
function ensureStyles(): void {
  if (typeof document === 'undefined') return
  if (document.querySelector('style[data-plugin-css=' + JSON.stringify(CSS_TAG_ID) + ']') !== null) return
  const tag = document.createElement('style')
  tag.dataset.plugin = '@dsh-external/dsh-super-injector'
  tag.dataset.pluginCss = CSS_TAG_ID
  tag.textContent = CSS
  document.head.appendChild(tag)
}

function fetchJson(path: string, init?: RequestInit): Promise<any> {
  return fetch(API + path, {
    headers: { 'content-type': 'application/json' },
    ...init,
  }).then((r) => r.json())
}

function SuperInjectorPanel(): JSX.Element {
  const [entries, setEntries] = useState<EntryInfo[] | null>(null)
  const [statsText, setStatsText] = useState('')
  const [msg, setMsg] = useState<{ text: string; isErr: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [unloading, setUnloading] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    ensureStyles()
  }, [])

  const say = useCallback((text: string, isErr = false) => {
    setMsg(text ? { text, isErr } : null)
  }, [])

  const refresh = useCallback((): void => {
    fetchJson('/list')
      .then((d: ListResp) => {
        if (!d?.ok) return say(JSON.stringify(d), true)
        const s = d.stats ?? {}
        const fmt = (k: string): string => `${s[k]?.ok ?? 0}✓/${s[k]?.fail ?? 0}✗`
        setStatsText(
          `共 ${d.entries.length} 个注入插件 · 本次启动：inject ${fmt('inject')} · reload ${fmt('reload')} · uninject ${fmt('uninject')}`,
        )
        setEntries(d.entries)
        say('')
      })
      .catch((err) => {
        say('加载失败: ' + err, true)
        setEntries([])
      })
  }, [say])

  useEffect(() => {
    refresh()
  }, [refresh])

  const injectDir = (): void => {
    const dir = draft.trim()
    if (!dir) {
      say('请先输入插件目录的绝对路径', true)
      return
    }
    setBusy(true)
    say('')
    fetchJson('/inject', { method: 'POST', body: JSON.stringify({ dir }) })
      .then((r) => {
        say(r?.result ?? JSON.stringify(r), !r?.ok)
        if (r?.ok) {
          setDraft('')
          refresh()
        }
      })
      .catch((err) => say('注入请求失败: ' + err, true))
      .finally(() => setBusy(false))
  }

  const uninstall = (entry: EntryInfo): void => {
    setUnloading(entry.name)
    fetchJson('/uninstall', { method: 'POST', body: JSON.stringify({ match: entry.name }) })
      .then((r) => say(r?.result ?? JSON.stringify(r), !r?.ok))
      .catch((err) => say('卸载请求失败: ' + err, true))
      .finally(() => {
        setUnloading(null)
        refresh()
      })
  }

  const dotState = msg?.isErr ? 'error' : entries === null ? 'ongoing' : 'done'

  return createElement(
    'div',
    { className: 'spi_section' },
    createElement('h2', { className: 'spi_heading' }, '注入插件'),
    createElement(
      'p',
      { className: 'spi_intro' },
      '运行时注入的插件不写入 profile 的 bundles，重启 DSH 后需要重新注入；持久安装请使用侧栏「插件」页（支持本地目录 / Git / npm）。',
    ),
    createElement(
      'p',
      { className: 'spi_statusRow', role: 'status' },
      createElement(
        'span',
        { className: 'spi_statusText' },
        createElement(StateDot, { state: dotState }),
        entries === null ? '正在加载…' : statsText,
      ),
      createElement('span', { className: 'spi_grow' }),
      createElement(Button, {
        variant: 'ghost',
        size: 'sm',
        icon: createElement(IconRefreshOutlineRegular, { size: 13 }),
        onClick: refresh,
        disabled: entries === null,
        'aria-label': '刷新注入列表',
      }, '刷新'),
    ),
    createElement(
      'div',
      { className: 'spi_add' },
      createElement(Input, {
        className: 'spi_grow',
        placeholder: '插件目录绝对路径（含 package.json + lib/）',
        value: draft,
        onChange: (e: { target: { value: string } }) => setDraft(e.target.value),
        onKeyDown: (e: { key: string }) => {
          if (e.key === 'Enter' && !busy) injectDir()
        },
        'aria-label': '插件目录绝对路径',
      }),
      createElement(Button, {
        variant: 'primary',
        size: 'md',
        disabled: busy || draft.trim() === '',
        onClick: injectDir,
      }, busy ? '注入中…' : '注入'),
    ),
    entries === null
      ? null
      : entries.length === 0
        ? createElement('p', { className: 'spi_empty' }, '暂无运行时注入的插件。')
        : createElement(
            'ul',
            { className: 'spi_list' },
            entries.map((e) =>
              createElement(
                'li',
                { className: 'spi_card', key: e.dir ?? e.name },
                createElement(
                  'div',
                  { className: 'spi_rowHead' },
                  createElement('span', { className: 'spi_name' }, String(e.name)),
                  createElement(Tag, { tone: e.active ? 'success' : 'neutral' }, e.active ? '运行中' : '未激活'),
                  createElement(Button, {
                    variant: 'ghost',
                    size: 'sm',
                    className: 'spi_danger',
                    icon: createElement(IconTrashOutlineRegular, { size: 13 }),
                    disabled: unloading === e.name,
                    onClick: () => uninstall(e),
                  }, unloading === e.name ? '卸载中…' : '卸载'),
                ),
                createElement('code', { className: 'spi_path', title: String(e.dir) }, String(e.dir)),
              ),
            ),
          ),
    msg
      ? createElement('pre', { className: 'spi_note' + (msg.isErr ? ' spi_noteError' : ''), role: msg.isErr ? 'alert' : undefined }, msg.text)
      : null,
  )
}

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.slots.inject('settings.section', () =>
    ctx.slots.register(
      {
        name: 'settings.section',
        id: 'super-injector-plugins',
        order: 50,
        label: () => '注入插件',
      },
      SuperInjectorPanel,
    ),
  ), 'super-injector: settings page')
}