const information = document.getElementById('info')
information.innerText = `This app is using Chrome (v${versions.chrome()}), Node.js (v${versions.node()}), and Electron (v${versions.electron()})`

// IPC API 테스트
async function testIpcApis() {
  try {
    console.log('[Renderer] Testing IPC APIs...')

    // 템플릿 목록 조회 테스트
    const templates = await window.api.templates.getAll()
    console.log('[Renderer] Templates:', templates)

    // 계정 목록 조회 테스트
    const accounts = await window.api.accounts.getAll()
    console.log('[Renderer] Accounts:', accounts)

    // 카페 목록 조회 테스트
    const cafes = await window.api.cafes.getAll()
    console.log('[Renderer] Cafes:', cafes)

    // 회원 목록 조회 테스트
    const members = await window.api.members.getAll()
    console.log('[Renderer] Members:', members)

    console.log('[Renderer] ✅ All IPC APIs working correctly!')
  } catch (error) {
    console.error('[Renderer] ❌ IPC API test failed:', error)
  }
}

// 앱 로드 시 테스트 실행
testIpcApis()