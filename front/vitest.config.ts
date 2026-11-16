import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  define: { __APP_VERSION__: JSON.stringify('test'), __APP_COMMIT__: JSON.stringify('') },
  test: {
    environment: 'jsdom',
    globals: true,
    css: { include: [/.+/] },
    setupFiles: ['src/vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.ts'],
  },
})
