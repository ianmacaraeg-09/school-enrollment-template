import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// base './' + HashRouter => the built folder works from any sub-path
// (a portfolio page, an <iframe>, Netlify, GitHub Pages) with no server rewrites.
export default defineConfig({
  base: './',
  plugins: [react()],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
