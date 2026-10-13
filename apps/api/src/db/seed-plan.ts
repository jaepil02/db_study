// 시드 구성 — 모양 정본 docs/05_data_stores/09_migrations_seed.md §시드
// 두 종류: 카드 라인(card-line · 로컬 기본 — 라인 3 × 공정 10 = 설비 30 · 태그 129 · D-16 결정 3)과 S2 슬라이스(설비 1 · 태그 8 — 시험 · 빈 DB 기동용).
// 카드 라인의 설비 · 태그 정의 정본은 packages/shared/src/card-line.ts — 시드는 그 템플릿을 그대로 tag_master 행으로 옮긴다.
// 티어 시드(S · M · L) · 계정 · 역할 시드는 D-16에서 측정 도구 · 로그인과 함께 삭제.
import {
  CARD_LINES,
  CARD_PROCESSES,
  CARD_SITE,
  type CardTagDataType,
  cardDeviceCode,
  cardTagCode,
  type TagKind,
} from '@db-study/shared';
import { DATA_TYPE_WORDS } from '../modules/collector/decode';

export const SIM_BASE_PORT = 5020; // PlcSim 대역 5020~5119(REQ-SIM-01)
/** PlcSim 대역의 설비 수 상한(5020~5119) */
export const SIM_PORT_SLOTS = 100;

export type SeedTarget = { kind: 'slice' } | { kind: 'card-line' };

export interface SeedTag {
  tagCode: string;
  tagName: string;
  /** FC03 holding 레지스터 시작 주소 — 설비 안에서 형식 워드 수만큼 연속(갭 0) */
  address: number;
  dataType: CardTagDataType;
  /** 2워드 형식(FLOAT32 · UINT32)은 ABCD · 1워드(UINT16)는 NULL(tag_master CHECK) */
  wordOrder: 'ABCD' | null;
  unit: string;
  scanRateMs: number;
  rangeMin: number | null;
  rangeMax: number | null;
  /** tag_master.tag_kind — 슬라이스는 NULL */
  tagKind: TagKind | null;
}

export interface SeedDevice {
  deviceCode: string;
  deviceName: string;
  vendor: string | null;
  model: string | null;
  port: number;
  tags: SeedTag[];
}

export interface SeedLine {
  lineCode: string;
  lineName: string;
  devices: SeedDevice[];
}

export interface SeedLayout {
  label: string;
  site: { code: string; name: string };
  lines: SeedLine[];
}

/** 템플릿 순서대로 주소를 잇는다 — 다음 태그 주소 = 앞 태그 주소 + 앞 태그 워드 수 */
function withAddresses<T extends { dataType: CardTagDataType }>(
  tags: readonly T[],
): (T & { address: number })[] {
  let next = 0;
  return tags.map((t) => {
    const address = next;
    next += DATA_TYPE_WORDS[t.dataType];
    return { ...t, address };
  });
}

/** 카드 라인 — 라인 L1~L3 × 공정 10 · 포트 5020 + 순번(라인 순 → 공정 순) · 설비 이름 '라인 1 인쇄' · vendor SIM · model 공정 코드 */
function cardLineLayout(): SeedLayout {
  let slot = 0;
  const lines = CARD_LINES.map((line) => ({
    lineCode: line.code,
    lineName: line.name,
    devices: [...CARD_PROCESSES]
      .sort((a, b) => a.order - b.order)
      .map((p) => {
        const deviceCode = cardDeviceCode(line.code, p.code);
        const port = SIM_BASE_PORT + slot;
        slot += 1;
        return {
          deviceCode,
          deviceName: `${line.name} ${p.name}`,
          vendor: 'SIM',
          model: p.code,
          port,
          tags: withAddresses(p.tags).map(
            (t): SeedTag => ({
              tagCode: cardTagCode(deviceCode, t.suffix),
              tagName: t.name,
              address: t.address,
              dataType: t.dataType,
              wordOrder: DATA_TYPE_WORDS[t.dataType] > 1 ? 'ABCD' : null,
              unit: t.unit,
              scanRateMs: t.scanRateMs,
              rangeMin: t.rangeMin,
              rangeMax: t.rangeMax,
              tagKind: t.kind,
            }),
          ),
        };
      }),
  }));
  return { label: '카드 라인(라인 3 × 공정 10)', site: { ...CARD_SITE }, lines };
}

/** S2 슬라이스 — 설비 1 · 태그 8 · FLOAT32 ABCD · 1초 · 단위 · 범위 · 종류 없음(범위는 --range가 건다) */
function sliceLayout(): SeedLayout {
  const deviceCode = 'DEV-001';
  return {
    label: 'S2 슬라이스',
    site: { code: 'SITE-001', name: '시뮬레이션 사이트' },
    lines: [
      {
        lineCode: 'LINE-001',
        lineName: '시뮬레이션 라인',
        devices: [
          {
            deviceCode,
            deviceName: '시뮬레이션 설비 1',
            vendor: null,
            model: null,
            port: SIM_BASE_PORT,
            tags: Array.from({ length: 8 }, (_, i) => ({
              tagCode: `${deviceCode}-T${String(i + 1).padStart(3, '0')}`,
              tagName: `태그 ${i + 1}`,
              address: i * 2,
              dataType: 'FLOAT32' as const,
              wordOrder: 'ABCD' as const,
              unit: '',
              scanRateMs: 1000,
              rangeMin: null,
              rangeMax: null,
              tagKind: null,
            })),
          },
        ],
      },
    ],
  };
}

export function seedLayout(t: SeedTarget): SeedLayout {
  const layout = t.kind === 'card-line' ? cardLineLayout() : sliceLayout();
  const devices = layout.lines.reduce((n, l) => n + l.devices.length, 0);
  if (devices > SIM_PORT_SLOTS) throw new Error('PlcSim 대역(5020~5119)을 넘는 설비 수');
  return layout;
}

/** 시드 대상 — --card-line · --slice s2 · 둘 다 없으면 카드 라인(로컬 기본) */
export function parseSeedTarget(argv: readonly string[]): SeedTarget {
  const card = argv.includes('--card-line');
  const s = argv.indexOf('--slice');
  if (card && s >= 0) throw new Error('--card-line과 --slice는 함께 쓰지 않는다');
  if (s >= 0) {
    if (argv[s + 1] === 's2') return { kind: 'slice' };
    throw new Error('사용: seed [--card-line | --slice s2]');
  }
  return { kind: 'card-line' };
}

/** 모든 태그에 같은 값으로 거는 시드 옵션 — 데드밴드(SW-10 실험) · 범위(BAD_RANGE 실험 · AC-08 — 슬라이스 전용) */
export interface SeedOptions {
  /** tag_master.deadband — 공학 단위 절대값 · 기본 0(= 데드밴드 없음) */
  deadband: number;
  /** tag_master.range_min · range_max — 기본 NULL(범위 판정 없음) · 카드 라인은 템플릿 범위를 쓰므로 거부한다 */
  range: { min: number; max: number } | null;
}

function optValue(argv: readonly string[], name: string): string | null {
  const i = argv.indexOf(name);
  if (i < 0) return null;
  const v = argv[i + 1];
  if (v === undefined || v.startsWith('--')) throw new Error(`${name} 값이 없다`);
  return v;
}

/**
 * --deadband <값> · --range <min>,<max> — 제약은 tag_master CHECK와 같다(deadband ≥ 0 · range_min < range_max).
 * 어기면 트랜잭션 전에 거부한다 — CHECK 위반을 롤백으로 알게 되면 어느 옵션이 틀렸는지 문장이 흐려진다.
 */
export function parseSeedOptions(argv: readonly string[]): SeedOptions {
  const db = optValue(argv, '--deadband');
  const deadband = db === null ? 0 : Number(db);
  if (!Number.isFinite(deadband) || deadband < 0) throw new Error(`--deadband ${db} — 0 이상 유한 수`);
  const rg = optValue(argv, '--range');
  let range: SeedOptions['range'] = null;
  if (rg !== null) {
    const parts = rg.split(',');
    const [min, max] = parts.map((x) => (x.trim() === '' ? Number.NaN : Number(x)));
    if (
      parts.length !== 2 ||
      !Number.isFinite(min) ||
      !Number.isFinite(max) ||
      !((min as number) < (max as number))
    )
      throw new Error(`--range ${rg} — <min>,<max> 유한 수 · min < max`);
    range = { min: min as number, max: max as number };
  }
  return { deadband, range };
}

/** 대상 × 옵션 — 카드 라인은 템플릿 범위가 정본이라 --range를 받지 않는다(태그마다 범위가 다르다) */
export function assertSeedOptionsFor(t: SeedTarget, o: SeedOptions): void {
  if (t.kind === 'card-line' && o.range !== null)
    throw new Error('--range는 슬라이스 전용 — 카드 라인은 템플릿(card-line.ts)의 태그별 범위를 쓴다');
}

/**
 * seed 완료 줄에 싣는 옵션 문장 — 시드 조건을 로그에서 읽는다(scan_rate_ms는 완료 줄이 따로 싣는다).
 * range는 실제로 넣은 값대로 — --range면 그 값(모든 태그) · 아니면 템플릿 범위(카드 라인 — 태그별 · 수량은 하한 0만) · 범위가 없으면 NULL.
 */
export function describeSeedOptions(o: SeedOptions, layout: SeedLayout): string {
  return `deadband ${o.deadband} · range ${o.range ? `${o.range.min},${o.range.max}` : describeTemplateRanges(layout)}`;
}

/** 템플릿 범위 — 전부 없으면 'NULL' · 아니면 '태그별(템플릿 — 양끝 90 · 하한만 39)'처럼 모양별 태그 수 */
function describeTemplateRanges(layout: SeedLayout): string {
  const n = { 양끝: 0, 하한만: 0, 상한만: 0, NULL: 0 };
  for (const l of layout.lines)
    for (const d of l.devices)
      for (const t of d.tags) {
        if (t.rangeMin !== null && t.rangeMax !== null) n.양끝++;
        else if (t.rangeMin !== null) n.하한만++;
        else if (t.rangeMax !== null) n.상한만++;
        else n.NULL++;
      }
  if (n.NULL === n.양끝 + n.하한만 + n.상한만 + n.NULL) return 'NULL';
  const parts = Object.entries(n)
    .filter(([, c]) => c > 0)
    .map(([k, c]) => `${k} ${c}`);
  return `태그별(템플릿 — ${parts.join(' · ')})`;
}

/** 시드의 태그 주기 구성 — 완료 줄 문장(예 '100 ms 6 · 200 ms 12 · 1000 ms 111') */
export function describeScanRates(layout: SeedLayout): string {
  const by = new Map<number, number>();
  for (const l of layout.lines)
    for (const d of l.devices) for (const t of d.tags) by.set(t.scanRateMs, (by.get(t.scanRateMs) ?? 0) + 1);
  return [...by.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([ms, n]) => `${ms} ms ${n}`)
    .join(' · ');
}
