# postgres 파생 이미지 — 공식 18.6-alpine + pg_partman(정본 docs/09_tech_stack/03_data_infra.md §버전 고정표 · §pg_partman)
# 공식 이미지에 pg_partman이 없다(S0 확인) — alarm_event 월 파티션(004) · 대조군 일 파티션(007)의 미리 만들기 · 보존을 워커가 돈다.
# 빌드 단계만 컴파일 도구를 갖고 결과(확장 · 백그라운드 워커 라이브러리)만 옮긴다 — 실행 이미지는 공식 이미지와 같은 층 위에 파일만 더한다.
ARG PG_IMAGE=postgres:18.6-alpine
FROM ${PG_IMAGE} AS build
ARG PG_PARTMAN_VERSION=5.5.0
# 소스 tarball sha256 — 버전과 한 쌍으로 고정한다(공급망 — 같은 태그 이름의 다른 내용을 빌드하지 않는다 · 2026-09-25 두 번 받아 같은 값)
ARG PG_PARTMAN_SHA256=a3f100ae871677f0012579f58542c174900297f664a4ad2be0256e7ee5e33502
RUN apk add --no-cache --virtual .build-deps gcc make musl-dev curl \
 && curl -fsSL -o /tmp/pg_partman.tgz "https://github.com/pgpartman/pg_partman/archive/refs/tags/v${PG_PARTMAN_VERSION}.tar.gz" \
 && echo "${PG_PARTMAN_SHA256}  /tmp/pg_partman.tgz" | sha256sum -c - \
 && tar xzf /tmp/pg_partman.tgz -C /tmp \
 && cd "/tmp/pg_partman-${PG_PARTMAN_VERSION}" \
 && make with_llvm=no \
 && make with_llvm=no install DESTDIR=/out

FROM ${PG_IMAGE}
COPY --from=build /out/usr/local/ /usr/local/
