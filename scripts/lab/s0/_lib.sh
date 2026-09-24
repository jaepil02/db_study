# S0 실습 공용 함수 — 명령을 먼저 보여 주고 실행한다(손으로 다시 칠 수 있게).
# 비밀은 컨테이너 환경변수(REDISCLI_AUTH · CLICKHOUSE_USER/PASSWORD)와 .env에서만 읽고 출력하지 않는다.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
PG=db_study-postgres-1
CH=db_study-clickhouse-1
RD=db_study-redis-1

step() { printf '\n── %s\n' "$*"; }
# redis-cli — 컨테이너 안 REDISCLI_AUTH를 쓴다
r() { printf 'redis> %s\n' "$*"; docker exec "$RD" redis-cli "$@"; }
# psql — 관리자 계정(app 계정은 migrate가 만든다)
p() { printf 'psql> %s\n' "$1"; docker exec "$PG" psql -U postgres -d plc -X -P pager=off -c "$1"; }
# clickhouse-client — 컨테이너 안 CLICKHOUSE_USER/PASSWORD를 쓴다
c() { printf 'ch> %s\n' "$1"; docker exec "$CH" clickhouse-client --format PrettyCompactMonoBlock -q "$1"; }
cq() { docker exec "$CH" clickhouse-client -q "$1"; }          # 값만(출력 없이 계산에 쓴다)
cf() { docker exec -i "$CH" clickhouse-client --multiquery < "$1"; }
# ClickHouse HTTP 8123 — 적재 경로와 같은 표면. 요약 헤더(X-ClickHouse-Summary)를 돌려준다
ch_pw() { grep '^CLICKHOUSE_PASSWORD=' "$ROOT/.env" | cut -d= -f2-; }
http_insert() { # $1=쿼리스트링(인코딩 완료) $2=데이터 파일
  # 자격 증명은 표준 입력의 curl 설정으로 넘긴다 — 명령줄 인자로 주면 프로세스 목록에 보인다
  printf 'user = "app:%s"\n' "$(ch_pw)" | curl -sS -K - -o /tmp/ch_body.$$ -D /tmp/ch_hdr.$$ -w '%{http_code}' \
    "http://127.0.0.1:8123/?$1" --data-binary @"$2" > /tmp/ch_code.$$ || true
  code=$(cat /tmp/ch_code.$$)
  summary=$(grep -i '^X-ClickHouse-Summary' /tmp/ch_hdr.$$ | cut -d' ' -f2- | tr -d '\r' || true)
  body=$(head -c 300 /tmp/ch_body.$$ | tr '\n' ' ')
  rm -f /tmp/ch_body.$$ /tmp/ch_hdr.$$ /tmp/ch_code.$$
  wr=$(printf '%s' "$summary" | sed -n 's/.*"written_rows":"\([0-9]*\)".*/\1/p')
  printf 'http=%s written_rows=%s summary=%s body=%s\n' "$code" "${wr:-none}" "$summary" "$body"
}
