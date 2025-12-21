const { app, BrowserWindow } = require('electron/main')
const path = require('node:path')
const { registerIpcHandlers } = require('./ipc/handlers')

// 메인 윈도우 참조 (전역)
let mainWindow = null
let store = null

// store 모듈 로드 시도
try {
  store = require('./store')
  console.log('[Main] Store module loaded successfully')
} catch (error) {
  console.error('[Main] Failed to load store module:', error)
}

const createWindow = () => {
  console.log('[Main] Creating window...')
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // 준비될 때까지 숨김
    webPreferences: {
      // Vite 빌드 후 main.js와 preload.js가 같은 디렉토리에 위치
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // 준비되면 창 표시
  mainWindow.once('ready-to-show', () => {
    console.log('[Main] Window ready to show')
    mainWindow.show()
  })

  // 로드 실패 시 에러 표시
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('[Main] Failed to load:', errorCode, errorDescription)
    mainWindow.show() // 에러가 있어도 창은 표시
  })

  // Vite 개발 서버 또는 빌드된 파일 로드
  // Electron Forge + Vite 플러그인이 환경 변수를 주입함
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    // 개발 모드: Vite dev server 사용
    console.log('[Main] Loading dev server URL:', MAIN_WINDOW_VITE_DEV_SERVER_URL)
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
  } else {
    // 프로덕션: 빌드된 파일 로드
    const indexPath = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    console.log('[Main] Loading file:', indexPath)
    mainWindow.loadFile(indexPath).catch(err => {
      console.error('[Main] loadFile error:', err)
      mainWindow.show() // 에러가 있어도 창은 표시
    })
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
  console.log('[Main] App ready')

  // 데이터베이스 초기화
  try {
    if (store) {
      store.initialize()
      console.log('[Main] Store initialized')
    } else {
      console.warn('[Main] Store not available, skipping initialization')
    }
  } catch (error) {
    console.error('[Main] Store initialization failed:', error)
  }

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

// 앱 종료 시 데이터베이스 연결 정리
app.on('will-quit', () => {
  if (store) {
    store.close()
  }
})