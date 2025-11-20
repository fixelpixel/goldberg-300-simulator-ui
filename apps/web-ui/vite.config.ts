import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  root: './',
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, '../../packages/core-sterilizer'),
      '@sim': path.resolve(__dirname, '../../packages/io-simulation'),
    },
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname, '..'), path.resolve(__dirname, '..', '..')],
    },
  },
});
