import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 16392,
    proxy: {
      '/api': 'http://localhost:16393',
      '/ws': { target: 'ws://localhost:16393', ws: true },
    },
  },
});
