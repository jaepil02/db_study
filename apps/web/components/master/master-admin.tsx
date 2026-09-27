'use client';
// ADM-MASTER — 정본 docs/08_screen/06_master_admin.md (요소 11 · 상태 4행 · 쓰기 뒤 체인과 화면)
// 좌측 트리(사이트 → 라인 → 설비) · 우측 상세 탭 3(설비 정보 · 접속 설정 · 태그). 삭제 버튼 · 태그 재활성화 버튼은 없다.
// 쓰기는 응답을 받은 뒤에만 화면을 바꾼다(낙관적 갱신 없음) · 쓴 탭은 해당 쿼리를 로컬 무효화한다.
// 쓰기는 명령 경로(08_screen/01 §업무 쓰기 응답) — 폼마다 useMasterWrite 하나 · 202면 폼 잠금 · 명령 조회로 결말.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ApiError } from '../../lib/api';
import { masterKeys } from '../../lib/cache-signal';
import { settle, submitLabel } from '../../lib/commands';
import { errorText } from '../../lib/error-display';
import { changedFields, isLoopbackHost, masterWrite } from '../../lib/master-api';
import {
  DATA_TYPES,
  DeviceObject,
  type DeviceObjectBody,
  type ModbusConfigBody,
  type SiteObjectBody,
  TagObject,
} from '../../lib/shared';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';
import { Band } from '../ui/band';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { CommandNotice } from './command-notice';
import { Button, Field, Select, TextInput } from './field';
import {
  useDevices,
  useLines,
  useLocalInvalidate,
  useMasterWrite,
  useModbus,
  useSites,
  useTag,
  useTags,
} from './queries';
import { AFTER_WRITE_NOTE, TagEditor } from './tag-editor';

export function MasterAdmin({ deviceId, tagId }: { deviceId?: number; tagId?: number }) {
  // 태그 딥링크 — 태그 단건(비활성이어도 200)으로 설비를 찾는다
  const tagQ = useTag(tagId ?? null);
  const selectedDevice = deviceId ?? tagQ.data?.deviceId ?? null;
  const [creating, setCreating] = useState<'site' | 'line' | 'device' | null>(null);
  return (
    <div className="grid grid-cols-[18rem_1fr] gap-4">
      <Card>
        <CardHeader>
          <CardTitle>사이트 · 라인 · 설비</CardTitle>
          <div className="flex gap-1">
            <Button variant="outline" onClick={() => setCreating('site')}>
              + 사이트
            </Button>
            <Button variant="outline" onClick={() => setCreating('line')}>
              + 라인
            </Button>
            <Button variant="outline" onClick={() => setCreating('device')}>
              + 설비
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tree selected={selectedDevice} />
        </CardContent>
      </Card>
      <div className="flex flex-col gap-4">
        {creating ? <CreateForm kind={creating} onClose={() => setCreating(null)} /> : null}
        {tagQ.isError ? <Band>{errorText(tagQ.error)}</Band> : null}
        {selectedDevice !== null ? (
          <DeviceDetail key={selectedDevice} deviceId={selectedDevice} focusTagId={tagId ?? null} />
        ) : (
          <Card>
            <CardContent className="text-sm text-slate-500">트리에서 설비를 고른다</CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Tree({ selected }: { selected: number | null }) {
  const sites = useSites();
  if (sites.isPending) return <div className="h-24 animate-pulse rounded bg-slate-100" />;
  if (sites.isError) return <Band>{errorText(sites.error)}</Band>;
  if (sites.data.length === 0)
    return <p className="text-sm text-slate-500">등록된 사이트가 없다 — 사이트를 등록한다</p>;
  return (
    <ul className="flex flex-col gap-2 text-sm">
      {sites.data.map((s) => (
        <SiteNode key={s.siteId} site={s} selected={selected} />
      ))}
    </ul>
  );
}

function SiteNode({ site, selected }: { site: SiteObjectBody; selected: number | null }) {
  const [open, setOpen] = useState(true);
  const lines = useLines(site.siteId);
  const devices = useDevices(open ? site.siteId : null, true);
  return (
    <li>
      <button type="button" className="font-medium" onClick={() => setOpen(!open)}>
        {open ? '▾' : '▸'} {site.siteName} <span className="text-xs text-slate-400">{site.siteCode}</span>
      </button>
      {open ? (
        <ul className="ml-4 mt-1 flex flex-col gap-1">
          {(lines.data ?? []).map((l) => (
            <li key={l.lineId}>
              <span className="text-slate-700">▾ {l.lineName}</span>
              <ul className="ml-4">
                {(devices.data ?? [])
                  .filter((d) => d.lineId === l.lineId)
                  .map((d) => (
                    <li key={d.deviceId}>
                      <Link
                        href={`/admin/master/devices/${d.deviceId}`}
                        className={cn(
                          'hover:underline',
                          !d.isActive && 'text-slate-400',
                          selected === d.deviceId && 'font-semibold text-slate-900',
                        )}
                      >
                        {d.isActive ? '●' : '○'} {d.deviceName}
                        {d.isActive ? '' : '(비활성)'}
                      </Link>
                    </li>
                  ))}
              </ul>
            </li>
          ))}
          {lines.isError || devices.isError ? <Band>{errorText(lines.error ?? devices.error)}</Band> : null}
        </ul>
      ) : null}
    </li>
  );
}

type Tab = 'info' | 'modbus' | 'tags';

function DeviceDetail({ deviceId, focusTagId }: { deviceId: number; focusTagId: number | null }) {
  const [tab, setTab] = useState<Tab>(focusTagId ? 'tags' : 'info');
  const [note, setNote] = useState<string | null>(null);
  return (
    <Card>
      <CardHeader>
        <div className="flex gap-2">
          {(
            [
              ['info', '설비 정보'],
              ['modbus', '접속 설정'],
              ['tags', '태그'],
            ] as const
          ).map(([k, label]) => (
            <Button key={k} variant={tab === k ? 'default' : 'outline'} onClick={() => setTab(k)}>
              {label}
            </Button>
          ))}
          <span className="ml-auto text-xs text-slate-400">device_id {deviceId}</span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {note ? <Band tone="info">{note}</Band> : null}
        {tab === 'info' ? <DeviceInfo deviceId={deviceId} onNote={setNote} /> : null}
        {tab === 'modbus' ? <ModbusTab deviceId={deviceId} onNote={setNote} /> : null}
        {tab === 'tags' ? <TagsTab deviceId={deviceId} focusTagId={focusTagId} onNote={setNote} /> : null}
      </CardContent>
    </Card>
  );
}

/** 설비 정보 — 설비 목록에서 찾는다(단건 표면이 없다) · 사이트를 모르면 라인 → 사이트 역참조 */
function DeviceInfo({ deviceId, onNote }: { deviceId: number; onNote: (n: string) => void }) {
  const sites = useSites();
  const [found, setFound] = useState<{ device: DeviceObjectBody; siteId: number } | null>(null);
  return (
    <>
      {(sites.data ?? []).map((s) => (
        <DeviceFinder key={s.siteId} siteId={s.siteId} deviceId={deviceId} onFound={setFound} />
      ))}
      {found ? (
        <DeviceForm key={JSON.stringify(found.device)} {...found} onNote={onNote} />
      ) : (
        <div className="h-16 animate-pulse rounded bg-slate-100" />
      )}
    </>
  );
}

function DeviceFinder({
  siteId,
  deviceId,
  onFound,
}: {
  siteId: number;
  deviceId: number;
  onFound: (f: { device: DeviceObjectBody; siteId: number }) => void;
}) {
  const devices = useDevices(siteId, true);
  const d = devices.data?.find((x) => x.deviceId === deviceId);
  const key = d ? JSON.stringify(d) : null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: key가 d의 내용 비교 키다
  useEffect(() => {
    if (d) onFound({ device: d, siteId });
  }, [key, siteId]);
  return null;
}

function DeviceForm({
  device,
  siteId,
  onNote,
}: {
  device: DeviceObjectBody;
  siteId: number;
  onNote: (n: string) => void;
}) {
  const [f, setF] = useState({
    deviceCode: device.deviceCode,
    deviceName: device.deviceName,
    vendor: device.vendor ?? '',
    model: device.model ?? '',
  });
  const [err, setErr] = useState<ApiError | null>(null);
  const invalidate = useLocalInvalidate();
  const w = useMasterWrite(`device:${device.deviceId}`);
  const write = (patch: Record<string, unknown>) => {
    setErr(null);
    void w.run(masterWrite('PATCH', `devices/${device.deviceId}`, patch), (o) =>
      settle(
        o,
        (body) => {
          DeviceObject.parse(body);
          invalidate(['master', 'devices', siteId]);
          onNote('저장했다 — 다른 화면의 설비 선택기는 신호(cache:devlist)로 갱신된다');
        },
        setErr,
      ),
    );
  };
  const diff = changedFields(
    {
      deviceCode: device.deviceCode,
      deviceName: device.deviceName,
      vendor: device.vendor,
      model: device.model,
    },
    { ...f, vendor: f.vendor || null, model: f.model || null },
  );
  return (
    <div className="flex flex-col gap-2">
      <CommandNotice writer={w} />
      {err && err.code !== 'common.duplicate_key' ? <Band>{errorText(err)}</Band> : null}
      <div className="grid grid-cols-4 gap-2">
        <Field label="설비 코드" error={err?.code === 'common.duplicate_key' ? '이미 있는 값' : null}>
          <TextInput value={f.deviceCode} onChange={(e) => setF({ ...f, deviceCode: e.target.value })} />
        </Field>
        <Field label="설비명">
          <TextInput value={f.deviceName} onChange={(e) => setF({ ...f, deviceName: e.target.value })} />
        </Field>
        <Field label="제조사">
          <TextInput value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })} />
        </Field>
        <Field label="모델">
          <TextInput value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} />
        </Field>
      </div>
      <div className="flex gap-2">
        <Button disabled={w.locked || Object.keys(diff).length === 0} onClick={() => write(diff)}>
          {submitLabel(w.state, '저장')}
        </Button>
        <Button
          variant={device.isActive ? 'danger' : 'outline'}
          disabled={w.locked}
          onClick={() => write({ isActive: !device.isActive })}
        >
          {device.isActive ? '사용 중지' : '재활성화'}
        </Button>
        <Link className="self-center text-xs text-blue-700 underline" href={`/realtime/${device.deviceId}`}>
          실시간 보기
        </Link>
      </div>
    </div>
  );
}

const MODBUS_FIELDS: [keyof ModbusConfigBody, string][] = [
  ['host', 'host'],
  ['port', 'port'],
  ['unitId', 'unitId'],
  ['timeoutMs', 'timeoutMs'],
  ['retryCount', 'retryCount'],
  ['maxRegsPerRequest', 'maxRegsPerRequest'],
];

function ModbusTab({ deviceId, onNote }: { deviceId: number; onNote: (n: string) => void }) {
  const q = useModbus(deviceId);
  if (q.isPending) return <div className="h-16 animate-pulse rounded bg-slate-100" />;
  if (q.isError) return <Band>{errorText(q.error)}</Band>;
  return <ModbusForm key={JSON.stringify(q.data)} deviceId={deviceId} cfg={q.data} onNote={onNote} />;
}

function ModbusForm({
  deviceId,
  cfg,
  onNote,
}: {
  deviceId: number;
  cfg: ModbusConfigBody;
  onNote: (n: string) => void;
}) {
  const [f, setF] = useState<Record<string, string>>(
    Object.fromEntries(MODBUS_FIELDS.map(([k]) => [k, String(cfg[k])])),
  );
  const [err, setErr] = useState<ApiError | null>(null);
  const invalidate = useLocalInvalidate();
  const w = useMasterWrite(`modbus:${deviceId}`);
  const save = () => {
    setErr(null);
    const body = Object.fromEntries(MODBUS_FIELDS.map(([k]) => [k, k === 'host' ? f[k] : Number(f[k])]));
    void w.run(masterWrite('PUT', `devices/${deviceId}/modbus-config`, body), (o) =>
      settle(
        o,
        () => {
          invalidate(masterKeys.modbus(deviceId));
          onNote('교체했다 — Collector가 다음 사이클에 다시 읽는다');
        },
        setErr,
      ),
    );
  };
  return (
    <div className="flex flex-col gap-2">
      {isLoopbackHost(cfg.host) ? (
        <Badge variant="warning" className="self-start">
          SIMULATED — 루프백 host · 정상 값은 품질 9로 적재된다
        </Badge>
      ) : null}
      <CommandNotice writer={w} />
      {err ? <Band>{errorText(err)}</Band> : null}
      <div className="grid grid-cols-3 gap-2">
        {MODBUS_FIELDS.map(([k, label]) => (
          <Field key={k} label={label}>
            <TextInput value={f[k] ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
          </Field>
        ))}
      </div>
      <Button className="self-start" disabled={w.locked} onClick={save}>
        {submitLabel(w.state, '교체 저장')}
      </Button>
    </div>
  );
}

function TagsTab({
  deviceId,
  focusTagId,
  onNote,
}: {
  deviceId: number;
  focusTagId: number | null;
  onNote: (n: string) => void;
}) {
  const [inactive, setInactive] = useState(false);
  const [editing, setEditing] = useState<number | null>(focusTagId);
  const [adding, setAdding] = useState(false);
  const tags = useTags(deviceId, inactive || focusTagId !== null);
  if (tags.isPending) return <div className="h-24 animate-pulse rounded bg-slate-100" />;
  if (tags.isError) return <Band>{errorText(tags.error)}</Band>;
  const rows = tags.data;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 text-sm">
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={inactive} onChange={(e) => setInactive(e.target.checked)} /> 비활성
          포함
        </label>
        <Button variant="outline" className="ml-auto" onClick={() => setAdding(!adding)}>
          + 태그
        </Button>
      </div>
      {adding ? (
        <TagCreateForm
          deviceId={deviceId}
          onDone={(id) => {
            setAdding(false);
            setEditing(id);
            onNote(AFTER_WRITE_NOTE);
          }}
        />
      ) : null}
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">
          {inactive
            ? '태그가 없다 · 수집 대상이 없다'
            : '활성 태그가 없다 — 비활성 태그만 있을 수 있다(비활성 포함을 켠다)'}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>코드</TableHead>
              <TableHead>이름</TableHead>
              <TableHead>단위</TableHead>
              <TableHead>변환식(scale · offset)</TableHead>
              <TableHead>상태</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((t) => (
              <TableRow key={t.tagId} className={cn(!t.isActive && 'text-slate-400')}>
                <TableCell>{t.tagCode}</TableCell>
                <TableCell>{t.tagName}</TableCell>
                <TableCell>{t.unit}</TableCell>
                <TableCell>
                  {t.scale} · {t.offsetValue}
                </TableCell>
                <TableCell>{t.isActive ? '활성' : '비활성'}</TableCell>
                <TableCell>
                  <Button variant="outline" onClick={() => setEditing(editing === t.tagId ? null : t.tagId)}>
                    편집
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {editing !== null && rows.find((t) => t.tagId === editing) ? (
        <TagEditor
          key={JSON.stringify(rows.find((t) => t.tagId === editing))}
          tag={rows.find((t) => t.tagId === editing) as (typeof rows)[number]}
          onDone={onNote}
        />
      ) : null}
    </div>
  );
}

function TagCreateForm({ deviceId, onDone }: { deviceId: number; onDone: (tagId: number) => void }) {
  const [f, setF] = useState({
    tagCode: '',
    tagName: '',
    functionCode: '3',
    address: '0',
    dataType: 'FLOAT32',
    wordOrder: 'ABCD',
    scale: '1',
    offsetValue: '0',
    unit: '',
    scanRateMs: '1000',
  });
  const [err, setErr] = useState<ApiError | null>(null);
  const invalidate = useLocalInvalidate();
  const w = useMasterWrite(`tag-create:${deviceId}`);
  const single = ['UINT16', 'INT16', 'BOOL'].includes(f.dataType);
  const submit = () => {
    setErr(null);
    void w.run(
      masterWrite('POST', 'tags', {
        deviceId,
        tagCode: f.tagCode,
        tagName: f.tagName,
        functionCode: Number(f.functionCode),
        address: Number(f.address),
        dataType: f.dataType,
        wordOrder: single ? null : f.wordOrder,
        scale: Number(f.scale),
        offsetValue: Number(f.offsetValue),
        unit: f.unit,
        scanRateMs: Number(f.scanRateMs),
      }),
      (o) =>
        settle(
          o,
          (body) => {
            const t = TagObject.parse(body);
            invalidate(['master', 'tags']);
            onDone(t.tagId);
          },
          setErr,
        ),
    );
  };
  const input = (k: keyof typeof f, label: string) => (
    <Field
      label={label}
      error={k === 'tagCode' && err?.code === 'common.duplicate_key' ? '이미 있는 값' : null}
    >
      <TextInput value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
    </Field>
  );
  return (
    <div className="flex flex-col gap-2 rounded border border-slate-200 p-3">
      <CommandNotice writer={w} />
      {err && err.code !== 'common.duplicate_key' ? <Band tone="warning">{errorText(err)}</Band> : null}
      <div className="grid grid-cols-5 gap-2">
        {input('tagCode', '태그 코드')}
        {input('tagName', '태그명')}
        {input('functionCode', 'Function Code')}
        {input('address', '주소')}
        <Field label="데이터 타입">
          <Select value={f.dataType} onChange={(e) => setF({ ...f, dataType: e.target.value })}>
            {DATA_TYPES.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </Select>
        </Field>
        {single ? <div /> : input('wordOrder', '워드 순서')}
        {input('scale', 'scale')}
        {input('offsetValue', 'offset')}
        {input('unit', '단위')}
        {input('scanRateMs', '수집 주기(ms)')}
      </div>
      <Button className="self-start" disabled={w.locked} onClick={submit}>
        {submitLabel(w.state, '등록')}
      </Button>
    </div>
  );
}

/** 사이트 · 라인 · 설비 등록 — 설비는 접속 설정 6필드를 같은 폼에서 받는다(한 트랜잭션) */
function CreateForm({ kind, onClose }: { kind: 'site' | 'line' | 'device'; onClose: () => void }) {
  const router = useRouter();
  const sites = useSites();
  const [siteId, setSiteId] = useState<number | null>(null);
  const sid = siteId ?? sites.data?.[0]?.siteId ?? null;
  const lines = useLines(sid);
  const [f, setF] = useState<Record<string, string>>({
    code: '',
    name: '',
    lineId: '',
    host: '127.0.0.1',
    port: '5020',
    unitId: '1',
    timeoutMs: '1000',
    retryCount: '1',
    maxRegsPerRequest: '125',
  });
  const [err, setErr] = useState<ApiError | null>(null);
  const invalidate = useLocalInvalidate();
  const input = (k: string, label: string) => (
    <Field
      key={k}
      label={label}
      error={k === 'code' && err?.code === 'common.duplicate_key' ? '이미 있는 값' : null}
    >
      <TextInput value={f[k] ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
    </Field>
  );
  const w = useMasterWrite(`create:${kind}`);
  const submit = () => {
    setErr(null);
    const req =
      kind === 'site'
        ? masterWrite('POST', 'sites', { siteCode: f.code, siteName: f.name })
        : kind === 'line'
          ? masterWrite('POST', 'lines', { siteId: sid, lineCode: f.code, lineName: f.name })
          : masterWrite('POST', 'devices', {
              lineId: Number(f.lineId || lines.data?.[0]?.lineId),
              deviceCode: f.code,
              deviceName: f.name,
              modbusConfig: {
                host: f.host,
                port: Number(f.port),
                unitId: Number(f.unitId),
                timeoutMs: Number(f.timeoutMs),
                retryCount: Number(f.retryCount),
                maxRegsPerRequest: Number(f.maxRegsPerRequest),
              },
            });
    void w.run(req, (o) =>
      settle(
        o,
        (body) => {
          if (kind === 'site') invalidate(masterKeys.sites());
          else if (kind === 'line') invalidate(['master', 'lines']);
          else {
            const d = DeviceObject.parse(body);
            invalidate(['master', 'devices', sid]);
            router.push(`/admin/master/devices/${d.deviceId}`);
          }
          onClose();
        },
        setErr,
      ),
    );
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {kind === 'site'
            ? '사이트 등록(시간대 Asia/Seoul 고정)'
            : kind === 'line'
              ? '라인 등록'
              : '설비 등록'}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <CommandNotice writer={w} />
        {err && err.code !== 'common.duplicate_key' ? <Band tone="warning">{errorText(err)}</Band> : null}
        <div className="grid grid-cols-3 gap-2">
          {kind !== 'site' ? (
            <Field label="사이트">
              <Select value={sid ?? ''} onChange={(e) => setSiteId(Number(e.target.value))}>
                {(sites.data ?? []).map((s) => (
                  <option key={s.siteId} value={s.siteId}>
                    {s.siteName}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          {kind === 'device' ? (
            <Field label="라인">
              <Select value={f.lineId} onChange={(e) => setF({ ...f, lineId: e.target.value })}>
                {(lines.data ?? []).map((l) => (
                  <option key={l.lineId} value={l.lineId}>
                    {l.lineName}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          {input('code', '코드')}
          {input('name', '이름')}
          {kind === 'device' ? MODBUS_FIELDS.map(([k, label]) => input(k, `접속 ${label}`)) : null}
        </div>
        <div className="flex gap-2">
          <Button disabled={w.locked} onClick={submit}>
            {submitLabel(w.state, '등록')}
          </Button>
          <Button variant="outline" onClick={onClose}>
            닫기
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
