// 카드 생산 라인 — 시드 · 가상 PLC · HMI 개요 · 웹이 함께 쓰는 설비 구성 정본(D-16 결정 3 · 사용자 결정 2026-10-11)
// 라인 3 × 공정 10 = 설비 30. 설비 코드는 `${라인}-${공정}`(예 L1-LAM) · 태그 코드는 `${설비 코드}-${접미}`(예 L1-LAM-TOP_TEMP).
// 형식은 수집기 디코더가 지원하는 것만 쓴다 — 실수 FLOAT32 · 누적 UINT32 · 상태 코드 UINT16(BOOL 없음).
// 정본 문서: docs/05_data_stores/09_migrations_seed.md §시드(카드 라인) · docs/08_screen(HMI 설비 현황판)

/** 태그 종류 8 — tag_master.tag_kind CHECK와 같은 집합 */
export const TAG_KINDS = [
  'TEMP',
  'PRESSURE',
  'SPEED',
  'CURRENT',
  'VIBRATION',
  'COUNT',
  'STATE',
  'OTHER',
] as const;
export type TagKind = (typeof TAG_KINDS)[number];

/** 화면 이름(쉬운 말) */
export const TAG_KIND_LABEL: Record<TagKind, string> = {
  TEMP: '온도',
  PRESSURE: '압력',
  SPEED: '속도',
  CURRENT: '전류',
  VIBRATION: '진동',
  COUNT: '수량',
  STATE: '상태',
  OTHER: '기타',
};

/** 카드 라인 태그가 쓰는 형식 3 */
export const CARD_TAG_DATA_TYPES = ['FLOAT32', 'UINT32', 'UINT16'] as const;
export type CardTagDataType = (typeof CARD_TAG_DATA_TYPES)[number];

/** 운전 상태 코드(STATE 태그 값 — UINT16) */
export const DEVICE_STATE_CODE = { STOPPED: 0, IDLE: 1, RUNNING: 2 } as const;

export interface CardTagTemplate {
  /** 태그 코드 접미 */
  suffix: string;
  name: string;
  kind: TagKind;
  unit: string;
  dataType: CardTagDataType;
  /** 보내는 주기(ms) */
  scanRateMs: number;
  /** 정상 범위(공학 단위) — 누적 · 상태는 null 허용 */
  rangeMin: number | null;
  rangeMax: number | null;
  /** HMI 칸에 크게 보일 핵심 값(설비당 정확히 1개) */
  key?: true;
}

export interface CardProcess {
  code: string;
  name: string;
  /** 라인 안 순서 1~10(왼쪽 → 오른쪽) */
  order: number;
  tags: readonly CardTagTemplate[];
}

export const CARD_LINES = [
  { code: 'L1', name: '라인 1' },
  { code: 'L2', name: '라인 2' },
  { code: 'L3', name: '라인 3' },
] as const;
export type CardLineCode = (typeof CARD_LINES)[number]['code'];

/** 사이트(공장) — 카드 라인 3개가 속한다 */
export const CARD_SITE = { code: 'CARD-FAB', name: '카드 공장' } as const;

const STATE_TAG: CardTagTemplate = {
  suffix: 'STATE',
  name: '운전 상태',
  kind: 'STATE',
  unit: '',
  dataType: 'UINT16',
  scanRateMs: 1000,
  rangeMin: 0,
  rangeMax: 2,
};

const counter = (suffix: string, name: string, unit: string): CardTagTemplate => ({
  suffix,
  name,
  kind: 'COUNT',
  unit,
  dataType: 'UINT32',
  scanRateMs: 1000,
  rangeMin: 0,
  rangeMax: null,
});

/** 공정 10 — 카드(플라스틱 · IC) 생산 순서 */
export const CARD_PROCESSES: readonly CardProcess[] = [
  {
    code: 'PRT',
    name: '인쇄',
    order: 1,
    tags: [
      {
        suffix: 'SPEED',
        name: '인쇄 속도',
        kind: 'SPEED',
        unit: '매/분',
        dataType: 'FLOAT32',
        scanRateMs: 1000,
        rangeMin: 0,
        rangeMax: 120,
        key: true,
      },
      {
        suffix: 'INK_TEMP',
        name: '잉크 온도',
        kind: 'TEMP',
        unit: '°C',
        dataType: 'FLOAT32',
        scanRateMs: 1000,
        rangeMin: 18,
        rangeMax: 35,
      },
      counter('SHEETS', '시트 수', '장'),
      STATE_TAG,
    ],
  },
  {
    code: 'COL',
    name: '합지',
    order: 2,
    tags: [
      {
        suffix: 'FEED',
        name: '이송 속도',
        kind: 'SPEED',
        unit: 'm/분',
        dataType: 'FLOAT32',
        scanRateMs: 1000,
        rangeMin: 0,
        rangeMax: 30,
        key: true,
      },
      {
        suffix: 'ALIGN',
        name: '정렬 오차',
        kind: 'OTHER',
        unit: 'mm',
        dataType: 'FLOAT32',
        scanRateMs: 1000,
        rangeMin: -0.5,
        rangeMax: 0.5,
      },
      counter('SHEETS', '시트 수', '장'),
      STATE_TAG,
    ],
  },
  {
    code: 'LAM',
    name: '라미네이팅',
    order: 3,
    tags: [
      {
        suffix: 'TOP_TEMP',
        name: '상판 온도',
        kind: 'TEMP',
        unit: '°C',
        dataType: 'FLOAT32',
        scanRateMs: 1000,
        rangeMin: 120,
        rangeMax: 170,
        key: true,
      },
      {
        suffix: 'BOT_TEMP',
        name: '하판 온도',
        kind: 'TEMP',
        unit: '°C',
        dataType: 'FLOAT32',
        scanRateMs: 1000,
        rangeMin: 120,
        rangeMax: 170,
      },
      {
        suffix: 'PRESS',
        name: '프레스 압력',
        kind: 'PRESSURE',
        unit: 'bar',
        dataType: 'FLOAT32',
        scanRateMs: 200,
        rangeMin: 0,
        rangeMax: 25,
      },
      counter('CYCLES', '사이클 수', '회'),
      STATE_TAG,
    ],
  },
  {
    code: 'PUN',
    name: '펀칭',
    order: 4,
    tags: [
      {
        suffix: 'SPEED',
        name: '타발 속도',
        kind: 'SPEED',
        unit: '타/분',
        dataType: 'FLOAT32',
        scanRateMs: 1000,
        rangeMin: 0,
        rangeMax: 300,
        key: true,
      },
      {
        suffix: 'CURRENT',
        name: '모터 전류',
        kind: 'CURRENT',
        unit: 'A',
        dataType: 'FLOAT32',
        scanRateMs: 100,
        rangeMin: 0,
        rangeMax: 40,
      },
      counter('PUNCHES', '타발 수', '회'),
      STATE_TAG,
    ],
  },
  {
    code: 'HST',
    name: '핫스탬핑',
    order: 5,
    tags: [
      {
        suffix: 'HEAD_TEMP',
        name: '헤드 온도',
        kind: 'TEMP',
        unit: '°C',
        dataType: 'FLOAT32',
        scanRateMs: 1000,
        rangeMin: 100,
        rangeMax: 200,
        key: true,
      },
      {
        suffix: 'PRESS',
        name: '스탬핑 압력',
        kind: 'PRESSURE',
        unit: 'bar',
        dataType: 'FLOAT32',
        scanRateMs: 200,
        rangeMin: 0,
        rangeMax: 10,
      },
      counter('STAMPS', '스탬핑 수', '회'),
      STATE_TAG,
    ],
  },
  {
    code: 'MIL',
    name: '칩 홈 가공',
    order: 6,
    tags: [
      {
        suffix: 'SPINDLE',
        name: '스핀들 회전수',
        kind: 'SPEED',
        unit: 'rpm',
        dataType: 'FLOAT32',
        scanRateMs: 200,
        rangeMin: 0,
        rangeMax: 30000,
        key: true,
      },
      {
        suffix: 'VIB',
        name: '진동',
        kind: 'VIBRATION',
        unit: 'mm/s',
        dataType: 'FLOAT32',
        scanRateMs: 100,
        rangeMin: 0,
        rangeMax: 8,
      },
      counter('MILLED', '가공 수', '장'),
      STATE_TAG,
    ],
  },
  {
    code: 'EMB',
    name: '칩 삽입',
    order: 7,
    tags: [
      {
        suffix: 'GLUE_TEMP',
        name: '핫멜트 온도',
        kind: 'TEMP',
        unit: '°C',
        dataType: 'FLOAT32',
        scanRateMs: 1000,
        rangeMin: 150,
        rangeMax: 210,
        key: true,
      },
      {
        suffix: 'PRESS',
        name: '접착 압력',
        kind: 'PRESSURE',
        unit: 'bar',
        dataType: 'FLOAT32',
        scanRateMs: 200,
        rangeMin: 0,
        rangeMax: 6,
      },
      counter('INSERTED', '삽입 수', '장'),
      counter('DEFECTS', '불량 수', '장'),
      STATE_TAG,
    ],
  },
  {
    code: 'PER',
    name: '개인화',
    order: 8,
    tags: [
      {
        suffix: 'SPEED',
        name: '처리 속도',
        kind: 'SPEED',
        unit: '장/분',
        dataType: 'FLOAT32',
        scanRateMs: 1000,
        rangeMin: 0,
        rangeMax: 60,
        key: true,
      },
      {
        suffix: 'LASER',
        name: '레이저 출력',
        kind: 'OTHER',
        unit: '%',
        dataType: 'FLOAT32',
        scanRateMs: 1000,
        rangeMin: 0,
        rangeMax: 100,
      },
      counter('ENCODED', '인코딩 성공', '장'),
      counter('ENC_ERR', '인코딩 오류', '장'),
      STATE_TAG,
    ],
  },
  {
    code: 'INS',
    name: '검사',
    order: 9,
    tags: [
      {
        suffix: 'SPEED',
        name: '검사 속도',
        kind: 'SPEED',
        unit: '장/분',
        dataType: 'FLOAT32',
        scanRateMs: 1000,
        rangeMin: 0,
        rangeMax: 120,
        key: true,
      },
      {
        suffix: 'LIGHT',
        name: '조명 밝기',
        kind: 'OTHER',
        unit: '%',
        dataType: 'FLOAT32',
        scanRateMs: 1000,
        rangeMin: 0,
        rangeMax: 100,
      },
      counter('INSPECTED', '검사 수', '장'),
      counter('REJECTED', '불량 수', '장'),
      STATE_TAG,
    ],
  },
  {
    code: 'PAC',
    name: '포장',
    order: 10,
    tags: [
      {
        suffix: 'SPEED',
        name: '포장 속도',
        kind: 'SPEED',
        unit: '개/분',
        dataType: 'FLOAT32',
        scanRateMs: 1000,
        rangeMin: 0,
        rangeMax: 120,
        key: true,
      },
      counter('PACKED', '포장 수', '개'),
      STATE_TAG,
    ],
  },
];

export const cardDeviceCode = (line: string, process: string) => `${line}-${process}`;
export const cardTagCode = (deviceCode: string, suffix: string) => `${deviceCode}-${suffix}`;

/** 설비 코드 → (라인 · 공정) — 카드 라인 설비가 아니면 null(시연 전용 설비 DEMO-FLOW-DEV 등) */
export function parseCardDeviceCode(code: string): { line: CardLineCode; process: CardProcess } | null {
  const m = /^(L[1-3])-([A-Z]{3})$/.exec(code);
  if (!m) return null;
  const process = CARD_PROCESSES.find((p) => p.code === m[2]);
  return process ? { line: m[1] as CardLineCode, process } : null;
}

/** 설비 하나가 주기대로 보내는 초당 점 수(Σ 1000 ÷ 주기) */
export const nominalPointsPerSec = (p: CardProcess) => p.tags.reduce((a, t) => a + 1000 / t.scanRateMs, 0);
