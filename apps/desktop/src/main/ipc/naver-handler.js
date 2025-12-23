// 네이버 로그인 및 API 크롤링 IPC 핸들러
// BrowserWindow를 사용한 네이버 로그인, 쿠키 기반 API 크롤링

const { BrowserWindow, session } = require('electron')

// 로그인 윈도우 인스턴스 (싱글톤)
let loginWindow = null
let getMainWindow = null // 함수로 변경

// 네이버 URL
const NAVER_LOGIN_URL = 'https://nid.naver.com/nidlogin.login'

/**
 * MainWindow getter 함수 설정
 */
function setMainWindowGetter(getter) {
  getMainWindow = getter
}

/**
 * MainWindow 참조 가져오기
 */
function getMainWindowRef() {
  return getMainWindow ? getMainWindow() : null
}

/**
 * 로그인 윈도우 생성
 */
function createLoginWindow() {
  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.focus()
    return loginWindow
  }

  const mainWin = getMainWindowRef()
  loginWindow = new BrowserWindow({
    width: 500,
    height: 700,
    title: '네이버 로그인',
    parent: mainWin,
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
 * 쪽지 발송 폼 정보 조회
 * @param {string} targetCafeMemberKey - 수신자 memberKey
 * @returns {Promise<object>} { token, svcCode, svcType, todaySentCount, userId }
 */
async function getSendFormInfo(targetCafeMemberKey) {
  const url = `https://note.naver.com/compose/sendForm.nhn?popup=1&svcType=2&targetCafeMemberKey=${targetCafeMemberKey}`

  try {
    const cookies = await session.defaultSession.cookies.get({ domain: '.naver.com' })
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ')

    const response = await fetch(url, {
      headers: {
        'Cookie': cookieString,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://cafe.naver.com/'
      }
    })

    if (!response.ok) {
      throw new Error(`폼 조회 실패: ${response.status}`)
    }

    const html = await response.text()

    // HTML에서 필요한 정보 추출
    const tokenMatch = html.match(/name="token"\s+value="([^"]+)"/)
    const svcCodeMatch = html.match(/name="svcCode"\s+value="([^"]+)"/)
    const svcTypeMatch = html.match(/name="svcType"\s+value="([^"]+)"/)
    const todaySentCountMatch = html.match(/name="todaySentCount"\s+value="([^"]+)"/)
    const userIdMatch = html.match(/name="userId"\s+value="([^"]+)"/)

    if (!tokenMatch) {
      throw new Error('토큰을 찾을 수 없습니다')
    }

    return {
      token: tokenMatch[1],
      svcCode: svcCodeMatch ? svcCodeMatch[1] : '',
      svcType: svcTypeMatch ? svcTypeMatch[1] : '2',
      todaySentCount: todaySentCountMatch ? parseInt(todaySentCountMatch[1]) : 0,
      userId: userIdMatch ? userIdMatch[1] : ''
    }
  } catch (error) {
    console.error('[Naver] getSendFormInfo 실패:', error)
    throw error
  }
}

/**
 * Captcha 생성 요청
 * @param {string} targetCafeMemberKey - 수신자 memberKey
 * @param {string} userId - 사용자 ID
 * @returns {Promise<object>}
 */
async function createCaptcha(targetCafeMemberKey, userId) {
  const url = 'https://note.naver.com/json/captcha/create/'

  try {
    const cookies = await session.defaultSession.cookies.get({ domain: '.naver.com' })
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ')

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Cookie': cookieString,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': `https://note.naver.com/compose/sendForm.nhn?popup=1&svcType=2&targetCafeMemberKey=${targetCafeMemberKey}`
      },
      body: `userId=${encodeURIComponent(userId)}`
    })

    if (!response.ok) {
      throw new Error(`Captcha 생성 실패: ${response.status}`)
    }

    const data = await response.json()
    console.log('[Naver] Captcha 생성 응답:', data)
    return data
  } catch (error) {
    console.error('[Naver] createCaptcha 실패:', error)
    throw error
  }
}

/**
 * 페이지 뷰 요청 (pv.jsp)
 * @returns {Promise<void>}
 */
async function sendPageView() {
  const timestamp = Date.now()
  const url = `https://note.naver.com/pv/pv.jsp?_=${timestamp}`

  try {
    const cookies = await session.defaultSession.cookies.get({ domain: '.naver.com' })
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ')

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Cookie': cookieString,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://note.naver.com/compose/sendForm.nhn',
        'Accept': '*/*',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'script',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Site': 'same-origin'
      }
    })

    console.log(`[Naver] 페이지 뷰 요청 완료: ${response.status}`)
  } catch (error) {
    // 페이지 뷰 실패는 무시 (발송에 영향 없음)
    console.log('[Naver] 페이지 뷰 요청 실패 (무시):', error.message)
  }
}

/**
 * 쪽지 발송 API 호출
 * @param {string} targetCafeMemberKey - 수신자 memberKey
 * @param {string} content - 메시지 내용
 * @param {object} formInfo - 폼 정보 { token, svcCode, svcType }
 * @returns {Promise<object>} { success, error }
 */
async function sendMessage(targetCafeMemberKey, content, formInfo) {
  const url = 'https://note.naver.com/json/write/send/'

  try {
    const cookies = await session.defaultSession.cookies.get({ domain: '.naver.com' })
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ')

    // 폼 데이터 구성
    const formData = new URLSearchParams()
    formData.append('token', formInfo.token)
    formData.append('svcCode', formInfo.svcCode)
    formData.append('svcType', formInfo.svcType)
    formData.append('targetCafeMemberKey', targetCafeMemberKey)
    formData.append('content', content)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Cookie': cookieString,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': `https://note.naver.com/compose/sendForm.nhn?popup=1&svcType=2&targetCafeMemberKey=${targetCafeMemberKey}`,
        'Origin': 'https://note.naver.com'
      },
      body: formData.toString()
    })

    if (!response.ok) {
      throw new Error(`API 응답 오류: ${response.status}`)
    }

    const data = await response.json()
    console.log('[Naver] 쪽지 발송 응답:', data)

    // 응답 확인 (resultCode가 SUCCESS인 경우 성공)
    if (data.resultCode === 'SUCCESS' || data.result === 'success') {
      return { success: true }
    } else {
      return { success: false, error: data.resultMessage || data.message || '발송 실패' }
    }
  } catch (error) {
    console.error('[Naver] sendMessage 실패:', error)
    return { success: false, error: error.message }
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
 * API 응답 구조: articleList[].item.{writerInfo.{nickName, memberKey}, writeDateTimestamp}
 */
function extractMembers(articles) {
  const members = []

  if (!articles || !Array.isArray(articles)) {
    return members
  }

  for (const article of articles) {
    // 실제 API 응답 구조: article.item
    const item = article.item
    const writerInfo = item?.writerInfo

    if (writerInfo) {
      const nickName = writerInfo.nickName
      const memberKey = writerInfo.memberKey
      const writeDateTimestamp = item?.writeDateTimestamp

      if (nickName && memberKey) {
        members.push({
          nickName,
          memberKey,
          writeDate: writeDateTimestamp ? new Date(writeDateTimestamp).toISOString() : null,
          writeDateTimestamp: writeDateTimestamp || null
        })
      }
    }
  }

  return members
}

/**
 * 날짜 필터 계산 - 선택된 기간의 최소 타임스탬프 반환
 * @param {string} datePeriod - '1day', '2days', '3days', '1week', '1month'
 * @returns {number|null} 최소 타임스탬프 (밀리초)
 */
function getDateFilter(datePeriod) {
  if (!datePeriod) return null

  const now = Date.now()
  const periods = {
    '1day': 1 * 24 * 60 * 60 * 1000,
    '2days': 2 * 24 * 60 * 60 * 1000,
    '3days': 3 * 24 * 60 * 60 * 1000,
    '1week': 7 * 24 * 60 * 60 * 1000,
    '1month': 30 * 24 * 60 * 60 * 1000
  }

  return now - (periods[datePeriod] || 0)
}

/**
 * IPC 핸들러 등록
 * @param {object} ipcMain - Electron IPC 메인 모듈
 * @param {function} mainWindowGetter - 메인 윈도우 참조 함수
 * @param {object} store - 초기화된 DataStore 인스턴스
 */
function register(ipcMain, mainWindowGetter, store) {
  setMainWindowGetter(mainWindowGetter)

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
          getMainWindowRef()?.webContents.send('naver:loginStatusChanged', isLoggedIn)

          if (isLoggedIn) {
            console.log('[Naver] 로그인 성공 감지 - 창 자동 닫기')

            // Renderer에 로그인 완료 이벤트 전송
            getMainWindowRef()?.webContents.send('naver:loginComplete', {
              success: true
            })

            // 1초 후 로그인 창 닫기 (사용자가 성공 화면을 잠시 볼 수 있도록)
            setTimeout(() => {
              closeLoginWindow()
            }, 1000)
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

      // JavaScript로 폼 필드 채우기 (아이디, 비밀번호 입력만)
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
          } else {
            console.error('[AutoLogin] 입력 필드를 찾을 수 없습니다');
          }
        })();
      `)

      console.log('[Naver] 아이디/비밀번호 자동 입력 완료')
      return { success: true }
    } catch (error) {
      console.error('[Naver] autoLogin 실패:', error)
      throw error
    }
  })

  // API 기반 크롤링 시작 (날짜 필터링 지원)
  ipcMain.handle('naver:startCrawling', async (event, options = {}) => {
    try {
      const { datePeriod } = options

      // 탐색 기한 필수 체크
      if (!datePeriod) {
        throw new Error('탐색 기한을 선택해주세요.')
      }

      // 활성화된 카페 목록 조회
      const cafes = store.find('cafes', cafe => cafe.is_active === 1)
      if (cafes.length === 0) {
        throw new Error('활성화된 카페가 없습니다. 카페 관리에서 카페를 추가하세요.')
      }

      // 날짜 필터 계산
      const minTimestamp = getDateFilter(datePeriod)
      const now = new Date()
      console.log(`[Naver] 현재 시간: ${now.toISOString()} (KST: ${now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })})`)
      console.log(`[Naver] 탐색 기한: ${datePeriod}, 최소 타임스탬프: ${new Date(minTimestamp).toISOString()} (KST: ${new Date(minTimestamp).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })})`)

      // DB에 이미 등록된 회원 목록 조회 (제외 대상)
      const existingMembers = store.getAll('members')
      const existingMemberKeys = new Set(existingMembers.map(m => m.member_key))
      console.log(`[Naver] DB에 등록된 회원 수: ${existingMemberKeys.size}명 (제외 대상)`)

      const collectedMembers = new Map() // 중복 제거용 Map (memberKey를 키로)
      let totalProcessed = 0

      for (const cafe of cafes) {
        // URL 파싱
        const parsed = parseCafeUrl(cafe.cafe_url)
        if (!parsed) {
          console.log(`[Naver] URL 파싱 실패: ${cafe.cafe_url}`)
          continue
        }

        console.log(`[Naver] 크롤링 시작: ${cafe.cafe_name} (cafeId: ${parsed.cafeId}, categoryId: ${parsed.categoryId})`)

        // 페이지네이션 크롤링
        let page = 1
        const maxPages = 100 // 기간 내 모든 게시글 수집을 위해 페이지 제한 증가
        let reachedDateLimit = false

        while (page <= maxPages && !reachedDateLimit) {
          try {
            const data = await crawlArticles(parsed.cafeId, parsed.categoryId, page)

            // 디버깅: API 응답 구조 확인
            console.log(`[Naver] API 응답 키:`, Object.keys(data))
            if (data.result) {
              console.log(`[Naver] result 키:`, Object.keys(data.result))
            }

            // API 응답에서 게시글 배열 찾기
            const articles = data.result?.articleList || data.articleList || data.articles || []

            // 디버깅: 첫 번째 게시글 구조 확인
            if (articles.length > 0 && page === 1) {
              console.log(`[Naver] 첫 번째 게시글 구조:`, JSON.stringify(articles[0], null, 2).substring(0, 500))
            }

            if (articles.length === 0) {
              console.log(`[Naver] 더 이상 게시글 없음 (page ${page})`)
              break
            }

            const members = extractMembers(articles)

            for (const member of members) {
              // 디버깅: 게시글 날짜 정보 출력
              if (member.writeDateTimestamp) {
                const writeDate = new Date(member.writeDateTimestamp)
                console.log(`[Naver] 게시글 날짜: ${writeDate.toISOString()} (KST: ${writeDate.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}) - ${member.nickName}`)
              }

              // 날짜 필터링: 기간 외 게시글은 스킵
              if (member.writeDateTimestamp && member.writeDateTimestamp < minTimestamp) {
                // 시간순 정렬이므로 기간 외 게시글이 나오면 이후 페이지도 모두 기간 외
                console.log(`[Naver] 기간 외 게시글 도달 - 게시글: ${new Date(member.writeDateTimestamp).toISOString()}, 기준: ${new Date(minTimestamp).toISOString()}`)
                reachedDateLimit = true
                break
              }

              // DB에 이미 등록된 회원인지 확인
              if (existingMemberKeys.has(member.memberKey)) {
                console.log(`[Naver] DB 등록 회원 스킵: ${member.nickName} (${member.memberKey.substring(0, 8)}...)`)
                continue
              }

              // 중복 체크
              if (!collectedMembers.has(member.memberKey)) {
                // 카페 정보 추가
                member.cafeId = cafe.id
                member.cafeName = cafe.cafe_name
                collectedMembers.set(member.memberKey, member)

                // 진행 상황 알림
                getMainWindowRef()?.webContents.send('naver:crawlProgress', {
                  current: collectedMembers.size,
                  member: member,
                  cafe: cafe.cafe_name,
                  datePeriod: datePeriod
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

        if (reachedDateLimit) {
          console.log(`[Naver] ${cafe.cafe_name} 카페 탐색 완료 (기간 제한 도달)`)
        }
      }

      const resultMembers = Array.from(collectedMembers.values())
      console.log(`[Naver] 크롤링 완료: ${resultMembers.length}명 (${datePeriod} 이내)`)

      // 크롤링 완료 알림
      getMainWindowRef()?.webContents.send('naver:crawlComplete', {
        success: true,
        count: resultMembers.length,
        members: resultMembers,
        datePeriod: datePeriod
      })

      return { success: true, members: resultMembers }
    } catch (error) {
      console.error('[Naver] startCrawling 실패:', error)

      getMainWindowRef()?.webContents.send('naver:crawlComplete', {
        success: false,
        error: error.message
      })

      throw error
    }
  })

  // 대량 쪽지 발송 시작 (API 기반)
  ipcMain.handle('naver:startSending', async (event, { members, content }) => {
    try {
      const isLoggedIn = await checkLoginStatus()
      if (!isLoggedIn) {
        throw new Error('로그인이 필요합니다')
      }

      if (members.length === 0) {
        throw new Error('발송할 회원이 없습니다')
      }

      console.log(`[Naver] 대량 발송 시작 (API): ${members.length}명, 내용 길이: ${content.length}자`)

      // 첫 번째 회원으로 초기 폼 정보 조회 (todaySentCount 확인용)
      const initialFormInfo = await getSendFormInfo(members[0].memberKey)
      console.log(`[Naver] 오늘 발송 건수: ${initialFormInfo.todaySentCount}건`)

      const results = {
        success: 0,
        failed: 0
      }

      // 초기 상태를 UI에 전송
      getMainWindowRef()?.webContents.send('naver:sendProgress', {
        current: 0,
        total: members.length,
        member: null,
        initialInfo: true,
        todaySentCount: initialFormInfo.todaySentCount
      })

      const total = members.length

      for (let i = 0; i < members.length; i++) {
        const member = members[i]

        console.log(`[Naver] 발송 중 (${i + 1}/${total}): ${member.nickName}`)

        try {
          // 1. 폼 정보 조회 (각 회원마다 새 토큰 획득)
          const formInfo = await getSendFormInfo(member.memberKey)

          // 2. 페이지 뷰 요청
          await sendPageView()

          // 3. Captcha 생성 요청
          await createCaptcha(member.memberKey, formInfo.userId)

          // 4. 쪽지 발송
          const result = await sendMessage(member.memberKey, content, formInfo)

          if (result.success) {
            results.success++

            // 발송 완료 회원 DB에 저장
            try {
              store.create('members', {
                cafe_id: member.cafeId || null,
                nickname: member.nickName,
                member_key: member.memberKey
              })
              console.log(`[Naver] 회원 DB 저장 완료: ${member.nickName}`)
            } catch (dbError) {
              // 중복 회원 등 DB 오류는 무시 (이미 저장된 경우)
              console.log(`[Naver] 회원 DB 저장 스킵: ${member.nickName} (${dbError.message})`)
            }

            // 진행 상황 전송 (성공)
            getMainWindowRef()?.webContents.send('naver:sendProgress', {
              current: i + 1,
              total: total,
              member: member,
              memberKey: member.memberKey,
              success: true
            })

          } else {
            results.failed++

            // 진행 상황 전송 (실패)
            getMainWindowRef()?.webContents.send('naver:sendProgress', {
              current: i + 1,
              total: total,
              member: member,
              memberKey: member.memberKey,
              success: false,
              error: result.error
            })
          }

        } catch (memberError) {
          results.failed++
          console.error(`[Naver] ${member.nickName} 발송 실패:`, memberError.message)

          // 진행 상황 전송 (실패)
          getMainWindowRef()?.webContents.send('naver:sendProgress', {
            current: i + 1,
            total: total,
            member: member,
            memberKey: member.memberKey,
            success: false,
            error: memberError.message
          })
        }

        // Rate limiting - 1~2초 랜덤 간격
        if (i < members.length - 1) {
          const delay = 1000 + Math.random() * 1000
          console.log(`[Naver] 다음 발송까지 ${Math.round(delay)}ms 대기`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }

      console.log(`[Naver] 대량 발송 완료: 성공 ${results.success}명, 실패 ${results.failed}명`)

      // 발송 완료 이벤트 전송
      getMainWindowRef()?.webContents.send('naver:sendComplete', {
        success: true,
        results: results
      })

      return { success: true, results }

    } catch (error) {
      console.error('[Naver] startSending 실패:', error)

      getMainWindowRef()?.webContents.send('naver:sendComplete', {
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

  console.log('[IPC] Naver handlers registered (API mode)')
}

module.exports = {
  register,
  closeLoginWindow
}
