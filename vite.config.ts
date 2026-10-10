import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

function r2DevPlugin(): Plugin {
  return {
    name: 'r2-dev-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/api/r2')) {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, files: [] }));
          });
          return;
        }
        next();
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), r2DevPlugin()],
  server: {
    port: 5174,
    watch: {
      ignored: [
        /(^|[/\\])(\.git|dist|공공데이터포탈API|ebro-agent-core|agent|public[/\\]downloads)([/\\]|$)|\.(tmp|pdf|exe|zip|log|cer|apk)$/i
      ],
    },
  },
})
