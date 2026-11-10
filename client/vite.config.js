import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_DEV_API_PROXY || 'http://localhost:5000';
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      // In development the SPA calls /api on its own origin and Vite proxies to Express,
      // so cookies stay first-party and no CORS is needed.
      proxy: { '/api': { target: apiTarget, changeOrigin: false } },
    },
    preview: { port: 4173, proxy: { '/api': { target: apiTarget } } },
    build: {
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (/react-router|react-dom|[\\/]react[\\/]|scheduler/.test(id)) return 'react';
              if (/react-hook-form|@hookform|zod/.test(id)) return 'forms';
              if (id.includes('lucide-react')) return 'icons';
            }
          },
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.js'],
      css: false,
    },
  };
});
