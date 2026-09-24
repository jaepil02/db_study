# api 이미지 — Node LTS alpine 멀티스테이지(정본 docs/09_tech_stack/03_data_infra.md §버전 고정표 · 04_architecture/03)
# 빌드: docker build -f apps/api/Dockerfile --build-arg COMMIT_HASH=$(git rev-parse --short HEAD) -t db_study-api:<해시> .
FROM node:22.23.3-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @db-study/shared build && pnpm --filter @db-study/api build \
 && pnpm --filter @db-study/api deploy --prod --legacy /out

FROM node:22.23.3-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /out .
# 스키마 소유권은 api 쪽이다 — migrate 명령이 이미지 안의 순번 파일을 적용한다(05_data_stores/09)
COPY infra/postgres/migrations db/postgres
COPY infra/clickhouse/ddl db/clickhouse
# 커밋 해시는 빌드 인자로만 준다 — 손으로 적는 순간 커밋과 이미지가 어긋날 수 있다(09_tech_stack/04)
ARG COMMIT_HASH
ENV COMMIT_HASH=${COMMIT_HASH}
USER node
# 기본 명령은 api 진입점(S2) · 생성기 단독 실행은 명령을 덮어쓴다(node dist/bench.js — scripts/lab/s1/gen-bench.sh)
# migrate · seed도 같은 이미지의 명령이다(node dist/db/migrate.js · node dist/db/seed.js)
CMD ["node", "dist/main.js"]
