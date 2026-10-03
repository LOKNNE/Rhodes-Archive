import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Shared Vite build for both Tauri desktop and the public web app.
// A relative base lets the same build work on GitHub Pages project URLs and
// inside Tauri without hard-coding a domain.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5174, strictPort: true, fs: { allow: [".."] } },
  build: {
    outDir: '../build/dist',
    emptyOutDir: true,
  },
})
