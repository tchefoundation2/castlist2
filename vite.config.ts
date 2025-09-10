import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync } from 'fs'
import { join } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react()
  ],
  publicDir: 'public',
  server: {
    host: true,
    port: 5173
  }
})
