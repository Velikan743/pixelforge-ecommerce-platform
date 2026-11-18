import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/pixelforge-ecommerce-platform/' : '/',
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:4000' } },
  build: { target: 'es2022', cssCodeSplit: true },
});
