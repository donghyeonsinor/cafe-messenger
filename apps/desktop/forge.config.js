const { VitePlugin } = require('@electron-forge/plugin-vite');

module.exports = {
  packagerConfig: {},
  rebuildConfig: {},
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