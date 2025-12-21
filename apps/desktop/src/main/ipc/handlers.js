// IPC 핸들러 등록
// 모든 IPC 통신 핸들러를 중앙에서 관리

const { ipcMain } = require('electron');

/**
 * 모든 IPC 핸들러를 등록하는 함수
 * @param {BrowserWindow} mainWindow - 메인 윈도우 참조 (BrowserView 관리용)
 */
function registerIpcHandlers(mainWindow) {
  console.log('[IPC] Registering IPC handlers...');

  // 각 핸들러 모듈 가져오기
  const accountHandlers = require('./account-handler');
  const cafeHandlers = require('./cafe-handler');
  const templateHandlers = require('./template-handler');
  const memberHandlers = require('./member-handler');
  const naverHandlers = require('./naver-handler');

  // 핸들러 등록
  accountHandlers.register(ipcMain);
  cafeHandlers.register(ipcMain);
  templateHandlers.register(ipcMain);
  memberHandlers.register(ipcMain);
  naverHandlers.register(ipcMain, mainWindow);

  console.log('[IPC] All IPC handlers registered successfully');
}

module.exports = {
  registerIpcHandlers
};
