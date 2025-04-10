# EchoTube API Server 🚀

NestJS 기반 동영상 공유 커뮤니티 백엔드 서버

---

## 📚 주요 기능

- 사용자 인증 (JWT, OAuth 2.0)
- 동영상 링크 CRUD API

---

## 🛠 기술 스택

| Category  | Technology           |
| --------- | -------------------- |
| Framework | NestJS, Express      |
| Database  | PostgreSQL (TypeORM) |
| Auth      | Passport.js, JWT     |

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
