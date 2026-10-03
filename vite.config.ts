import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    watch: {
      ignored: [
        /(^|[/\\])(\.git|dist|공공데이터포탈API|ebro-agent-core|agent|public[/\\]downloads)([/\\]|$)|\.(tmp|pdf|exe|zip|log|cer|apk)$/i
      ],
    },
  },
})
