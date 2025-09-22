# EchoTube API Server 🚀

NestJS 기반 동영상 공유 커뮤니티 백엔드 서버

---

## ✨ 핵심 기능

### 1. **사용자 생성형 커뮤니티**

- 사용자는 봇 전용 게시판 외에도 일반 게시판을 통해 직접 게시물을 생성, 수정, 삭제 가능
- 댓글 시스템을 통해 사용자 간 상호작용 강화
- 게시물 및 댓글에 대한 좋아요 기능 지원

### 2. **기본 기능**

#### 2-1. 게시물 관리

| HTTP 메서드 | 엔드포인트      | 기능                 | 인증 필요 |
| ----------- | --------------- | -------------------- | --------- |
| POST        | /posts          | 게시물 생성          | O         |
| GET         | /posts          | 전체 게시물 조회     | X         |
| GET         | /posts/user/:id | 사용자별 게시물 조회 | X         |
| PATCH       | /posts/:id      | 게시물 수정          | O         |
| DELETE      | /posts/:id      | 게시물 삭제          | O         |
| POST        | /posts/like/:id | 게시물 좋아요        | O         |

#### 2-2. 댓글 시스템

| HTTP 메서드 | 엔드포인트             | 기능                    |
| ----------- | ---------------------- | ----------------------- |
| POST        | /comments              | 댓글/대댓글 생성        |
| GET         | /comments/post/:postId | 댓글 목록 조회 (페이징) |
| PUT         | /comments/:id          | 댓글 수정               |
| DELETE      | /comments/:id          | 댓글 삭제               |
| POST        | /comments/like/:id     | 댓글 좋아요             |

**주요 특징**:

- 대댓글은 최대 2단계까지만 지원
- 소프트 삭제 정책 적용 (삭제된 댓글은 "[삭제된 댓글]"로 표시)
- 좋아요는 한 번만 가능 (중복 요청 무시)
- 페이징 조회 시 부모 댓글은 최신순, 대댓글은 작성순 정렬

### 3. **관리자 전용 기능**

관리자는 카테고리, 게시판, 사용자 계정을 관리할 수 있는 전용 API를 사용할 수 있습니다.

#### 3-1. 카테고리 관리

- **기능**: 카테고리 생성, 수정, 삭제, 조회 및 슬러그 관리
- **API 엔드포인트**: `/admin/categories`
- **주요 제약사항**:
  - 카테고리 이름은 고유해야 함
  - 슬러그는 소문자, 숫자, 하이픈(-)만 사용 가능 (언더스코어(\_) 금지)
  - 최소 1개 이상의 슬러그 등록 필수
  - AI_DIGEST 게시판 생성 시 `USER` 이상의 권한 필요
- **추가 기능**:
  - 슬러그 중복 검증 API (`/admin/categories/validate-slug`)
  - 카테고리 이름 중복 검증 API (`/admin/categories/validate-name`)
  - 사용 가능한 카테고리 및 슬러그 조회 (`/admin/categories/available`)

#### 3-2. 게시판 관리

- **기능**: 게시판 생성, 수정, 삭제, 조회
- **API 엔드포인트**: `/admin/boards`
- **게시판 타입**:
  - `GENERAL`: 일반 토론 공간
  - `AI_DIGEST`: 서버와 연동된 봇 전용 게시판으로, 일반 사용자의 직접적인 게시물 생성/수정/삭제가 금지됩니다.
    이 타입의 게시판은 외부 봇이 특정 주제를 자동으로 수집하여 관련 영상 콘텐츠를 정기적으로 등록하는 용도로만 사용되며,
    사용자는 읽기 전용으로만 접근할 수 있습니다. (USER 이상의 권한 필요)
- **주요 제약사항**:
  - 슬러그는 카테고리 내에서 고유해야 함
  - AI_DIGEST 타입 게시판은 USER 이상의 권한만 생성 가능
  - 게시판 삭제 시 연관된 모든 게시물이 함께 삭제됨

#### 3-3. 사용자 관리

- **기능**: 사용자 생성, 수정, 삭제, 검색 및 페이지네이션
- **API 엔드포인트**: `/admin/users`
- **주요 기능**:
  - 닉네임/이메일 중복 검사
  - 역할(ADMIN/USER/BOT) 관리
  - 소프트 삭제(soft delete) 기능
  - 검색 및 필터링 기능 (이메일, 닉네임, 역할 기준)
  - 페이지네이션 및 정렬 (createdAt, updatedAt 기준)
- **사용자 역할**:
  - `ADMIN`: 모든 관리자 기능 사용 가능
  - `USER`: 일반 사용자 권한
  - `BOT`: 시스템 봇 전용 계정

이 기능들은 관리자가 커뮤니티의 구조와 사용자 데이터를 효과적으로 관리할 수 있도록 설계되었습니다. 관리자 전용 API는 ADMIN 역할을 가진 사용자만 접근할 수 있으며, JWT 토큰을 통해 인증됩니다. 상세한 API 스펙은 Swagger 문서에서 확인할 수 있습니다.

### 4. **봇 전용 기능**

1. **영상 수집 대상 게시판 조회**

   - **엔드포인트**: `GET /boards/scraping-targets`
   - **특징**: AI_DIGEST 타입 게시판만 반환, BOT 역할만 접근 가능

2. **영상 게시물 생성**
   - **엔드포인트**: `POST /harvest/videos?slug={boardSlug}`
   - **요청 본문**: 유튜브 ID, 제목, 썸네일 URL 등 영상 메타데이터

### 5. **메시지 시스템 (쪽지 & 공지)**

사용자 간 1:1 쪽지와 관리자 공지 발송 기능을 제공합니다.

#### 5-1. 쪽지 (Private Message)

- **기능**: 사용자 간 비공개 메시지 전송 및 관리
- **API 엔드포인트**: `/messages`
- **주요 기능**:
  - `POST /messages`: 새로운 쪽지 또는 공지 생성
  - `GET /messages`: 받은 쪽지 목록 조회 (페이징 지원)
  - `GET /messages/:id`: 특정 쪽지 상세 조회 (조회 시 자동으로 '읽음' 처리)
  - `DELETE /messages/:id`: 쪽지 삭제 (소프트 삭제)
- **특징**:
  - 수신자는 닉네임으로 지정합니다.
  - 메시지 목록은 최신순으로 정렬됩니다.
  - 삭제된 메시지는 복구할 수 없습니다.

#### 5-2. 공지 (Notice)

- **기능**: 관리자가 모든 활성 사용자에게 일괄적으로 공지 메시지 발송
- **API 엔드포인트**: `/messages` (공통)
- **주요 제약사항**:
  - 공지 메시지는 `ADMIN` 역할을 가진 사용자만 발송할 수 있습니다.
  - 공지 메시지 생성 시, 모든 활성 사용자에게 동일한 내용의 메시지가 자동으로 전송됩니다.
  - 공지 메시지는 일반 쪽지 목록과 함께 표시되며, `[공지]` 접두어로 구분됩니다.

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

상세한 API 스펙은 Swagger를 통해 확인 가능합니다.

- **접근 방법**: 서버 실행 후 [http://localhost:3000/api-docs](http://localhost:3000/api-docs) 접속
- **인증**: `Authorize` 버튼을 통해 JWT 토큰 입력 (Bearer {your_jwt_token})

> 💡 **참고**: 상세한 요청/응답 구조, 오류 코드, 인증 정보 등은 Swagger 문서에서 확인하시기 바랍니다.

---

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
