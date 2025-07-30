# EchoTube API Server 🚀

NestJS 기반 동영상 공유 커뮤니티 백엔드 서버

---

## ✨ 핵심 기능: 사용자 기반 커뮤니티 구축

### 1. **사용자 생성형 커뮤니티**

사용자는 봇 전용 게시판 외에도 일반 게시판을 통해 직접 게시물을 생성, 수정, 삭제할 수 있습니다.
→ 다양한 관심사를 가진 사용자들이 실시간으로 콘텐츠를 공유하며 커뮤니티를 형성 할 수 있습니다.

### 2. **게시물 CRUD 기능**

| HTTP 메서드 | 엔드포인트      | 기능                 | 인증 필요 |
| ----------- | --------------- | -------------------- | --------- |
| POST        | /posts          | 게시물 생성          | O         |
| GET         | /posts          | 전체 게시물 조회     | X         |
| GET         | /posts/user/:id | 사용자별 게시물 조회 | X         |
| PATCH       | /posts/:id      | 게시물 수정          | O         |
| DELETE      | /posts/:id      | 게시물 삭제          | O         |

**공통 응답 구조**:

```ts
{
  id: number,
  title: string,
  content: string,
  views: number,
  commentsCount: number,
  videoUrl?: string,
  nickname?: string,
  createdAt: Date,
  updatedAt: Date,
  board: BoardListItemDto,
  hotScore: number
}
```

### 3. **봇 전용 기능**

1. **영상 수집 대상 게시판 조회**

   - **엔드포인트**: `GET /boards/scraping-targets`
   - **특징**:
     - AI_DIGEST 타입 게시판만 반환
     - BOT 역할만 접근 가능
     - 응답 예시: `{ slug: "nestjs", name: "NESTJS" }`

2. **영상 게시물 생성**

   - **엔드포인트**: `POST /harvest/videos?slug={boardSlug}`
   - **요청 본문**:
     ```ts
     {
       youtubeId: string,  // 유튜브 ID
       title: string,      // 영상 제목
       thumbnailUrl: string, // 썸네일 URL
       channelTitle: string, // 채널명
       duration: string,   // 영상 길이
       topic: string       // 주제
     }
     ```

### 4. **관리자 전용 기능**

관리자는 카테고리, 게시판, 사용자 계정을 관리할 수 있는 전용 API를 사용할 수 있습니다.

#### 4-1. 카테고리 관리

- **기능**: 카테고리 생성, 수정, 삭제, 조회
- **주요 제약사항**:
  - 카테고리 이름은 고유해야 함
  - 슬러그는 소문자, 숫자, 하이픈(-)만 사용 가능 (언더스코어(\_) 금지)
  - 최소 1개 이상의 슬러그 등록 필수

#### 4-2. 게시판 관리

- **기능**: 게시판 생성, 수정, 삭제, 조회
- **게시판 타입**:
  - `GENERAL`: 일반 토론 공간
  - `AI_DIGEST`: 서버와 연동된 봇 전용 게시판으로, 일반 사용자의 직접적인 게시물 생성/수정/삭제가 금지됩니다.
    이 타입의 게시판은 외부 봇이 특정 주제를 자동으로 수집하여 관련 영상 콘텐츠를 정기적으로 등록하는 용도로만 사용되며,
    사용자는 읽기 전용으로만 접근할 수 있습니다. (USER 이상의 권한 필요)
- **주요 제약사항**:
  - 슬러그는 카테고리 내에서 고유해야 함
  - AI_DIGEST 타입 게시판은 USER 이상의 권한만 생성 가능

#### 4-3. 사용자 관리

- **기능**: 사용자 생성, 수정, 삭제, 검색
- **주요 기능**:
  - 닉네임/이메일 중복 검사
  - 역할(ADMIN/USER/BOT) 관리
  - 소프트 삭제(soft delete) 기능
  - 검색 및 필터링 기능

---

## 🛠 기술 스택

| Category  | Technology           |
| --------- | -------------------- |
| Framework | NestJS, Express      |
| Database  | PostgreSQL (TypeORM) |
| Auth      | Passport.js, JWT     |
| API Docs  | Swagger UI           |

---

## 📄 API 문서

Swagger를 통해 API 문서를 확인할 수 있습니다.

**접근 방법:**

1. 서버 실행 후 [http://localhost:3000/api-docs](http://localhost:3000/api-docs) 접속
2. 인증이 필요한 API는 `Authorize` 버튼을 눌러 JWT 토큰 입력
   - 토큰 형식: `Bearer {your_jwt_token}`
   - **일반 사용자**: USER 권한 이상의 토큰 필요
   - **관리자 전용 API**: ADMIN 권한의 토큰 필요

---

## ⚠️ 주요 오류 코드

### 관리자 전용 API 오류

| 상태 코드 | 메시지                                           | 설명                                                      |
| --------- | ------------------------------------------------ | --------------------------------------------------------- |
| 400       | Each slug must be URL-friendly                   | 슬러그 형식이 올바르지 않음 (소문자, 숫자, 하이픈만 허용) |
| 400       | 이미 사용 중인 슬러그가 있습니다                 | 중복된 슬러그로 인한 생성/수정 실패                       |
| 400       | AI_DIGEST board requires a role higher than USER | AI_DIGEST 게시판 생성 시 권한 부족                        |
| 403       | This nickname is already existed!                | 닉네임 중복으로 인한 사용자 생성/수정 실패                |
| 404       | Category not found                               | 요청한 ID의 카테고리를 찾을 수 없음                       |
| 409       | This nickname is already existed!                | 닉네임 중복 오류                                          |

## 🚀 시작하기 (Quick Start)

```bash
# 1. 저장소 클론
git clone https://github.com/octuniv/echo-tube-api.git
cd echo-tube-api

# 2. 환경 변수 설정
cp .env.example .env
cp .env.example .env.test
# .env 및 .env.test 파일에 DATABASE 세팅 값, JWT_SECRET 등 설정

# 3. 의존성 설치 및 마이그레이션
pnpm install
pnpm run migraiton:generate
pnpm run migration:run

# 4. 개발 서버 실행
pnpm run start:testEnv
```

## 🛠 빌드 & 실행 방법

### 1. **프로젝트 빌드**

```bash
# 개발 환경 빌드 (watch 모드)
pnpm run start:dev

# 프로덕션 빌드
pnpm run build

# 프로덕션 서버 실행
pnpm run start:prod

# 테스트 전용 서버 실행
pnpm run start:testEnv
# 위 서버에서 실행한 결과물은 다음 실행 시 초기화 됨.
```

### 2. **마이그레이션**

```bash
# 마이그레이션 생성 (Entity 변경 후)
pnpm run migration:generate

# 마이그레이션 실행
pnpm run migration:run

# 마이그레이션 롤백
pnpm run migration:revert

# 초기 데이터 시딩 (Seed)
pnpm run seed:run
# 서버 실행 시 시딩 미적용 부분은 자동으로 시딩이 실행됨.
```

### 3. **테스트 실행**

```bash
# 단위 테스트
pnpm test

# 테스트 실시간 감시 모드
pnpm run test:watch

# 테스트 커버리지 확인
pnpm run test:cov

# E2E 테스트
pnpm run test:e2e

# 테스트 디버깅
pnpm run test:debug
```
