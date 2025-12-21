# CLAUDE.md

이 파일은 Claude Code (claude.ai/code)가 이 저장소에서 작업할 때 참고할 가이드를 제공합니다.

## 언어 및 커뮤니케이션 규칙
- **기본 응답 언어**: 한국어
- **코드 주석**: 한국어로 작성
- **커밋 메시지**: 한국어로 작성
- **문서화**: 한국어로 작성
- **변수명/함수명**: 영어 (코드 표준 준수)

## 개발 명령어

### Docker 워크플로우 (권장)

이 프로젝트는 Docker 컨테이너를 사용하여 개발합니다:

```bash
# 핫 리로드가 포함된 개발 서버 시작
docker-compose up desktop-dev

# Windows 배포판 빌드
docker-compose run desktop-build npm run make:win
```

### NPM 스크립트

이 명령어들은 Docker 컨테이너 내부에서 실행되거나, 의존성이 설치된 경우 로컬에서 실행할 수 있습니다:

```bash
npm start              # Electron 개발 모드 시작 (electron-forge start)
npm run package        # 애플리케이션 패키징
npm run make:win       # Windows x64용 빌드, artifacts/make/로 출력
npm test               # 아직 구현되지 않음 (에러로 종료됨)
```

### 개발 환경 세부사항

- **Docker 이미지**: Node 24.11.1 Bookworm Slim
- **파일 감시**: WSL/Windows 호환성을 위한 폴링 모드 사용 (CHOKIDAR_USEPOLLING=true)
- **빌드 출력**: `artifacts/make/` 디렉토리로 저장됨
- **개발 서버 포트**: 5173 (Vite dev server)
- **node_modules**: 로컬 파일시스템 오염 방지를 위해 네임드 볼륨 `desktop_node_modules`에 저장
- **컨테이너 작업 디렉토리**: `/work/apps/desktop`

## 아키텍처 개요

### Electron 멀티 프로세스 모델

이 애플리케이션은 Electron의 보안 중심 멀티 프로세스 아키텍처를 따릅니다:

```
Main Process (main.js)
    ↓ 생성
BrowserWindow (800x600)
    ↓ 로드
index.html (엄격한 CSP)
    ↓ 주입
preload.js (contextBridge)
    ↓ 안전한 API 노출
renderer.js (UI 로직)
```

### 프로세스별 역할

- **Main Process** (`apps/desktop/src/main.js`)
  - 애플리케이션 진입점 (package.json의 `main` 필드에 정의됨)
  - BrowserWindow 인스턴스 생성
  - 앱 생명주기 이벤트 처리 (ready, activate, window-all-closed)
  - 플랫폼별 동작 처리 (macOS vs Windows/Linux)

- **Preload Script** (`apps/desktop/src/preload.js`)
  - Main 프로세스와 Renderer 프로세스 간의 보안 브리지
  - `contextBridge`를 사용하여 제어된 API 노출
  - 현재 버전 정보(node, chrome, electron)를 노출

- **Renderer Process** (`apps/desktop/src/renderer.js`)
  - 브라우저 컨텍스트에서 실행되는 UI 로직
  - Preload를 통해 노출된 인터페이스를 통해서만 Node.js API에 접근
  - 현재 버전 정보 표시

- **HTML Shell** (`apps/desktop/src/index.html`)
  - 엄격한 Content Security Policy (스크립트는 'self'만 허용)
  - renderer.js 로드

### 주요 아키텍처 결정사항

- **보안 우선 접근**: Context isolation 강제, 엄격한 CSP, 최소한의 renderer 접근 권한
- **Docker 우선 개발**: 모든 개발과 빌드가 컨테이너에서 수행됨
- **모노레포 구조**: `apps/` 디렉토리는 멀티 앱 아키텍처를 시사 (현재는 `desktop/`만 존재)
- **네임드 볼륨**: 호스트 파일시스템의 node_modules 오염 방지
- **Windows 전용 빌드**: forge.config.js가 win32 플랫폼만 설정됨 (ZIP 포맷)

## 프로젝트 구조

```
cafe-messenger/
├── apps/desktop/              # 메인 Electron 애플리케이션
│   ├── src/
│   │   ├── main.js           # Main 프로세스 (진입점)
│   │   ├── preload.js        # 보안 브리지 (contextBridge)
│   │   ├── renderer.js       # UI 로직
│   │   └── index.html        # HTML 셸
│   ├── package.json          # 의존성 및 스크립트
│   ├── forge.config.js       # Electron Forge 빌드 설정
│   └── Dockerfile.dev        # 개발 컨테이너
├── artifacts/                 # 빌드 산출물 (git에서 제외됨)
├── docker-compose.yml         # 개발 및 빌드 서비스
└── .claude/                   # Claude Code 워크스페이스 설정
```

## 중요 참고사항

### 현재 상태

- **최소 스캐폴드**: 애플리케이션이 현재 Electron/Chrome/Node 버전 정보만 표시함
- **메신저 기능 없음**: 핵심 메시징 기능은 아직 구현되지 않음
- **순수 JavaScript**: TypeScript 없음, CommonJS 모듈 사용
- **UI 프레임워크 없음**: 바닐라 HTML/JS, React/Vue 등 사용하지 않음
- **테스트 프레임워크 없음**: 테스트 인프라를 처음부터 설정해야 함 (npm test는 현재 에러로 종료됨)

### 기술 선택사항

- **빌드 도구**: Electron Forge 7.8.3+ (ZIP maker 사용)
- **모듈 시스템**: CommonJS (ESM 아님)
- **타겟 플랫폼**: Windows 전용 (win32, x64 아키텍처)
- **Node 버전**: 24.11.1
- **Electron 버전**: 39.2.7

### 개발 팀

- **작성자**: 김동현
- **언어 컨텍스트**: 한국어 개발팀 (docker-compose.yml에 한글 주석 사용)

