import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// The dev server serves the React app and proxies /api/* to the Express
// backend, so the frontend always uses same-origin URLs (no CORS setup
// needed). Connection details come from client/.env (see .env.example).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());

  return {
    plugins: [react()],
    server: {
      // Loopback only: the dev server stays private to this machine.
      // (Set to '0.0.0.0' to expose it to the LAN for phone demos.)
      host: 'localhost',
      port: 5173,
      strictPort: true,
      allowedHosts: true,
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET || 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
  };
});
