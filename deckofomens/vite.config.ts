import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // relative base so the built assets resolve when served under /deckofomens/
  base: './',
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  }
})
