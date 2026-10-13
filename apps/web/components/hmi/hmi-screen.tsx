'use client';
// ⑦ 설비 현황판(/hmi) — 정본 docs/08_screen/11_hmi_screen.md §HMI-PLANT.
// 사용자 요구: 설비 상태가 어떤지 · 어떤 종류의 PLC 데이터를 보내는지만 — 알람 · 원격 조작 없음 · 한 눈에.
// 위 요약 줄(상태 4 개수 · 초당 개수 · 종류 비율) → 가운데 라인 판(라인 3 × 공정 10 — 칸 = 상태 띠 · 핵심 값 · 종류 기호 · 초당 개수)
// → 아래 고른 설비 자세히(태그를 종류별로 · 값 · 형식 · 주기 · 최근 10분 작은 선 · 출처 표지 — 이 목록만 안에서 스크롤).
// 공정 이름은 열 머리에 한 번만 쓴다(라인 3개가 같은 공정 순서 — 칸마다 되풀이하지 않아 글자를 줄인다 · 칸의 접근성 이름에는 전체 이름).
// 데이터: 개요 1초(BFF /bff/plant/overview — 지금 값은 Redis만) · 최근 10분 5초(api 직결 시계열 조회 — ClickHouse). 판독 lib/hmi.ts · 읽기 data.ts.
// 맞춤 보기(fit:)에서 자세히는 목록 자리(가장 태그가 많은 설비의 줄 수) 높이만 갖고 남는 높이는 라인 판이 다 가진다 — 큰 화면에서 자세히 아래가 비지 않는다.
// 낮은 화면에서는 라인 판이 본문의 45% 아래로 줄지 않고 자세히 목록이 안에서 스크롤한다. 작은 화면(맞춤 보기 밖)은 쌓인다.
// 머리 오른쪽은 공용 컨트롤(설비 가동 스위치 · 데이터 지우기 — components/controls · ⑤와 같은 것).
import { TAG_KIND_LABEL } from '@db-study/shared/src/card-line';
import { type CSSProperties, type ReactNode, useMemo, useState } from 'react';
import {
  allDevices,
  BASIS_NOTE,
  deviceKinds,
  gapLimitMs,
  type KindMix,
  keyTagOf,
  kindMix,
  OVERVIEW_FAILED_TEXT,
  POWER_OFF_TEXT,
  periodText,
  ppsText,
  processColumns,
  STATE_VIEW,
  shareText,
  staleNote,
  TREND_WINDOW_MS,
  tagSlots,
  tagsByKind,
  valueText,
} from '../../lib/hmi';
import {
  PLANT_DEVICE_STATES,
  type PlantDeviceBody,
  type PlantOverviewBody,
  type PlantTagBody,
} from '../../lib/shared';
import { cn } from '../../lib/utils';
import { PlantPowerSwitch } from '../controls/plant-power';
import { PurgeButton } from '../controls/purge-button';
import { Footnote, Panel, Screen, ScrollList } from '../shell/screen';
import { UiIcon } from '../ui/icon';
import { STORE, STORE_DOT_CLASS, type StoreKey } from '../ui/store';
import { useDeviceTrend, usePlantOverview } from './data';
import { KindGlyph, PowerGlyph, StateGlyph } from './glyphs';
import { Sparkline } from './sparkline';

export const HMI_TITLE = '카드 생산 라인 3개, 설비 30대 지금 상태';
export const HMI_LEAD = '칸 하나가 설비 한 대예요 — 누르면 아래에 자세히 보여요';
export const HMI_FOOT = '1s마다 새로 읽어요 · 통신 끊김 = 값이 5s 넘게 안 바뀐 설비';
const HMI_FOOT_TIP =
  '지금 값은 Redis(rt:latest)에서 30대를 한 번에 읽고, 최근 10분은 ClickHouse(tag_raw)에서 5s마다 읽어요. ' +
  '초당 개수는 수집기가 실제로 보낸 수예요 — "주기 기준"이라고 적힌 때는 태그 보내는 주기로 센 수예요.';

/** 출처 표지 3 — 상세 머리(계획 §화면 ⑦ "지금 값 Redis · 최근 추이 ClickHouse · 설비 정보 PostgreSQL") */
export const HMI_SOURCES: readonly { store: StoreKey; what: string }[] = [
  { store: 'redis', what: '지금 값' },
  { store: 'ch', what: '최근 10분' },
  { store: 'pg', what: '설비 · 태그 정보' },
];

const StoreDot = ({ store }: { store: StoreKey }) => (
  <span aria-hidden className={STORE_DOT_CLASS} style={{ backgroundColor: STORE[store].color }} />
);

// ── 요약 줄 ──

function Divider() {
  return <span aria-hidden className="hidden w-px self-stretch bg-line fit:block" />;
}

function KindMixView({ mix }: { mix: KindMix | null }) {
  const maxShare = mix ? Math.max(...mix.rows.map((r) => r.share)) || 1 : 1;
  return (
    <div
      data-testid="kind-mix"
      data-basis={mix?.basis ?? ''}
      className="flex min-w-0 flex-1 flex-col justify-center gap-1"
    >
      <p className="text-foot text-slate-500">
        보내는 데이터 종류{mix?.basis === 'period' ? ' — 켜면 이 비율로 보내요(주기 기준)' : ''}
      </p>
      <ul className="grid grid-cols-4 gap-x-[calc(var(--gap)*0.75)] gap-y-1 fit:grid-cols-8">
        {(mix?.rows ?? []).map((r) => (
          <li
            key={r.kind}
            data-kind={r.kind}
            title={`${r.label} — 초당 ${ppsText(r.pps)}개 · ${shareText(r.share)}`}
            className="flex min-w-0 flex-col gap-0.5"
          >
            <span className="flex min-w-0 items-center gap-1 text-note text-slate-800">
              <KindGlyph kind={r.kind} className="text-slate-600" />
              <span className="truncate">{r.label}</span>
            </span>
            {/* 막대 길이는 가장 큰 종류 = 칸 끝(트랙을 두지 않아 100%로 읽히지 않게) — 몇 %인지는 막대 앞 글자가 말한다 */}
            <span className="flex min-w-0 items-center gap-1">
              <span className="w-[2.6em] shrink-0 text-foot text-slate-700 tabular-nums">
                {shareText(r.share)}
              </span>
              <span className="flex h-[clamp(5px,calc(5px+3*var(--fs)),8px)] min-w-0 flex-1">
                <span
                  className={cn(
                    'block h-full rounded-r-sm',
                    mix?.basis === 'period' ? 'bg-slate-300' : 'bg-slate-500',
                  )}
                  style={{ width: `${(r.share / maxShare) * 100}%` }}
                />
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Summary({ ov }: { ov: PlantOverviewBody | undefined }) {
  const mix = useMemo(() => (ov ? kindMix(ov) : null), [ov]);
  const basis = ov ? BASIS_NOTE[ov.pointsPerSecBasis] : null;
  return (
    <section
      aria-label="요약"
      data-testid="hmi-summary"
      className="flex shrink-0 flex-wrap items-stretch gap-x-[calc(var(--gap)*1.5)] gap-y-2 rounded-lg border border-line bg-surface px-[var(--pad)] py-[calc(var(--pad)*0.6)]"
    >
      <ul aria-label="설비 상태" className="flex flex-wrap items-center gap-x-[var(--gap)] gap-y-1">
        {PLANT_DEVICE_STATES.map((s) => (
          <li key={s} data-testid="state-count" data-state={s} className="flex items-center gap-1.5">
            <StateGlyph state={s} className="text-body" />
            <span className="text-note text-slate-700">{STATE_VIEW[s].label}</span>
            <b className="text-big font-bold text-slate-900">{ov ? ov.totals[s] : '–'}</b>
          </li>
        ))}
      </ul>
      <Divider />
      <p
        data-testid="hmi-pps"
        className="flex flex-wrap items-baseline gap-x-1.5 self-center text-note text-slate-700"
      >
        초당
        <b className="text-big font-bold text-slate-900">{ov ? ppsText(ov.totals.pointsPerSec) : '–'}</b>개
        데이터
        {basis ? <span className="text-foot text-slate-500">({basis})</span> : null}
      </p>
      <Divider />
      <KindMixView mix={mix} />
    </section>
  );
}

// ── 라인 판 ──

function Tile({
  device,
  selected,
  onSelect,
  style,
}: {
  device: PlantDeviceBody;
  selected: boolean;
  onSelect: (code: string) => void;
  style: CSSProperties;
}) {
  const v = STATE_VIEW[device.state];
  const key = keyTagOf(device);
  const muted = device.state === 'stopped' || device.state === 'offline';
  const keyText = key ? `${key.name} ${valueText(key)}${key.unit ? ` ${key.unit}` : ''}` : '핵심 값 없음';
  return (
    <button
      type="button"
      data-testid="device-tile"
      data-device={device.code}
      data-state={device.state}
      aria-pressed={selected}
      aria-label={`${device.name} — ${v.label} · ${keyText} · 초당 ${ppsText(device.pointsPerSec)}개`}
      onClick={() => onSelect(device.code)}
      style={style}
      className={cn(
        '@container relative z-10 flex min-h-0 min-w-0 flex-col rounded-md border bg-surface text-left',
        'transition-colors focus-visible:outline-offset-1',
        selected
          ? 'border-slate-900 bg-slate-50 ring-2 ring-slate-900'
          : 'border-line hover:border-slate-400',
      )}
    >
      <span
        aria-hidden
        className="h-[clamp(3px,calc(3px+3*var(--fs)),6px)] w-full shrink-0 rounded-t-[5px]"
        style={{ backgroundColor: v.band }}
      />
      <span className="flex min-h-0 flex-1 flex-col justify-between gap-0.5 px-[calc(var(--pad)*0.6)] py-[calc(var(--pad)*0.35)]">
        <span className="flex items-center justify-between gap-1 text-foot text-slate-600">
          <StateGlyph state={device.state} className="text-note" />
          <span className="whitespace-nowrap tabular-nums">초당 {ppsText(device.pointsPerSec)}개</span>
        </span>
        <span className="flex min-w-0 items-baseline gap-1">
          <b
            data-testid="tile-value"
            className={cn(
              'font-bold leading-tight whitespace-nowrap tabular-nums',
              muted ? 'text-slate-400' : 'text-slate-900',
            )}
            // 칸 폭을 따라 큰다(16cqi) — 좁은 칸(1280에서 내비를 펼친 때)에서도 다섯 자리 값 + 단위(25,018 rpm)가 잘리지 않고 · 넓은 화면은 큰 숫자 크기까지
            style={{ fontSize: 'clamp(var(--text-body), 16cqi, var(--text-big))' }}
          >
            {key ? valueText(key) : '—'}
          </b>
          {key?.unit ? <span className="truncate text-foot text-slate-500">{key.unit}</span> : null}
        </span>
        <span
          aria-hidden
          className="flex items-center gap-[0.35em] text-note text-slate-500 @[11rem]:text-body"
        >
          {deviceKinds(device).map((k) => (
            <KindGlyph key={k} kind={k} />
          ))}
        </span>
      </span>
    </button>
  );
}

function Notice({ testId, icon, children }: { testId: string; icon: ReactNode; children: ReactNode }) {
  return (
    <p
      data-testid={testId}
      role="status"
      className="flex shrink-0 items-center gap-2 rounded-md bg-slate-100 px-[calc(var(--pad)*0.6)] py-[calc(var(--pad)*0.3)] text-body text-slate-700"
    >
      {icon}
      {children}
    </p>
  );
}

function LineBoard({
  ov,
  failed,
  selected,
  onSelect,
}: {
  ov: PlantOverviewBody;
  failed: boolean;
  selected: string | null;
  onSelect: (code: string) => void;
}) {
  const cols = processColumns(ov);
  const grid: CSSProperties = {
    gridTemplateColumns: `auto repeat(${cols.length}, minmax(0, 1fr))`,
    gridTemplateRows: `auto repeat(${ov.lines.length}, minmax(0, 1fr))`,
  };
  return (
    <Panel label="라인 판" className="fit:min-h-0" bodyClassName="gap-[calc(var(--gap)*0.6)]">
      {failed ? (
        <Notice testId="overview-failed" icon={<UiIcon name="warn" className="size-[1em] text-slate-500" />}>
          {OVERVIEW_FAILED_TEXT}
        </Notice>
      ) : !ov.power ? (
        <Notice testId="power-off" icon={<PowerGlyph className="text-slate-500" />}>
          {POWER_OFF_TEXT}
        </Notice>
      ) : null}
      <div
        data-testid="line-board"
        className="grid min-h-0 gap-x-[calc(var(--gap)*0.6)] gap-y-[calc(var(--gap)*0.6)] fit:flex-1"
        style={grid}
      >
        {cols.map((c, i) => (
          <span
            key={c.order}
            data-testid="process-head"
            className="flex min-w-0 items-center justify-between gap-1 text-note font-semibold text-slate-700"
            style={{ gridRow: 1, gridColumn: i + 2 }}
          >
            <span className="truncate">{c.name}</span>
            {i < cols.length - 1 ? (
              <svg
                viewBox="0 0 24 24"
                className="size-[1em] shrink-0 text-slate-400"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m9 6 6 6-6 6" />
              </svg>
            ) : null}
          </span>
        ))}
        {ov.lines.map((l, li) => (
          <LineRow key={l.code} row={li + 2} line={l} cols={cols} selected={selected} onSelect={onSelect} />
        ))}
      </div>
    </Panel>
  );
}

function LineRow({
  row,
  line,
  cols,
  selected,
  onSelect,
}: {
  row: number;
  line: PlantOverviewBody['lines'][number];
  cols: { order: number }[];
  selected: string | null;
  onSelect: (code: string) => void;
}) {
  return (
    <>
      <span
        data-testid="line-label"
        className="flex items-center pr-1 text-note font-semibold whitespace-nowrap text-slate-700"
        style={{ gridRow: row, gridColumn: 1 }}
      >
        {line.name}
      </span>
      {/* 컨베이어 — 칸 뒤로 지나가는 가는 선(라인 한 줄이 이어진 흐름이라는 것만 말한다) */}
      <span
        aria-hidden="true"
        className="pointer-events-none flex items-center"
        style={{ gridRow: row, gridColumn: `2 / ${cols.length + 2}` }}
      >
        <span className="h-0.5 w-full bg-slate-200" />
      </span>
      {line.devices.map((d) => {
        const col = cols.findIndex((c) => c.order === d.order);
        return (
          <Tile
            key={d.code}
            device={d}
            selected={selected === d.code}
            onSelect={onSelect}
            style={{ gridRow: row, gridColumn: col + 2 }}
          />
        );
      })}
    </>
  );
}

// ── 고른 설비 자세히 ──

function TagRow({
  tag,
  first,
  points,
  fromMs,
  toMs,
  trendReady,
  stale,
}: {
  tag: PlantTagBody;
  /** 종류 묶음의 첫 줄 — 종류 이름은 첫 줄에만 쓴다 */
  first: boolean;
  points: [number, number][] | undefined;
  fromMs: number;
  toMs: number;
  trendReady: boolean;
  /** 지금 값이 멈춘 값(설비 가동 꺼짐 · 통신 끊김) — 흐리게 */
  stale: boolean;
}) {
  return (
    <tr
      data-testid="tag-row"
      data-kind={tag.kind}
      className={cn('h-[var(--tag-row)] align-middle', first ? 'border-t border-line' : '')}
    >
      <td className="py-[calc(var(--pad)*0.2)] pr-2">
        {first ? (
          <span className="flex items-center gap-1.5 text-note text-slate-700">
            <KindGlyph kind={tag.kind} className="text-slate-600" />
            {TAG_KIND_LABEL[tag.kind]}
          </span>
        ) : null}
      </td>
      <td className="truncate pr-2 text-slate-800" title={tag.code}>
        {tag.name}
      </td>
      <td className="pr-3 text-right whitespace-nowrap">
        <b
          data-testid="tag-value"
          className={cn('font-semibold tabular-nums', stale ? 'text-slate-400' : 'text-slate-900')}
        >
          {valueText(tag)}
        </b>
        {tag.unit ? <span className="ml-1 text-foot text-slate-500">{tag.unit}</span> : null}
      </td>
      <td className="pr-2 text-note text-slate-600 tabular-nums">{tag.dataType}</td>
      <td className="pr-3 text-note text-slate-600 tabular-nums">{periodText(tag.scanRateMs)}</td>
      <td className="py-[calc(var(--pad)*0.2)]">
        <div className="h-[var(--spark-h)]">
          {trendReady ? (
            <Sparkline
              points={points ?? []}
              fromMs={fromMs}
              toMs={toMs}
              step={tag.kind === 'STATE'}
              gapMs={gapLimitMs(tag.scanRateMs)}
              unit={tag.unit}
              label={`${tag.name} 최근 10분`}
            />
          ) : (
            <div className="h-full rounded bg-slate-100 motion-safe:animate-pulse" />
          )}
        </div>
      </td>
    </tr>
  );
}

function ColHead({
  children,
  store,
  className,
}: {
  children: ReactNode;
  store?: StoreKey;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cn(
        'sticky top-0 z-20 bg-surface pb-1 text-left text-foot font-normal text-slate-500',
        className,
      )}
    >
      <span className="inline-flex items-center gap-1">
        {store ? <StoreDot store={store} /> : null}
        {children}
      </span>
    </th>
  );
}

/** 목록 줄 높이 — 작은 선 높이(화면 크기 따라 22 → 52px) + 위아래 여백. 빈 자리 줄도 같은 높이라 칸 높이가 설비마다 같다 */
const TAG_ROW_VARS = {
  '--spark-h': 'clamp(22px, calc(22px + 30 * var(--fs)), 52px)',
  '--tag-row': 'calc(var(--spark-h) + var(--pad) * 0.4)',
} as CSSProperties;

function DeviceDetail({
  device,
  lineName,
  power,
  slots,
}: {
  device: PlantDeviceBody;
  lineName: string;
  power: boolean;
  /** 목록 자리 수(tagSlots) — 태그가 이보다 적으면 남는 자리는 빈 줄 */
  slots: number;
}) {
  const note = staleNote(power, device.state);
  const tagIds = useMemo(() => device.tags.map((t) => t.tagId), [device.tags]);
  const trend = useDeviceTrend(device.deviceId, tagIds);
  const v = STATE_VIEW[device.state];
  const rows = tagsByKind(device.tags);
  const toMs = trend.data?.toMs ?? Date.now();
  return (
    <Panel label="고른 설비 자세히" className="fit:min-h-0" bodyClassName="gap-[calc(var(--gap)*0.5)]">
      <div
        data-testid="device-detail"
        data-device={device.code}
        className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1"
      >
        <StateGlyph state={device.state} className="text-head" />
        <h3 className="text-head font-semibold text-slate-900">
          {lineName} · {device.processName}
        </h3>
        <span className="text-note text-slate-500">{device.code}</span>
        <span data-testid="detail-state" className="text-note font-semibold" style={{ color: v.ink }}>
          {v.label}
        </span>
        <span className="text-note text-slate-600">
          태그 {device.tags.length}개 · 초당 {ppsText(device.pointsPerSec)}개
        </span>
        {note ? (
          <span data-testid="stale-note" className="text-note text-slate-500">
            {note}
          </span>
        ) : null}
        <ul
          data-testid="hmi-sources"
          aria-label="출처"
          className="flex flex-wrap items-center gap-x-3 gap-y-1 text-foot text-slate-600 fit:ml-auto"
        >
          {HMI_SOURCES.map((s) => (
            <li key={s.store} data-store={s.store} className="inline-flex items-center gap-1">
              <StoreDot store={s.store} />
              {s.what}
              <b className="font-semibold text-slate-800">{STORE[s.store].label}</b>
            </li>
          ))}
        </ul>
      </div>
      <ScrollList label="태그 목록">
        <table className="w-full table-fixed border-collapse text-body" style={TAG_ROW_VARS}>
          <colgroup>
            <col className="w-[6.5em]" />
            <col className="w-[9em]" />
            <col className="w-[9em]" />
            <col className="w-[6em]" />
            <col className="w-[4em]" />
            <col />
          </colgroup>
          <thead>
            <tr>
              <ColHead>종류</ColHead>
              <ColHead store="pg">이름</ColHead>
              <ColHead store="redis" className="pr-3 text-right [&>span]:justify-end">
                지금 값
              </ColHead>
              <ColHead store="pg">형식</ColHead>
              <ColHead store="pg">주기</ColHead>
              <ColHead store="ch">최근 10분</ColHead>
            </tr>
          </thead>
          <tbody>
            {rows.map((t, i) => (
              <TagRow
                key={t.tagId}
                tag={t}
                first={i === 0 || rows[i - 1]?.kind !== t.kind}
                points={trend.data?.byTag.get(t.tagId)}
                fromMs={toMs - TREND_WINDOW_MS}
                toMs={toMs}
                trendReady={trend.data !== undefined || trend.isError}
                stale={note !== null}
              />
            ))}
            {/* 빈 자리 — 태그가 자리 수보다 적은 설비도 목록 높이가 같게(남는 줄 수 × 줄 높이 한 줄) */}
            {slots > rows.length ? (
              <tr style={{ height: `calc(var(--tag-row) * ${slots - rows.length})` }}>
                <td colSpan={6} />
              </tr>
            ) : null}
          </tbody>
        </table>
      </ScrollList>
    </Panel>
  );
}

// ── 화면 ──

function Skeleton() {
  return (
    <>
      <div className="h-24 rounded-lg bg-slate-100 motion-safe:animate-pulse fit:h-auto fit:min-h-0" />
      <div className="h-48 rounded-lg bg-slate-100 motion-safe:animate-pulse" />
    </>
  );
}

export function HmiScreen() {
  const q = usePlantOverview();
  const ov = q.data;
  const [picked, setPicked] = useState<string | null>(null);
  const devices = useMemo(() => (ov ? allDevices(ov) : []), [ov]);
  const slots = useMemo(() => tagSlots(devices), [devices]);
  const device = devices.find((d) => d.code === picked) ?? devices[0] ?? null;
  const lineName = device ? (ov?.lines.find((l) => l.code === device.lineCode)?.name ?? device.lineCode) : '';
  return (
    <Screen
      id="hmi"
      title={HMI_TITLE}
      lead={HMI_LEAD}
      aside={
        <>
          <PlantPowerSwitch />
          <PurgeButton />
        </>
      }
      foot={<Footnote tip={HMI_FOOT_TIP}>{HMI_FOOT}</Footnote>}
      bodyClassName="fit:grid fit:grid-rows-[auto_minmax(45%,1fr)_minmax(0,auto)]"
    >
      <Summary ov={ov} />
      {ov ? (
        <>
          <LineBoard ov={ov} failed={q.isError} selected={device?.code ?? null} onSelect={setPicked} />
          {device ? (
            <DeviceDetail device={device} lineName={lineName} power={ov.power} slots={slots} />
          ) : (
            <Panel label="고른 설비 자세히">
              <p className="text-body text-slate-500">카드 라인 설비가 없어요</p>
            </Panel>
          )}
        </>
      ) : q.isError ? (
        <Panel label="라인 판" className="fit:row-span-2">
          <Notice
            testId="overview-failed"
            icon={<UiIcon name="warn" className="size-[1em] text-slate-500" />}
          >
            {OVERVIEW_FAILED_TEXT}
          </Notice>
        </Panel>
      ) : (
        <Skeleton />
      )}
    </Screen>
  );
}
