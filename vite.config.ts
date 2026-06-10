import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Replace 'fm-simulator' with your exact repository name if it differs
export default defineConfig({
  plugins: [react()],
  base: '/fm-simulator/',
})