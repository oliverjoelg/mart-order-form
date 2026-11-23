/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves the site at https://oliverjoelg.github.io/mart-order-form/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/mart-order-form/' : '/',
  plugins: [react()],
  server: { port: 5174 },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
}))
