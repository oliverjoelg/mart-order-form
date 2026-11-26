/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Content-Security-Policy for the built site. GitHub Pages can't send security headers, so it goes
 * in a <meta> tag. Only on `build`: the dev server needs inline scripts for hot reload.
 * Allows: our own files, Google Fonts, and the Supabase project (API, storage images, realtime).
 */
export function cspFor(supabaseUrl: string | undefined): string {
  const sb = supabaseUrl ? new URL(supabaseUrl).origin : ''
  const sbWs = sb ? sb.replace(/^https:/, 'wss:') : ''
  return [
    "default-src 'self'",
    "script-src 'self'",
    // React sets inline style attributes (swatch colours, sizes)
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    `img-src 'self' data: blob: ${sb}`.trim(),
    `connect-src 'self' ${sb} ${sbWs}`.trim(),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}

function csp(supabaseUrl: string | undefined): Plugin {
  return {
    name: 'mart-csp',
    apply: 'build',
    transformIndexHtml: (html) =>
      html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${cspFor(supabaseUrl)}" />`),
  }
}

// GitHub Pages serves the site at https://oliverjoelg.github.io/mart-order-form/
export default defineConfig(({ command, mode, isPreview }) => {
  const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env }
  return {
    base: command === 'build' || isPreview ? '/mart-order-form/' : '/',
    plugins: [react(), csp(env.VITE_SUPABASE_URL)],
    server: { port: 5174 },
    test: { environment: 'node', include: ['src/**/*.test.ts'] },
  }
})
