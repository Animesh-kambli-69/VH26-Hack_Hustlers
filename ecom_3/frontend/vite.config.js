import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Same-origin proxy so the dashboard works with the backend's default CORS
// config (CORS_ORIGIN=http://localhost:3000). Set VITE_API_BASE_URL to an
// absolute URL to bypass the proxy in production.
const apiProxy = {
  "/api": {
    target: "http://localhost:3000",
    changeOrigin: true,
  },
};

export default defineConfig({
  plugins: [react()],
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          charts: ["recharts"],
        },
      },
    },
  },
});