const { app, BrowserWindow } = require('electron/main')
const path = require('node:path')
const { registerIpcHandlers } = require('./ipc/handlers')

// 메인 윈도우 참조 (전역)
let mainWindow = null

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      // Vite 빌드 후 main.js와 preload.js가 같은 디렉토리에 위치
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Vite 개발 서버 또는 빌드된 파일 로드
  // Electron Forge + Vite 플러그인이 환경 변수를 주입함
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    // 개발 모드: Vite dev server 사용
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
  } else {
    // 프로덕션: 빌드된 파일 로드
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`))
  }

  // 윈도우 닫힐 때 참조 정리
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  return mainWindow
}

/**
 * 메인 윈도우 참조 반환
 */
function getMainWindow() {
  return mainWindow
}

app.whenReady().then(() => {
  const win = createWindow()

  // IPC 핸들러 등록 (mainWindow 전달)
  registerIpcHandlers(win)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})