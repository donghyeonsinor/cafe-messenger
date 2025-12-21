// 홈 화면 컴포넌트
// 메시지 전송하기 버튼 + 크롤링 상태 + 수집된 회원 목록

let collectedMembers = []
let isLoggedIn = false
let isCrawling = false

/**
 * 홈 화면 HTML 생성
 */
export function createHome() {
  return `
    <div class="h-full flex flex-col">
      <!-- 헤더 -->
      <div class="flex justify-between items-center mb-4">
        <div>
          <h2 class="text-3xl font-bold text-gray-800">홈</h2>
          <p class="text-gray-600 mt-1">네이버 카페 회원에게 쪽지를 보냅니다</p>
        </div>
        <div class="flex items-center space-x-3">
          <span id="login-status" class="px-3 py-1 rounded-full text-sm ${isLoggedIn ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}">
            ${isLoggedIn ? '로그인됨' : '로그아웃'}
          </span>
          <button
            id="btn-start-message"
            class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-lg shadow-md"
          >
            📨 메시지 전송하기
          </button>
        </div>
      </div>

      <!-- 메인 컨텐츠 영역 -->
      <div class="flex-1 flex gap-4 min-h-0">
        <!-- 왼쪽: 크롤링 안내 및 상태 -->
        <div class="flex-1 bg-white rounded-lg shadow-md overflow-hidden flex flex-col">
          <!-- 안내 영역 -->
          <div class="flex-1 flex flex-col items-center justify-center p-8">
            <div id="crawling-guide" class="text-center">
              <div class="text-6xl mb-4">🔍</div>
              <h3 class="text-xl font-semibold text-gray-800 mb-2">회원 크롤링</h3>
              <p class="text-gray-600 mb-6">카페 게시글 작성자를 수집합니다</p>

              <div class="space-y-3 text-left max-w-md mx-auto mb-8">
                <div class="flex items-start space-x-3">
                  <span class="text-blue-500 font-bold">1.</span>
                  <span class="text-gray-700">"메시지 전송하기" 버튼을 클릭하여 네이버 로그인</span>
                </div>
                <div class="flex items-start space-x-3">
                  <span class="text-blue-500 font-bold">2.</span>
                  <span class="text-gray-700">로그인 완료 후 아래 "크롤링 시작" 버튼 클릭</span>
                </div>
                <div class="flex items-start space-x-3">
                  <span class="text-blue-500 font-bold">3.</span>
                  <span class="text-gray-700">최대 50명의 회원이 자동으로 수집됩니다</span>
                </div>
              </div>

              <button
                id="btn-start-crawling"
                class="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed"
                ${!isLoggedIn ? 'disabled' : ''}
              >
                🚀 크롤링 시작
              </button>
            </div>

            <!-- 크롤링 진행 상태 (숨김 상태) -->
            <div id="crawling-status" class="hidden text-center w-full max-w-md">
              <div class="text-6xl mb-4 animate-pulse">⏳</div>
              <h3 class="text-xl font-semibold text-gray-800 mb-2">크롤링 중...</h3>
              <p id="crawling-cafe-name" class="text-gray-600 mb-4"></p>

              <div class="bg-gray-200 rounded-full h-4 mb-2">
                <div id="crawling-progress-bar" class="bg-green-600 rounded-full h-4 transition-all" style="width: 0%"></div>
              </div>
              <p id="crawling-progress-text" class="text-sm text-gray-600">0 / 50 명 수집</p>
            </div>

            <!-- 크롤링 완료 상태 (숨김 상태) -->
            <div id="crawling-complete" class="hidden text-center">
              <div class="text-6xl mb-4">✅</div>
              <h3 class="text-xl font-semibold text-gray-800 mb-2">크롤링 완료!</h3>
              <p id="crawling-result" class="text-gray-600 mb-6"></p>

              <button
                id="btn-restart-crawling"
                class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                🔄 다시 크롤링
              </button>
            </div>
          </div>
        </div>

        <!-- 오른쪽: 수집된 회원 목록 -->
        <div class="w-80 bg-white rounded-lg shadow-md overflow-hidden flex flex-col">
          <div class="bg-gray-50 px-4 py-3 border-b">
            <div class="flex justify-between items-center">
              <h3 class="font-semibold text-gray-800">수집된 회원</h3>
              <span id="member-count" class="px-2 py-1 bg-blue-100 text-blue-700 text-sm rounded-full">
                0 / 50
              </span>
            </div>
            <p class="text-xs text-gray-500 mt-1">게시글 작성자 닉네임</p>
          </div>

          <!-- 회원 목록 -->
          <div id="collected-members-list" class="flex-1 overflow-y-auto p-2">
            <div class="text-center text-gray-400 py-8">
              <p>수집된 회원이 없습니다</p>
            </div>
          </div>

          <!-- 목록 초기화 버튼 -->
          <div id="member-actions" class="hidden px-4 py-3 border-t bg-gray-50">
            <button
              id="btn-clear-members"
              class="w-full px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors text-sm"
            >
              목록 초기화
            </button>
          </div>
        </div>
      </div>
    </div>
  `
}

/**
 * 수집된 회원 목록 렌더링
 */
function renderMembersList() {
  const listEl = document.getElementById('collected-members-list')
  const countEl = document.getElementById('member-count')
  const actionsEl = document.getElementById('member-actions')

  if (!listEl) return

  countEl.textContent = `${collectedMembers.length} / 50`

  if (collectedMembers.length === 0) {
    listEl.innerHTML = `
      <div class="text-center text-gray-400 py-8">
        <p>수집된 회원이 없습니다</p>
      </div>
    `
    actionsEl?.classList.add('hidden')
    return
  }

  actionsEl?.classList.remove('hidden')

  listEl.innerHTML = collectedMembers.map((member, index) => `
    <div class="flex items-center px-3 py-2 hover:bg-gray-50 rounded ${index % 2 === 0 ? 'bg-gray-50' : ''}">
      <span class="w-6 text-xs text-gray-400">${index + 1}</span>
      <div class="flex-1">
        <span class="text-sm text-gray-800">${escapeHtml(member.nickName)}</span>
        <span class="text-xs text-gray-400 ml-2">${member.memberKey}</span>
      </div>
    </div>
  `).join('')
}

/**
 * 로그인 상태 업데이트
 */
function updateLoginStatus(loggedIn) {
  isLoggedIn = loggedIn
  const statusEl = document.getElementById('login-status')
  const crawlBtn = document.getElementById('btn-start-crawling')

  if (statusEl) {
    statusEl.className = `px-3 py-1 rounded-full text-sm ${loggedIn ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`
    statusEl.textContent = loggedIn ? '로그인됨' : '로그아웃'
  }

  if (crawlBtn) {
    crawlBtn.disabled = !loggedIn
  }
}

/**
 * 크롤링 상태 UI 전환
 */
function showCrawlingStatus(status) {
  const guideEl = document.getElementById('crawling-guide')
  const statusEl = document.getElementById('crawling-status')
  const completeEl = document.getElementById('crawling-complete')

  guideEl?.classList.add('hidden')
  statusEl?.classList.add('hidden')
  completeEl?.classList.add('hidden')

  switch (status) {
    case 'guide':
      guideEl?.classList.remove('hidden')
      break
    case 'crawling':
      statusEl?.classList.remove('hidden')
      break
    case 'complete':
      completeEl?.classList.remove('hidden')
      break
  }
}

/**
 * 크롤링 진행 상태 업데이트
 */
function updateCrawlProgress(current, total, cafeName) {
  const barEl = document.getElementById('crawling-progress-bar')
  const textEl = document.getElementById('crawling-progress-text')
  const cafeEl = document.getElementById('crawling-cafe-name')

  if (barEl && textEl) {
    const percent = Math.round((current / total) * 100)
    barEl.style.width = `${percent}%`
    textEl.textContent = `${current} / ${total} 명 수집`
  }

  if (cafeEl && cafeName) {
    cafeEl.textContent = `카페: ${cafeName}`
  }
}

/**
 * 이벤트 핸들러 등록
 */
export function attachHomeEvents() {
  // 메시지 전송하기 버튼 - 네이버 로그인 창 열기
  document.getElementById('btn-start-message')?.addEventListener('click', async () => {
    console.log('[Home] 메시지 전송하기 클릭')

    try {
      // 1. 활성 계정 확인
      const credentials = await window.api.accounts.getActiveCredentials()
      if (!credentials) {
        alert('활성화된 계정이 없습니다.\n계정 관리에서 계정을 추가하고 선택해주세요.')
        return
      }

      console.log('[Home] 활성 계정:', credentials.naver_id)

      // 2. 새 창으로 네이버 로그인 페이지 열기
      await window.api.naver.openLogin()

      // 3. 페이지 로드 대기 후 자동 로그인 실행
      setTimeout(async () => {
        try {
          console.log('[Home] 자동 로그인 시도...')
          await window.api.naver.autoLogin(credentials)
        } catch (loginError) {
          console.error('[Home] 자동 로그인 실패:', loginError)
        }
      }, 1500)

    } catch (error) {
      console.error('[Home] 로그인 창 열기 실패:', error)
      alert('로그인 창을 열 수 없습니다: ' + error.message)
    }
  })

  // 크롤링 시작 버튼
  document.getElementById('btn-start-crawling')?.addEventListener('click', async () => {
    if (isCrawling) return

    try {
      // 활성 카페 확인
      const activeCafe = await window.api.cafes.getActive()
      if (!activeCafe) {
        alert('활성화된 카페가 없습니다.\n카페 관리에서 카페를 추가하고 활성화해주세요.')
        return
      }

      console.log('[Home] 크롤링 시작')
      isCrawling = true
      collectedMembers = []
      renderMembersList()
      showCrawlingStatus('crawling')
      updateCrawlProgress(0, 50, '')

      await window.api.naver.startCrawling({ maxCount: 50 })
    } catch (error) {
      console.error('[Home] 크롤링 시작 실패:', error)
      alert('크롤링 실패: ' + error.message)
      isCrawling = false
      showCrawlingStatus('guide')
    }
  })

  // 다시 크롤링 버튼
  document.getElementById('btn-restart-crawling')?.addEventListener('click', () => {
    collectedMembers = []
    renderMembersList()
    showCrawlingStatus('guide')
  })

  // 목록 초기화 버튼
  document.getElementById('btn-clear-members')?.addEventListener('click', () => {
    if (confirm('수집된 회원 목록을 초기화하시겠습니까?')) {
      collectedMembers = []
      renderMembersList()
      showCrawlingStatus('guide')
    }
  })

  // IPC 이벤트 리스너: 로그인 상태 변경
  window.api.naver.onLoginStatusChange((event, loggedIn) => {
    console.log('[Home] 로그인 상태 변경:', loggedIn)
    updateLoginStatus(loggedIn)
  })

  // IPC 이벤트 리스너: 크롤링 진행
  window.api.naver.onCrawlProgress((event, data) => {
    console.log('[Home] 크롤링 진행:', data)

    if (data.member) {
      // 새 회원 추가
      if (!collectedMembers.find(m => m.memberKey === data.member.memberKey)) {
        collectedMembers.push(data.member)
        renderMembersList()
      }
    }

    updateCrawlProgress(data.current, data.total, data.cafe)
  })

  // IPC 이벤트 리스너: 크롤링 완료
  window.api.naver.onCrawlComplete((event, data) => {
    console.log('[Home] 크롤링 완료:', data)
    isCrawling = false

    const resultEl = document.getElementById('crawling-result')
    if (resultEl) {
      if (data.success) {
        resultEl.textContent = `총 ${data.count}명의 회원을 수집했습니다.`
      } else {
        resultEl.textContent = `오류: ${data.error}`
      }
    }

    showCrawlingStatus('complete')
  })

  // 초기 상태 확인
  checkInitialState()
}

/**
 * 초기 상태 확인
 */
async function checkInitialState() {
  try {
    const loggedIn = await window.api.naver.checkLogin()
    updateLoginStatus(loggedIn)
  } catch (error) {
    console.log('[Home] 초기 로그인 상태 확인 실패 (정상)')
  }
}

// 유틸리티 함수
function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
