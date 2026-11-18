/**
 * `@deepseek-ai/dsh-client-ui-primitives` 是 DSH 客户端的**平台 seed 模块**：
 * 运行时由 shell 的静态模块表注入（`dsh-web-frontend` 的 seed 表），磁盘上既无
 * JS 也无 .d.ts（`node_modules` 里没有这个包，也不发布到 npm）。
 *
 * 因此这里只声明用到的成员，形态刻意宽松——真实 props 由平台实现决定，本插件
 * 不复制其类型定义（复制会随宿主版本漂移）。tsdown 编译 client 时不做类型检查，
 * 且 tsconfig 已排除 src/client，故这些声明只服务于编辑器与 `tsc` 的可读性。
 */
declare module '@deepseek-ai/dsh-client-ui-primitives' {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  import type { ComponentType, ReactNode } from 'react'

  export const Button: ComponentType<any>
  export const Input: ComponentType<any>
  export const Tag: ComponentType<any>
  export const StateDot: ComponentType<any>
  export const Tooltip: ComponentType<any>
  export const IconRefreshOutlineRegular: ComponentType<{ size?: number; className?: string }>
  export const IconTrashOutlineRegular: ComponentType<{ size?: number; className?: string }>
}
