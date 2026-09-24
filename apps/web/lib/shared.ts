// packages/shared의 API 계약(zod 스키마 · 스위치 목록 · WS 종료 코드)만 가져온다.
// 루트 진입점은 Stream 코덱(msgpackr)까지 끌어와 브라우저 번들에 쓰지 않는 코드가 실린다 — api 하위 경로의 빌드된 dist를 쓴다.
export * from '@db-study/shared/dist/api';
export { QUALITY, type QualityCode } from '@db-study/shared/dist/enums';
