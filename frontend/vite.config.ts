import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// Tailwind v4 공식 Vite 플러그인 — postcss.config 없이 CSS 파일 @import 만으로 동작
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
})
