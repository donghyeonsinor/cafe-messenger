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
 * 쪽지 전송 폼 정보 조회 - token, svcCode, svcType, todaySentCount 추출
 * @param {string} targetCafeMemberKey - 수신자 memberKey
 * @returns {object} { success, token, svcCode, svcType, todaySentCount, error }
 */
async function getSendFormInfo(targetCafeMemberKey) {
  try {
    // 네이버 쿠키 가져오기
    const cookies = await session.defaultSession.cookies.get({ domain: '.naver.com' })
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ')

    const url = `https://note.naver.com/note/sendForm.nhn?popup=1&svcType=2&targetCafeMemberKey=${targetCafeMemberKey}`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Host': 'note.naver.com',
        'Connection': 'keep-alive',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko,en;q=0.9,en-US;q=0.8',
        'Cookie': cookieString
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP 오류: ${response.status}`)
    }

    const html = await response.text()

    // HTML에서 oNote 객체 추출 (정규식으로 JSON 파싱)
    // 형식: var oNote = $Json({...}).toObject();
    const jsonMatch = html.match(/var\s+oNote\s*=\s*\$Json\((\{[\s\S]*?\})\)\.toObject\(\)/)

    if (!jsonMatch || !jsonMatch[1]) {
      console.error('[Naver] oNote 객체를 찾을 수 없습니다')
      return {
        success: false,
        error: 'oNote 객체를 찾을 수 없습니다'
      }
    }

    const oNote = JSON.parse(jsonMatch[1])
    console.log('[Naver] getSendFormInfo 성공:', {
      todaySentCount: oNote.todaySentCount,
      token: oNote.token?.substring(0, 20) + '...',
      svcCode: oNote.svcCode,
      svcType: oNote.svcType
    })

    return {
      success: true,
      token: oNote.token,
      svcCode: oNote.svcCode,
      svcType: oNote.svcType,
      todaySentCount: oNote.todaySentCount,
      sendLimit: oNote.sendLimit || 50
    }

  } catch (error) {
    console.error('[Naver] getSendFormInfo 실패:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * 쪽지 발송 API 호출
 * @param {string} targetCafeMemberKey - 수신자 memberKey
 * @param {string} content - 메시지 내용
 * @param {object} formInfo - getSendFormInfo에서 받은 정보 (token, svcCode, svcType)
 * @returns {object} { success, todaySentCount, error }
 */
async function sendMessage(targetCafeMemberKey, content, formInfo = {}) {
  try {
    // 네이버 쿠키 가져오기
    const cookies = await session.defaultSession.cookies.get({ domain: '.naver.com' })
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ')

    // formInfo에서 값 추출 (getSendFormInfo에서 받은 값 사용)
    const { token = '', svcCode = '', svcType = '2' } = formInfo

    // URL 인코딩된 폼 데이터 생성
    const formData = new URLSearchParams()
    formData.append('svcType', String(svcType))
    formData.append('svcId', '')
    formData.append('svcName', '')
    formData.append('isReplyNote', '1')
    formData.append('targetUserId', '')
    formData.append('targetCafeMemberKey', targetCafeMemberKey)
    formData.append('content', content)
    formData.append('isBackup', '1')
    formData.append('svcCode', String(svcCode))
    formData.append('token', token)

    const response = await fetch('https://note.naver.com/json/write/send/', {
      method: 'POST',
      headers: {
        'Host': 'note.naver.com',
        'Connection': 'keep-alive',
        'sec-ch-ua-platform': '"Windows"',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
        'sec-ch-ua': '"Microsoft Edge";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'charset': 'utf-8',
        'sec-ch-ua-mobile': '?0',
        'Accept': '*/*',
        'Origin': 'https://note.naver.com',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty',
        'Referer': `https://note.naver.com/note/sendForm.nhn?popup=1&svcType=2&targetCafeMemberKey=${targetCafeMemberKey}`,
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'ko,en;q=0.9,en-US;q=0.8',
        'Cookie': cookieString
      },
      body: formData.toString()
    })

    if (!response.ok) {
      throw new Error(`HTTP 오류: ${response.status}`)
    }

    const data = await response.json()
    console.log('[Naver] 쪽지 발송 응답:', data)

    // 응답 구조: { Message, status, todaySentCount, ... }
    if (data.status === 'success' || data.Result === 'OK') {
      return {
        success: true,
        todaySentCount: data.todaySentCount || 0,
        message: data.Message
      }
    } else {
      return {
        success: false,
        todaySentCount: data.todaySentCount || 0,
        error: data.Message || '발송 실패'
      }
    }

  } catch (error) {
    console.error('[Naver] 쪽지 발송 실패:', error)
    return {
      success: false,
      error: error.message
    }
  }
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

  // 대량 쪽지 발송 시작
  ipcMain.handle('naver:startSending', async (event, { members, content }) => {
    try {
      const isLoggedIn = await checkLoginStatus()
      if (!isLoggedIn) {
        throw new Error('로그인이 필요합니다')
      }

      if (members.length === 0) {
        throw new Error('발송할 회원이 없습니다')
      }

      console.log(`[Naver] 대량 발송 시작: ${members.length}명, 내용 길이: ${content.length}자`)

      // 첫 번째 회원으로 초기 정보 조회 (todaySentCount 확인)
      const initialFormInfo = await getSendFormInfo(members[0].memberKey)
      if (!initialFormInfo.success) {
        throw new Error(`폼 정보 조회 실패: ${initialFormInfo.error}`)
      }

      const results = {
        success: 0,
        failed: 0,
        todaySentCount: initialFormInfo.todaySentCount || 0
      }

      // 초기 todaySentCount를 UI에 전송
      getMainWindowRef()?.webContents.send('naver:sendProgress', {
        current: 0,
        total: members.length,
        member: null,
        todaySentCount: results.todaySentCount,
        initialInfo: true
      })

      console.log(`[Naver] 오늘 발송한 쪽지: ${results.todaySentCount}건`)

      const total = members.length

      for (let i = 0; i < members.length; i++) {
        const member = members[i]

        // 발송 한도 체크 (50건 초과 시 중단)
        if (results.todaySentCount >= 50) {
          console.log('[Naver] 일일 발송 한도 도달 (50건)')
          getMainWindowRef()?.webContents.send('naver:sendProgress', {
            current: i,
            total: total,
            member: member,
            todaySentCount: results.todaySentCount,
            limitReached: true
          })
          break
        }

        // 매 발송 전에 폼 정보 조회 (token은 매번 갱신 필요)
        const formInfo = await getSendFormInfo(member.memberKey)
        if (!formInfo.success) {
          console.error(`[Naver] 폼 정보 조회 실패 (${member.nickName}): ${formInfo.error}`)
          results.failed++
          getMainWindowRef()?.webContents.send('naver:sendProgress', {
            current: i + 1,
            total: total,
            member: member,
            memberKey: member.memberKey,
            success: false,
            error: formInfo.error,
            todaySentCount: results.todaySentCount
          })
          continue
        }

        // todaySentCount 업데이트 (폼 정보에서 가져온 값이 더 정확)
        results.todaySentCount = formInfo.todaySentCount

        // 쪽지 발송 (폼 정보 전달)
        const result = await sendMessage(member.memberKey, content, {
          token: formInfo.token,
          svcCode: formInfo.svcCode,
          svcType: formInfo.svcType
        })

        if (result.success) {
          results.success++
          results.todaySentCount = result.todaySentCount

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
            success: true,
            todaySentCount: result.todaySentCount
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
            error: result.error,
            todaySentCount: results.todaySentCount
          })
        }

        // Rate limiting - 1초 간격 (네이버 서버 부하 방지)
        if (i < members.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000))
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

  console.log('[IPC] Naver handlers registered (BrowserWindow mode)')
}

module.exports = {
  register,
  closeLoginWindow
}
