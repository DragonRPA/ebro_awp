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

import os from 'os';
import fs from 'fs';
import path from 'path';

function developerDevicePlugin(): Plugin {
  return {
    name: 'developer-device-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && (req.url === '/downloads/eBroDevPCRegister.exe' || req.url.startsWith('/downloads/eBroDevPCRegister.exe'))) {
          const exePath = path.resolve(__dirname, 'public/downloads/eBroDevPCRegister.exe');
          if (fs.existsSync(exePath)) {
            res.setHeader('Content-Type', 'application/vnd.microsoft.portable-executable');
            res.setHeader('Content-Disposition', 'attachment; filename="eBroDevPCRegister.exe"');
            res.statusCode = 200;
            fs.createReadStream(exePath).pipe(res);
            return;
          }
        }

        if (req.url && req.url.startsWith('/api/device/physical-mac')) {
          try {
            const ifaces = os.networkInterfaces();
            const macs = Object.values(ifaces)
              .flat()
              .filter(i => i && !i.internal && i.mac && i.mac !== '00:00:00:00:00:00')
              .map(i => i!.mac.toUpperCase().replace(/:/g, '-'));
            const uniqueMacs = [...new Set(macs)];

            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.statusCode = 200;
            res.end(JSON.stringify({
              success: true,
              macAddresses: uniqueMacs,
              hostname: os.hostname(),
              platform: os.platform()
            }));
          } catch (e: any) {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: e?.message || String(e) }));
          }
          return;
        }
        next();
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), r2DevPlugin(), developerDevicePlugin()],
  server: {
    port: 5174,
    watch: {
      ignored: [
        /(^|[/\\])(\.git|dist|공공데이터포탈API|ebro-agent-core|agent|public[/\\]downloads)([/\\]|$)|\.(tmp|pdf|exe|zip|log|cer|apk)$/i
      ],
    },
  },
  build: {
    sourcemap: false, // 🛡️ 역공학 방어: 프로덕션 원본 TypeScript 소스맵 완전 배제
    minify: 'esbuild',
    target: 'es2020',
    cssMinify: true,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 1500,
  },
  esbuild: {
    // 🛡️ 프로덕션 번들에서 console.log, console.debug, debugger 구문 영구 드롭
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
    legalComments: 'none',
  }
})
