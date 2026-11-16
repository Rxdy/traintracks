/// <reference types="vite/client" />

declare const __APP_VERSION__: string // version du build (tag vX.Y.Z, ou « dev »)
declare const __APP_COMMIT__: string

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}
