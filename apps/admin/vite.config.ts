import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // Resolve the shared package from source so no prebuild step is needed.
      '@store/shared-types': path.resolve(__dirname, '../../packages/shared-types/src/index.ts'),
    },
  },
  server: { port: 5173 },
});
