import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['@telegram-apps/bridge']
  },
  server: {
    port: 3000,
    host: true
  },
  build: {
    rollupOptions: {
      external: ['@telegram-apps/bridge']
    }
  }
});