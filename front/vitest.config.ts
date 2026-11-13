import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    css: { include: [/.+/] },
    setupFiles: ['src/vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.ts'],
  },
})
