import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/ws': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
  resolve: {
    alias: {
      'react-router': path.resolve(__dirname, 'node_modules/react-router/dist/index.js'),
      'react-router-dom': path.resolve(__dirname, 'node_modules/react-router-dom/dist/index.js'),
    },
  },
  build: {
    minify: false,
    rollupOptions: {
      treeshake: false,
    },
  },
});