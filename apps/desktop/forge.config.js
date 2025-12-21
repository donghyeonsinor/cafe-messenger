const { VitePlugin } = require('@electron-forge/plugin-vite');
const path = require('path');
const fs = require('fs-extra');

module.exports = {
  packagerConfig: {
    // 네이티브 모듈(better-sqlite3)은 asar 압축에서 제외
    asar: {
      unpack: '**/node_modules/{better-sqlite3,bindings,file-uri-to-path}/**/*'
    }
  },
  rebuildConfig: {},
  hooks: {
    // 패키징 후 네이티브 모듈을 resources/app.asar.unpacked에 복사
    packageAfterPrune: async (_config, buildPath) => {
      const nativeModules = ['better-sqlite3', 'bindings', 'file-uri-to-path'];

      for (const moduleName of nativeModules) {
        const src = path.join(__dirname, 'node_modules', moduleName);
        const dest = path.join(buildPath, 'node_modules', moduleName);

        if (fs.existsSync(src)) {
          await fs.copy(src, dest, { overwrite: true });
          console.log(`[Forge Hook] Copied ${moduleName} to ${dest}`);
        } else {
          console.warn(`[Forge Hook] Module not found: ${src}`);
        }
      }
    }
  },
  makers: [
    {
      name: '@electron-forge/maker-zip',
      platforms: ['win32']
    }
  ],
  plugins: [
    new VitePlugin({
      // Main 프로세스 설정
      build: [
        {
          entry: 'src/main/main.js',
          config: 'vite.main.config.js'
        },
        {
          // Preload 스크립트 빌드
          entry: 'src/preload/preload.js',
          config: 'vite.preload.config.js'
        }
      ],
      // Renderer 프로세스 설정
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.js'
        }
      ]
    })
  ]
}