import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served from the custom domain eyedroptracker.com, so the base is "/".
export default defineConfig({
  plugins: [react()],
  base: '/',
})
