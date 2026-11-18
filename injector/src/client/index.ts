/**
 * dsh-super-injector 插件管理 UI（settings.section 页面）。
 * 功能：已注入插件列表 + 一键卸载 + 添加（路径输入/拖放提示）——
 *   - 直接注入：目录已是插件包（package.json + lib/）→ 立即注入
 *   - 内化：任意文件夹 → 新建 agent 会话 → AI 把内容变成插件
 * 通信：同源 fetch → host webServer API（/super-injector/api）
 *
 * ⚠️ 组件形态（DSH 0.2.1 契约）：`settings.section` 的 `component` 必须是
 * **React 组件**——shell（ui-settings-general）经 renderSlot 用
 * `jsx(Comp, props)` 挂载。旧版「`() => ({ render() {...} })` 实例工厂」在
 * 0.2.1 上 React 调用后得到纯对象 → "Objects are not valid as a React child"
 * → 页面空白（2026-11-18 实机定位）。此处接线全部走 React props/state。
 */
import { createElement, useCallback, useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import type { SlotsService } from '@deepseek-ai/dsh-client-ui-slots'

type ClientContext = {
  slots: SlotsService
}

export const inject = ['slots']

const API = '/super-injector/api'

type EntryInfo = { dir: string; name: string; at?: string; active?: boolean }
type ListResp = { ok?: boolean; entries: EntryInfo[]; stats?: Record<string, { ok: number; fail: number }> }

const styles = `
.spi-page{font-family:ui-monospace,monospace;font-size:12px;line-height:1.6;padding:14px 16px;max-width:720px}
.spi-page h3{margin:0 0 8px;font-size:13px}
.spi-add{border:1.5px dashed var(--theme-border,#555);border-radius:8px;padding:12px;margin-bottom:14px;text-align:center;color:var(--theme-text-secondary,#999)}
.spi-add.drag{border-color:var(--theme-accent,#4a9eff);background:rgba(74,158,255,.08)}
.spi-row{display:flex;gap:6px;margin-top:10px}
.spi-input{flex:1;background:var(--theme-input-bg,#111);color:var(--theme-text,#ddd);border:1px solid var(--theme-border,#333);border-radius:6px;padding:6px 8px;font-size:12px}
.spi-btn{background:var(--theme-accent,#4a9eff);color:#fff;border:none;border-radius:6px;padding:6px 12px;cursor:pointer;font-size:12px;white-space:nowrap}
.spi-btn.ghost{background:transparent;border:1px solid var(--theme-border,#444);color:var(--theme-text,#ccc)}
.spi-btn.danger{background:transparent;border:1px solid #d33;color:#d33}
.spi-btn:disabled{opacity:.45;cursor:not-allowed}
.spi-list{list-style:none;margin:0;padding:0}
.spi-item{display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--theme-border,#333);border-radius:8px;margin-bottom:6px}
.spi-item .name{flex:1;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.spi-item .dir{color:var(--theme-text-secondary,#888);font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:40%}
.spi-item .st{font-size:10px;padding:2px 6px;border-radius:10px}
.spi-item .st.on{background:rgba(46,204,113,.15);color:#2ecc71}
.spi-item .st.off{background:rgba(255,193,7,.12);color:#f1c40f}
.spi-msg{margin-top:10px;padding:8px 10px;border-radius:6px;background:var(--theme-input-bg,#111);border:1px solid var(--theme-border,#333);white-space:pre-wrap;max-height:180px;overflow:auto;font-size:11px}
.spi-stats{color:var(--theme-text-secondary,#888);font-size:11px;margin:0 0 10px}
`

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
  const [drag, setDrag] = useState(false)
  const [busy, setBusy] = useState(false)
  const [unloading, setUnloading] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const say = useCallback((text: string, isErr = false) => {
    setMsg(text ? { text, isErr } : null)
  }, [])

  const refresh = useCallback((): void => {
    fetchJson('/list')
      .then((d: ListResp) => {
        if (!d?.ok) return say(JSON.stringify(d), true)
        const s = d.stats ?? {}
        const fmt = (k: string): string => `${k} ${s[k]?.ok ?? 0}✓/${s[k]?.fail ?? 0}✗`
        setStatsText(`inject ${fmt('inject').replace('inject ', '')} · reload ${fmt('reload').replace('reload ', '')} · uninject ${fmt('uninject').replace('uninject ', '')} · 共 ${d.entries.length} 个注入插件`)
        setEntries(d.entries)
      })
      .catch((err) => say('加载失败: ' + err, true))
  }, [say])

  useEffect(() => {
    refresh()
    const timer = window.setInterval(refresh, 60000) // 60s 轮询（内化会话建好后自动出现）
    return () => window.clearInterval(timer)
  }, [refresh])

  const doAction = (path: string, label: string): void => {
    const dir = inputRef.current?.value.trim() ?? ''
    if (!dir) { say('请先输入文件夹路径', true); return }
    setBusy(true)
    say('')
    fetchJson(path, { method: 'POST', body: JSON.stringify({ dir, title: label }) })
      .then((r) => {
        say(r?.result ?? JSON.stringify(r), !r?.ok)
        if (r?.ok) setTimeout(refresh, 1200)
      })
      .catch((err) => say('请求失败: ' + err, true))
      .finally(() => setBusy(false))
  }

  const uninstall = (entry: EntryInfo): void => {
    setUnloading(entry.name)
    fetchJson('/uninstall', { method: 'POST', body: JSON.stringify({ match: entry.name }) })
      .then((r) => say(r?.result ?? JSON.stringify(r), !r?.ok))
      .catch((err) => say('卸载请求失败: ' + err, true))
      .finally(() => { setUnloading(null); setTimeout(refresh, 600) })
  }

  return createElement(
    'div',
    { className: 'spi-page' },
    createElement('style', null, styles),
    createElement('h3', null, '插件管理（dsh-super-injector）'),
    createElement('p', { className: 'spi-stats' }, statsText),
    // ── 添加区 ──
    createElement(
      'div',
      {
        className: 'spi-add' + (drag ? ' drag' : ''),
        onDragOver: (e: DragEvent) => { e.preventDefault(); setDrag(true) },
        onDragLeave: () => setDrag(false),
        onDrop: (e: DragEvent) => {
          e.preventDefault()
          setDrag(false)
          if (inputRef.current) inputRef.current.placeholder = '浏览器无法读取拖入文件夹的绝对路径——请粘贴路径或使用选择器'
        },
      },
      '拖入文件夹，或输入路径——「内化」= 新建会话让 AI 把内容变成插件；「注入」= 目录已是插件包直接注入',
      createElement(
        'div',
        { className: 'spi-row' },
        createElement('input', { ref: inputRef, className: 'spi-input', placeholder: '/absolute/path/to/folder' }),
        createElement('button', { className: 'spi-btn', disabled: busy, onClick: () => doAction('/ingest', '内化插件') }, busy ? '处理中…' : '内化（AI 造插件）'),
        createElement('button', { className: 'spi-btn ghost', disabled: busy, onClick: () => doAction('/inject', '直接注入') }, busy ? '处理中…' : '直接注入'),
      ),
    ),
    // ── 列表 ──
    createElement(
      'ul',
      { className: 'spi-list' },
      entries === null
        ? null
        : entries.length === 0
          ? createElement('li', { className: 'spi-item' }, '（暂无注入插件——拖入文件夹或输入路径开始）')
          : entries.map((e) =>
              createElement(
                'li',
                { className: 'spi-item', key: e.dir ?? e.name },
                createElement('span', { className: 'name' }, String(e.name)),
                createElement('span', { className: 'dir' }, String(e.dir)),
                createElement('span', { className: 'st ' + (e.active ? 'on' : 'off') }, e.active ? '运行中' : '未激活'),
                createElement(
                  'button',
                  { className: 'spi-btn danger', disabled: unloading === e.name, onClick: () => uninstall(e) },
                  unloading === e.name ? '卸载中…' : '卸载',
                ),
              ),
            ),
    ),
    // ── 消息 ──
    msg
      ? createElement(
          'div',
          { className: 'spi-msg', style: { borderColor: msg.isErr ? '#d33' : 'var(--theme-border,#333)' } },
          msg.text,
        )
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
        label: () => '插件管理',
      },
      SuperInjectorPanel,
    ),
  ), 'super-injector: settings page')
}