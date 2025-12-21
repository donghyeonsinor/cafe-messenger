import { defineConfig } from 'vite';
import path from 'path';

// Main 프로세스용 Vite 설정
// https://www.electronforge.io/config/plugins/vite

export default defineConfig({
  resolve: {
    // browserField: false,
    mainFields: ['module', 'jsnext:main', 'jsnext'],
  },
  build: {
    // Main 프로세스는 Node.js 환경
    rollupOptions: {
      external: [
        'electron',
        'better-sqlite3',
        'electron-store'
      ]
    }
  }
});
