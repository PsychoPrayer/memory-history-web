import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  /* Relative asset URLs so Capacitor (file:// / capacitor://) loads JS/CSS. */
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
})
