// 네이버 로그인 및 API 크롤링 IPC 핸들러
// BrowserWindow를 사용한 네이버 로그인, 쿠키 기반 API 크롤링

const { BrowserWindow, session } = require('electron')
const store = require('../store')

// 로그인 윈도우 인스턴스 (싱글톤)
let loginWindow = null
let mainWindow = null

// 네이버 URL
const NAVER_LOGIN_URL = 'https://nid.naver.com/nidlogin.login'

/**
 * MainWindow 참조 설정
 */
function setMainWindow(win) {
  mainWindow = win
}

/**
 * 로그인 윈도우 생성
 */
function createLoginWindow() {
  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.focus()
    return loginWindow
  }

  loginWindow = new BrowserWindow({
    width: 500,
    height: 700,
    title: '네이버 로그인',
    parent: mainWindow,
    modal: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  })

  // 윈도우 닫힐 때 참조 정리
  loginWindow.on('closed', () => {
    loginWindow = null
  })

  return loginWindow
}

/**
 * 로그인 윈도우 닫기
 */
function closeLoginWindow() {
  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.close()
    loginWindow = null
  }
}

/**
 * 로그인 상태 확인 (쿠키 기반)
 */
async function checkLoginStatus() {
  try {
    const cookies = await session.defaultSession.cookies.get({
      domain: '.naver.com',
      name: 'NID_AUT'
    })
    return cookies.length > 0
  } catch (error) {
    console.error('[Naver] 로그인 상태 확인 실패:', error)
    return false
  }
}

/**
 * 카페 URL 파싱 - cafeId, categoryId 추출
 * URL 형식: https://cafe.naver.com/f-e/cafes/{cafeId}/menus/{categoryId}
 */
function parseCafeUrl(url) {
  const regex = /cafe\.naver\.com\/f-e\/cafes\/(\d+)\/menus\/(\d+)/
  const match = url.match(regex)
  if (match) {
    return { cafeId: match[1], categoryId: match[2] }
  }
  return null
}

/**
 * API로 카페 게시글 크롤링
 */
async function crawlArticles(cafeId, categoryId, page = 1) {
  const apiUrl = `https://apis.naver.com/cafe-web/cafe-boardlist-api/v1/cafes/${cafeId}/menus/${categoryId}/articles?page=${page}&pageSize=15&sortBy=TIME&viewType=L`

  try {
    // 네이버 쿠키 가져오기
    const cookies = await session.defaultSession.cookies.get({ domain: '.naver.com' })
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ')

    const response = await fetch(apiUrl, {
      headers: {
        'Cookie': cookieString,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': `https://cafe.naver.com/f-e/cafes/${cafeId}/menus/${categoryId}`
      }
    })

    if (!response.ok) {
      throw new Error(`API 응답 오류: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('[Naver] API 크롤링 실패:', error)
    throw error
  }
}

/**
 * 게시글에서 작성자 정보 추출
 * API 응답 구조: articleList[].item.writerInfo.{nickName, memberKey}
 */
function extractMembers(articles) {
  const members = []

  if (!articles || !Array.isArray(articles)) {
    return members
  }

  for (const article of articles) {
    // 실제 API 응답 구조: article.item.writerInfo
    const writerInfo = article.item?.writerInfo

    if (writerInfo) {
      const nickName = writerInfo.nickName
      const memberKey = writerInfo.memberKey

      if (nickName && memberKey) {
        members.push({ nickName, memberKey })
      }
    }
  }

  return members
}

/**
 * IPC 핸들러 등록
 */
function register(ipcMain, win) {
  setMainWindow(win)

  // 로그인 창 열기
  ipcMain.handle('naver:openLogin', async () => {
    try {
      const window = createLoginWindow()
      await window.loadURL(NAVER_LOGIN_URL)

      // 페이지 이동 감지하여 로그인 성공 확인
      window.webContents.on('did-navigate', async (event, url) => {
        console.log('[Naver] 페이지 이동:', url)

        // 로그인 페이지가 아닌 곳으로 이동하면 로그인 성공으로 판단
        if (url.includes('naver.com') && !url.includes('nidlogin')) {
          const isLoggedIn = await checkLoginStatus()
          mainWindow?.webContents.send('naver:loginStatusChanged', isLoggedIn)

          if (isLoggedIn) {
            console.log('[Naver] 로그인 성공 감지')
          }
        }
      })

      console.log('[Naver] 로그인 창 열림')
      return { success: true }
    } catch (error) {
      console.error('[Naver] openLogin 실패:', error)
      throw error
    }
  })

  // 로그인 창 닫기
  ipcMain.handle('naver:closeWindow', async () => {
    try {
      closeLoginWindow()
      console.log('[Naver] 로그인 창 닫힘')
      return { success: true }
    } catch (error) {
      console.error('[Naver] closeWindow 실패:', error)
      throw error
    }
  })

  // 로그인 상태 확인
  ipcMain.handle('naver:checkLogin', async () => {
    return await checkLoginStatus()
  })

  // 자동 로그인 실행
  ipcMain.handle('naver:autoLogin', async (event, credentials) => {
    try {
      if (!loginWindow || loginWindow.isDestroyed()) {
        createLoginWindow()
        await loginWindow.loadURL(NAVER_LOGIN_URL)
        // 페이지 로드 대기
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      const { naver_id, naver_password } = credentials

      // 특수문자 이스케이프 처리
      const escapeForJs = (str) => {
        return str
          .replace(/\\/g, '\\\\')
          .replace(/'/g, "\\'")
          .replace(/"/g, '\\"')
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
      }

      const safeId = escapeForJs(naver_id)
      const safePw = escapeForJs(naver_password)

      // JavaScript로 폼 필드 채우기
      await loginWindow.webContents.executeJavaScript(`
        (function() {
          const idInput = document.getElementById('id');
          const pwInput = document.getElementById('pw');

          if (idInput && pwInput) {
            // 아이디 입력
            idInput.focus();
            idInput.value = '${safeId}';
            idInput.dispatchEvent(new Event('input', { bubbles: true }));

            // 비밀번호 입력
            pwInput.focus();
            pwInput.value = '${safePw}';
            pwInput.dispatchEvent(new Event('input', { bubbles: true }));

            // 로그인 버튼 클릭
            setTimeout(() => {
              const loginBtn = document.getElementById('log.login');
              if (loginBtn) {
                loginBtn.click();
              }
            }, 500);
          } else {
            console.error('[AutoLogin] 입력 필드를 찾을 수 없습니다');
          }
        })();
      `)

      console.log('[Naver] 자동 로그인 시도')
      return { success: true }
    } catch (error) {
      console.error('[Naver] autoLogin 실패:', error)
      throw error
    }
  })

  // API 기반 크롤링 시작 (로그인 불필요)
  ipcMain.handle('naver:startCrawling', async (event, options = {}) => {
    try {
      const { maxCount = 50 } = options

      // 활성화된 카페 목록 조회
      const cafes = store.find('cafes', cafe => cafe.is_active === 1)
      if (cafes.length === 0) {
        throw new Error('활성화된 카페가 없습니다. 카페 관리에서 카페를 추가하세요.')
      }

      const collectedMembers = new Map() // 중복 제거용 Map (memberKey를 키로)
      let totalProcessed = 0

      for (const cafe of cafes) {
        if (collectedMembers.size >= maxCount) break

        // URL 파싱
        const parsed = parseCafeUrl(cafe.cafe_url)
        if (!parsed) {
          console.log(`[Naver] URL 파싱 실패: ${cafe.cafe_url}`)
          continue
        }

        console.log(`[Naver] 크롤링 시작: ${cafe.cafe_name} (cafeId: ${parsed.cafeId}, categoryId: ${parsed.categoryId})`)

        // 페이지네이션 크롤링
        let page = 1
        const maxPages = 10 // 최대 10페이지

        while (page <= maxPages && collectedMembers.size < maxCount) {
          try {
            const data = await crawlArticles(parsed.cafeId, parsed.categoryId, page)

            // API 응답에서 게시글 배열 찾기
            const articles = data.result?.articleList || data.articleList || data.articles || []

            if (articles.length === 0) {
              console.log(`[Naver] 더 이상 게시글 없음 (page ${page})`)
              break
            }

            const members = extractMembers(articles)

            for (const member of members) {
              if (collectedMembers.size >= maxCount) break

              // 중복 체크
              if (!collectedMembers.has(member.memberKey)) {
                collectedMembers.set(member.memberKey, member)

                // 진행 상황 알림
                mainWindow?.webContents.send('naver:crawlProgress', {
                  current: collectedMembers.size,
                  total: maxCount,
                  member: member,
                  cafe: cafe.cafe_name
                })
              }
            }

            totalProcessed += articles.length
            page++

            // Rate limiting - 500ms 딜레이
            await new Promise(resolve => setTimeout(resolve, 500))

          } catch (pageError) {
            console.error(`[Naver] 페이지 ${page} 크롤링 오류:`, pageError)
            break
          }
        }
      }

      const resultMembers = Array.from(collectedMembers.values())
      console.log(`[Naver] 크롤링 완료: ${resultMembers.length}명`)

      // 크롤링 완료 알림
      mainWindow?.webContents.send('naver:crawlComplete', {
        success: true,
        count: resultMembers.length,
        members: resultMembers
      })

      return { success: true, members: resultMembers }
    } catch (error) {
      console.error('[Naver] startCrawling 실패:', error)

      mainWindow?.webContents.send('naver:crawlComplete', {
        success: false,
        error: error.message
      })

      throw error
    }
  })

  // 기존 핸들러 유지 (하위 호환성)
  ipcMain.handle('naver:closeView', async () => {
    return await ipcMain.handle('naver:closeWindow')
  })

  ipcMain.handle('naver:openCafe', async (event, cafeUrl) => {
    console.log('[Naver] openCafe는 더 이상 사용되지 않습니다. startCrawling을 사용하세요.')
    return { success: true, deprecated: true }
  })

  ipcMain.handle('naver:crawlMembers', async (event, options) => {
    return await ipcMain.handle('naver:startCrawling', event, options)
  })

  ipcMain.handle('naver:updateBounds', async () => {
    // BrowserWindow는 bounds 업데이트 불필요
    return { success: true }
  })

  console.log('[IPC] Naver handlers registered (BrowserWindow mode)')
}

module.exports = {
  register,
  setMainWindow,
  closeLoginWindow
}
