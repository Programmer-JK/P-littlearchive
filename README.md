# Our Little Archive

둘만의 디지털 다이어리 — 하고 싶은 일을 모으고, 함께한 순간을 사진과 글로 남기고, 서로 사진을 주고받는 커플 기록 웹앱.

## 스택

| 역할 | 기술 |
|---|---|
| 프레임워크 | Next.js 16 (App Router) + TypeScript strict |
| 스타일링 | Tailwind CSS v4 (CSS `@theme` 토큰) |
| 백엔드 | Firebase Auth (Google), Firestore, Storage |
| 배포 | Vercel |
| 패키지 매니저 | pnpm |

## 실행 방법

### 1. 환경 변수 설정

```bash
cp .env.example .env.local
# .env.local에 Firebase 프로젝트 값을 채워 주세요
```

### 2. 의존성 설치

```bash
pnpm install
```

### 3. 개발 서버

```bash
pnpm dev
```

`http://localhost:3000` 에서 확인.

### 4. 프로덕션 빌드

```bash
pnpm build && pnpm start
```

## 라우트 구조

```
/                     루트 리다이렉트 (인증 상태에 따라 분기)
/login                Google 로그인
/onboarding           커플 공간 생성 (4단계)
/invite/[code]        초대 링크 수락
/home                 홈 (D-Day, 최근 추억, 다음 계획)
/album                사진첩 (함께한 순간 / 주고받은 사진)
/wishlist             하고 싶은 것 (버킷리스트)
/timeline             타임라인
/memories/[id]        추억 상세
/memories/new         추억 작성 폼
/memories/[id]/edit   추억 수정 폼
/notes/new            사진 보내기
/settings             우리 공간 설정
```

## 아키텍처

### 인증 흐름

```
Google 로그인 → users/{uid}.coupleId 조회
  ├─ coupleId 없음 → 온보딩
  ├─ 초대 링크(/invite/[code]) → 서버 라우트 검증 → 커플 연결
  └─ coupleId 있음 → 홈
```

### 데이터 구조 (Firestore)

```
couples/{coupleId}
  ├─ members/{uid}
  ├─ memories/{memoryId}
  │    └─ photos/{photoId}
  ├─ wishlist/{wishlistId}
  ├─ anniversaries/{annId}
  └─ notes/{noteId}

users/{uid}            ← coupleId 조회용
```

### 보안 설계

- **서버 비밀키**는 브라우저에 절대 노출하지 않습니다. Firebase Admin SDK는 서버 Route Handler에서만 사용합니다.
- **Firestore 보안 규칙**은 `memberUids` 배열 검사로 커플 구성원만 데이터에 접근합니다.
- `memberUids` 수정은 클라이언트에서 불가능하며, 반드시 서버 라우트를 통해 처리합니다.
- **사진**은 업로드 전 클라이언트에서 1600px(원본) / 400px(썸네일) JPEG으로 리사이즈합니다.
- **날짜**는 `YYYY-MM-DD` 문자열로 저장하고 로컬 타임존으로 파싱합니다(UTC 하루 밀림 방지).

### 디자인 토큰

Tailwind CSS v4의 `@theme` 블록에 등록. `globals.css` 참고.
폰트: Instrument Serif (로고/숫자), Gowun Batang (제목), Gowun Dodum (본문), Nanum Pen Script (폴라로이드 캡션).

## Firebase 설정 가이드

1. [Firebase 콘솔](https://console.firebase.google.com/)에서 프로젝트 생성
2. Authentication → Google 로그인 활성화
3. Firestore Database 생성 (프로덕션 모드)
4. Storage 생성
5. 보안 규칙 배포 (`firestore.rules`, `storage.rules` 작성)
6. `.env.local`에 프로젝트 자격 증명 입력

## Vercel 배포

```bash
vercel deploy
```

환경 변수를 Vercel 대시보드에서 설정해 주세요.
