// packages/shared의 API 계약(zod 스키마 · 스위치 목록 · WS 종료 코드)만 가져온다.
// 루트 진입점은 Stream 코덱(msgpackr)까지 끌어와 브라우저 번들에 쓰지 않는 코드가 실린다 — api 하위 경로만 쓴다.
// 빌드된 dist가 아니라 TS 소스를 가져온다 — Next(App Router · webpack)는 워크스페이스 패키지를 앱 소스처럼 변환하고, 개발 모드의
// react-refresh 로더는 .js를 ESM으로 보고 import.meta를 붙인다. dist는 "type": "commonjs"의 .js라 그 순간 해석이 깨져
// 개발 서버의 모든 경로가 500이 된다(2026-10-05 확인). 소스는 .ts라 commonjs 규칙에 걸리지 않고, dist를 다시 빌드하지 않아 생기는 낡은 계약도 없다.
export * from '@db-study/shared/src/api';
export { QUALITY, type QualityCode } from '@db-study/shared/src/enums';
