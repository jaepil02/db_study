# postgres 파생 이미지 — 공식 18.6-alpine + pg_partman + TimescaleDB(정본 docs/09_tech_stack/03_data_infra.md §버전 고정표 · §PostgreSQL 확장)
# 공식 이미지에 pg_partman이 없다(S0 확인) — 마이그레이션 004가 대조군 일 파티션을 만들 때 부른다(빈 볼륨 재생 · 009가 hypertable로 바꾼 뒤엔 관리 대상 없음).
# TimescaleDB — 직접 비교의 PostgreSQL 쪽 비교 사본을 hypertable · 열 압축(columnstore)으로 둔다(ADR-32 · 마이그레이션 009).
#   압축은 Timescale License(TSL) 기능이라 Apache 전용(-oss) 빌드가 아니라 기본 빌드를 쓴다 · 원격 보고(telemetry)는 빌드 기본값부터 끈다(로컬 전용).
#   여러 열로 묶는 벡터 집계(VectorAgg — 설비 · 태그 · 시간별 평균 같은 대량 집계)는 UMASH 해시가 있어야 켜진다. UMASH는 CPU 명령
#   (amd64 pclmul · arm64 crypto)을 컴파일러가 켜야 들어가는데 alpine gcc의 arm64 기본값에는 crypto가 없어 조용히 빠진다 — 그러면 압축 칸을
#   행으로 풀어 한 줄씩 집계해 일반 PostgreSQL과 비슷해진다. arm64는 +crypto로 켜고 USE_UMASH=ON으로 빠지면 빌드를 실패시킨다(Apple Silicon은 지원).
# 빌드 단계만 컴파일 도구를 갖고 결과(확장 · 백그라운드 워커 라이브러리)만 옮긴다 — 실행 이미지는 공식 이미지와 같은 층 위에 파일만 더한다.
ARG PG_IMAGE=postgres:18.6-alpine
FROM ${PG_IMAGE} AS build
ARG PG_PARTMAN_VERSION=5.5.0
# 소스 tarball sha256 — 버전과 한 쌍으로 고정한다(공급망 — 같은 태그 이름의 다른 내용을 빌드하지 않는다 · 2026-09-25 두 번 받아 같은 값)
ARG PG_PARTMAN_SHA256=a3f100ae871677f0012579f58542c174900297f664a4ad2be0256e7ee5e33502
ARG TIMESCALEDB_VERSION=2.30.2
# 2026-10-12 GitHub 태그 tarball에서 잰 값
ARG TIMESCALEDB_SHA256=a7003a70836477dc8d575d95a4c515d8a22ed219d0cb03b3640bb813f04e1b42
RUN apk add --no-cache --virtual .build-deps gcc make musl-dev curl cmake openssl-dev icu-dev util-linux-dev \
 && curl -fsSL -o /tmp/pg_partman.tgz "https://github.com/pgpartman/pg_partman/archive/refs/tags/v${PG_PARTMAN_VERSION}.tar.gz" \
 && echo "${PG_PARTMAN_SHA256}  /tmp/pg_partman.tgz" | sha256sum -c - \
 && tar xzf /tmp/pg_partman.tgz -C /tmp \
 && cd "/tmp/pg_partman-${PG_PARTMAN_VERSION}" \
 && make with_llvm=no \
 && make with_llvm=no install DESTDIR=/out \
 && curl -fsSL -o /tmp/timescaledb.tgz "https://github.com/timescale/timescaledb/archive/refs/tags/${TIMESCALEDB_VERSION}.tar.gz" \
 && echo "${TIMESCALEDB_SHA256}  /tmp/timescaledb.tgz" | sha256sum -c - \
 && tar xzf /tmp/timescaledb.tgz -C /tmp \
 && mkdir "/tmp/timescaledb-${TIMESCALEDB_VERSION}/build" \
 && cd "/tmp/timescaledb-${TIMESCALEDB_VERSION}/build" \
 && case "$(uname -m)" in aarch64) TS_CFLAGS="-march=armv8-a+crypto" ;; *) TS_CFLAGS="" ;; esac \
 && cmake .. -DCMAKE_BUILD_TYPE=Release -DREGRESS_CHECKS=OFF -DTAP_CHECKS=OFF -DWARNINGS_AS_ERRORS=OFF \
      -DGENERATE_DOWNGRADE_SCRIPT=OFF -DSEND_TELEMETRY_DEFAULT=OFF -DPROJECT_INSTALL_METHOD=docker \
      -DUSE_UMASH=ON -DCMAKE_C_FLAGS="$TS_CFLAGS" \
 && make -j"$(nproc)" \
 && make install DESTDIR=/out

FROM ${PG_IMAGE}
COPY --from=build /out/usr/local/ /usr/local/
