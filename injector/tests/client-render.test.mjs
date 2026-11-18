/**
 * client-render.test.mjs — 设置页「注入插件」面板的渲染回归锁
 *
 * ══ 两份病案（都是页面空白，症状一样、成因不同）══════════════════════════
 *   ① 2026-08：`component: () => ({ render() {...} })` 是 0.1.x 的实例工厂形态；
 *      0.2.x shell 用 `jsx(Comp, props)` 挂载 ⇒ React 得到纯对象 ⇒ 空白。
 *   ② 2026-11-18：形态修好后**视觉仍然脱轨**——页面用的是 `--theme-*` 变量，
 *      而这套变量在 DSH 0.2.1 里**根本不存在**（全站只有 `--dsw-*`）：
 *      每个 `var(--theme-x, #硬编码深色)` 都静默走兜底 ⇒ 浅色主题下整页发黑，
 *      加上等宽字体 / 1.5px 边框 / 6px 圆角，观感与原生设置页不是一套。
 *
 * ══ 这个测试锁什么 ═══════════════════════════════════════════════════════
 *   1. bundle 能在 ModuleLoader 包装下求值，`apply` 注册的确实是
 *      `settings.section`（id / order / label），且第二个参数是**函数**
 *      （React 组件），不是对象 —— 病案 ① 的直接回归锁。
 *   2. 真实挂载（jsdom + react-dom/client）后**有非空 DOM**，含列表行、
 *      状态标签、卸载按钮 —— 空白页的直接回归锁。
 *   3. 样式表**只含 `--dsw-*` token**，不含 `--theme-*` / 等宽字体 —— 病案 ②。
 *   4. 空列表分支也渲染（"暂无运行时注入的插件"），不炸。
 *
 * ⚠️ 测试**不复制实现**：直接读构建产物 `lib/client.js`（就是宿主实际加载的
 *   那一份），用桩替身提供平台原语（`dsh-client-ui-primitives` 是 seed 模块，
 *   磁盘上不存在，宿主运行时注入）。改坏了实现，这里就红。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const CLIENT = new URL('../lib/client.js', import.meta.url)
const src = readFileSync(CLIENT, 'utf8')

/** 平台原语的最小桩：形状对齐 0.2.1 seed 模块（Button/Tag/StateDot/Input + 图标）。 */
function makePrimitives(React) {
  const h = React.createElement
  return {
    Button: React.forwardRef(function Button({ variant = 'ghost', size = 'md', icon, className, children, ...rest }, ref) {
      return h('button', { ref, type: 'button', 'data-variant': variant, 'data-size': size, className, ...rest }, icon ?? null, children)
    }),
    Input: React.forwardRef(function Input({ icon, className, ...rest }, ref) {
      return h('span', null, icon ?? null, h('input', { ref, className, ...rest }))
    }),
    Tag: function Tag({ tone = 'outline', children }) { return h('span', { 'data-tone': tone }, children) },
    StateDot: function StateDot({ state = 'idle' }) { return h('span', { 'data-dot': state }) },
    IconRefreshOutlineRegular: function IconRefresh() { return h('svg', { 'data-icon': 'refresh' }) },
    IconTrashOutlineRegular: function IconTrash() { return h('svg', { 'data-icon': 'trash' }) },
  }
}

/**
 * 在 ModuleLoader 包装下求值 client bundle 并调用 apply，返回注册到的槽位。
 * @param React - react 实例（宿主 seed 里就是它）
 * @returns {{ id: string, order: number, label: string, component: unknown }}
 */
function loadClient(React) {
  const primitives = makePrimitives(React)
  const windowStub = {}
  let exports = null
  windowStub.__ModuleLoader__ = {
    load: (mod) => {
      exports = mod.factory((spec) => {
        if (spec === 'react') return React
        if (spec === '@deepseek-ai/dsh-client-ui-primitives') return primitives
        throw new Error('client bundle requires an unexpected module: ' + spec)
      })
    },
  }
  // bundle 是 `window.__ModuleLoader__.load({...})` 形态，求值时只需要 window
  new Function('window', src)(windowStub)
  assert.ok(exports && typeof exports.apply === 'function', 'bundle must export apply()')

  let registered = null
  const ctx = {
    effect: (fn) => fn(),
    slots: {
      inject: (name, factory) => {
        assert.equal(name, 'settings.section')
        return factory()
      },
      register: (entry, component) => {
        registered = { ...entry, component }
        return () => {}
      },
    },
  }
  exports.apply(ctx)
  assert.ok(registered, 'apply() must register a settings.section entry')
  return registered
}

test('client bundle evaluates and registers a React component (not a render-object factory)', async () => {
  const React = require('react')
  const reg = loadClient(React)
  assert.equal(reg.id, 'super-injector-plugins')
  assert.equal(reg.order, 50)
  assert.equal(typeof reg.label, 'function')
  assert.equal(reg.label(), '注入插件')
  // 病案 ①：必须是可直接 jsx() 的 React 组件，不能是返回 {render()} 的实例工厂。
  // 判据：函数（组件）而非对象（工厂返回物）；真正的挂载由下一个用例覆盖。
  assert.equal(typeof reg.component, 'function')
  assert.equal(typeof reg.component.render, 'undefined', 'legacy {render()} instance shape would render blank')
})

test('panel mounts with real DOM: rows, state tags, uninstall buttons', async () => {
  const { JSDOM } = require('jsdom')
  const React = require('react')
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { pretendToBeVisual: true })
  const prev = { window: globalThis.window, document: globalThis.document }
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  try {
    globalThis.fetch = async (url) => {
      if (String(url).endsWith('/list')) {
        return { json: async () => ({ ok: true, entries: [
          { name: '@probe/live', dir: '/tmp/probe/live', active: true },
          { name: '@probe/idle', dir: '/tmp/probe/idle', active: false },
        ], stats: { inject: { ok: 2, fail: 0 } } }) }
      }
      return { json: async () => ({ ok: true, result: 'OK' }) }
    }
    const reg = loadClient(React)
    const { createRoot } = require('react-dom/client')
    const root = createRoot(dom.window.document.getElementById('root'))
    await React.act(async () => { root.render(React.createElement(reg.component, {})) })
    await React.act(async () => { await new Promise((r) => setTimeout(r, 30)) })

    const html = dom.window.document.body.innerHTML
    assert.match(html, /注入插件/)
    assert.match(html, /@probe\/live/)
    assert.match(html, /@probe\/idle/)
    assert.match(html, /运行中/)
    assert.match(html, /未激活/)
    assert.match(html, /卸载/)
    assert.match(html, /共 2 个注入插件/)
    assert.match(html, /<\/(ul|li)>|spi_card/, 'list rows must render')

    const css = [...dom.window.document.querySelectorAll('style[data-plugin-css]')].map((s) => s.textContent).join('\n')
    assert.ok(css.length > 0, 'panel must inject its stylesheet once')
    // 病案 ②：只允许 DSH 设计 token
    assert.ok(!css.includes('--theme-'), 'panel CSS must not use the nonexistent --theme-* variables')
    assert.ok(!css.includes('ui-monospace'), 'panel must use the host font stack, not a monospace body font')
    assert.match(css, /var\(--dsw-alias-label-primary\)/)
    assert.match(css, /border:\s*\.5px/, 'hairlines follow the host .5px convention')
    assert.match(css, /var\(--dsw-radius-(md|lg|xl)\)/)
  } finally {
    globalThis.window = prev.window
    globalThis.document = prev.document
    delete globalThis.IS_REACT_ACT_ENVIRONMENT
  }
})

test('empty registry renders the empty state instead of nothing', async () => {
  const { JSDOM } = require('jsdom')
  const React = require('react')
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { pretendToBeVisual: true })
  const prev = { window: globalThis.window, document: globalThis.document }
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  try {
    globalThis.fetch = async () => ({ json: async () => ({ ok: true, entries: [], stats: {} }) })
    const reg = loadClient(React)
    const { createRoot } = require('react-dom/client')
    const root = createRoot(dom.window.document.getElementById('root'))
    await React.act(async () => { root.render(React.createElement(reg.component, {})) })
    await React.act(async () => { await new Promise((r) => setTimeout(r, 30)) })
    const html = dom.window.document.body.innerHTML
    assert.match(html, /暂无运行时注入的插件/)
    assert.match(html, /共 0 个注入插件/)
  } finally {
    globalThis.window = prev.window
    globalThis.document = prev.document
    delete globalThis.IS_REACT_ACT_ENVIRONMENT
  }
})