import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `npm run build`        -> dist/ (index.html + assets/) to host or embed in the PHP site
// `npm run build:single` -> dist-single/index.html, one self-contained file (demo / offline use)
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [react(), viteSingleFile()] : [react()],
  build: mode === 'single' ? { outDir: 'dist-single' } : { outDir: 'dist' },
  test: { include: ['src/**/*.test.ts'] },
}))
