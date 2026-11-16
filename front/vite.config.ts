import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Version du build : donnée par la CI (tag vX.Y.Z) via APP_VERSION / APP_COMMIT ; « dev » en local.
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}

export default defineConfig({
  plugins: [vue()],
  define: {
    __APP_VERSION__: JSON.stringify(env.APP_VERSION || 'dev'),
    __APP_COMMIT__: JSON.stringify(env.APP_COMMIT || ''),
  },
  server: {
    host: true,
    port: 5173,
    fs: { allow: ['..'] }, // le dossier shared/ (règles du jeu) est hors de front/
  },
})
