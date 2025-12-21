import { defineConfig } from 'vite';
import path from 'path';

// Renderer 프로세스용 Vite 설정
// https://www.electronforge.io/config/plugins/vite

export default defineConfig({
  root: path.resolve(__dirname, 'src/renderer'),
  build: {
    outDir: path.resolve(__dirname, '.vite/renderer'),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'src/renderer/index.html')
    }
  },
  server: {
    port: 5173,
    strictPort: true
  }
});
