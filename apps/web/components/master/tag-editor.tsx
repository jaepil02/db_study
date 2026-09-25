'use client';
// 태그 편집 폼 · 새 태그 발급 다이얼로그 — 정본 docs/08_screen/06_master_admin.md §태그 편집 필드 · §새 태그 발급 다이얼로그
// 세 갈래: 수정 가능 11 편집 · 스케일 2 읽기 전용(옆에 발급 링크) · 불변 3 표시만. 저장은 바뀐 필드만 PATCH한다.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError } from '../../lib/api';
import { masterKeys } from '../../lib/cache-signal';
import { errorText } from '../../lib/error-display';
import { bffWrite, changedFields, MODBUS_MAPPING_FIELDS } from '../../lib/master-api';
import {
  DATA_TYPES,
  FUNCTION_CODES,
  type TagObjectBody,
  TagReissueResponse,
  WORD_ORDERS,
} from '../../lib/shared';
import { Band } from '../ui/band';
import { Button, Field, numOrNull, Select, TextInput } from './field';
import { useLocalInvalidate } from './queries';

type Editable = Pick<
  TagObjectBody,
  | 'tagCode'
  | 'tagName'
  | 'unit'
  | 'deadband'
  | 'scanRateMs'
  | 'rangeMin'
  | 'rangeMax'
  | 'functionCode'
  | 'address'
  | 'dataType'
  | 'wordOrder'
>;

const editableOf = (t: TagObjectBody): Editable => ({
  tagCode: t.tagCode,
  tagName: t.tagName,
  unit: t.unit,
  deadband: t.deadband,
  scanRateMs: t.scanRateMs,
  rangeMin: t.rangeMin,
  rangeMax: t.rangeMax,
  functionCode: t.functionCode,
  address: t.address,
  dataType: t.dataType,
  wordOrder: t.wordOrder,
});

export const AFTER_WRITE_NOTE =
  '다른 화면 반영 — 트렌드 태그명은 Dictionary 재적재 뒤 · 캐시된 조회 결과는 TTL까지 옛 이름';

export function TagEditor({ tag, onDone }: { tag: TagObjectBody; onDone: (note: string) => void }) {
  const [form, setForm] = useState<Editable>(() => editableOf(tag));
  const [err, setErr] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [reissue, setReissue] = useState(false);
  const invalidate = useLocalInvalidate();
  const set = <K extends keyof Editable>(k: K, v: Editable[K]) => setForm((f) => ({ ...f, [k]: v }));
  const diff = changedFields(editableOf(tag), form);
  const mappingChanged = MODBUS_MAPPING_FIELDS.some((f) => f in diff);
  const dupField =
    err?.code === 'common.duplicate_key' ? (err.details?.field as string | undefined) : undefined;

  const save = async () => {
    if (Object.keys(diff).length === 0) return onDone('변경 없음');
    if (
      mappingChanged &&
      !window.confirm('이 변경은 같은 tag_id의 값 원천(Modbus 매핑)을 바꾼다 — 저장할까?')
    )
      return;
    setBusy(true);
    setErr(null);
    try {
      await bffWrite('PATCH', `tags/${tag.tagId}`, diff);
      invalidate(['master', 'tags'], masterKeys.tag(tag.tagId));
      onDone(AFTER_WRITE_NOTE);
    } catch (e) {
      const ae = e instanceof ApiError ? e : new ApiError(0, null, String(e));
      setErr(ae);
      // 스케일 409 — 편집 내용을 버리지 않고 발급 다이얼로그를 연다(폼이 변환식을 읽기 전용으로 두므로 딥링크 · 수동 호출에서만 온다)
      if (ae.code === 'master.scale_change_forbidden') setReissue(true);
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async () => {
    if (
      !window.confirm(
        `${tag.tagCode}를 비활성화한다 — 되돌리는 버튼이 없다(되살릴 태그는 새 코드로 등록한다)`,
      )
    )
      return;
    setBusy(true);
    setErr(null);
    try {
      await bffWrite('POST', `tags/${tag.tagId}/deactivate`, {});
      invalidate(['master', 'tags'], masterKeys.tag(tag.tagId));
      onDone(AFTER_WRITE_NOTE);
    } catch (e) {
      setErr(e instanceof ApiError ? e : new ApiError(0, null, String(e)));
    } finally {
      setBusy(false);
    }
  };

  const multiWord = !['UINT16', 'INT16', 'BOOL'].includes(form.dataType);
  return (
    <div className="flex flex-col gap-3 rounded border border-slate-200 bg-slate-50 p-3">
      {err && err.code !== 'common.duplicate_key' ? (
        <Band tone={err.status === 503 ? 'danger' : 'warning'}>{errorText(err)}</Band>
      ) : null}
      <div className="grid grid-cols-4 gap-2">
        <Field label="태그 코드" error={dupField === 'tagCode' ? '이미 있는 값' : null}>
          <TextInput value={form.tagCode} onChange={(e) => set('tagCode', e.target.value)} />
        </Field>
        <Field label="태그명">
          <TextInput value={form.tagName} onChange={(e) => set('tagName', e.target.value)} />
        </Field>
        <Field label="단위">
          <TextInput value={form.unit} onChange={(e) => set('unit', e.target.value)} />
        </Field>
        <Field label="데드밴드">
          <TextInput
            type="number"
            value={form.deadband}
            onChange={(e) => set('deadband', Number(e.target.value))}
          />
        </Field>
        <Field label="수집 주기(ms)">
          <TextInput
            type="number"
            value={form.scanRateMs}
            onChange={(e) => set('scanRateMs', Number(e.target.value))}
          />
        </Field>
        <Field label="범위 최소">
          <TextInput
            type="number"
            value={form.rangeMin ?? ''}
            onChange={(e) => set('rangeMin', numOrNull(e.target.value))}
          />
        </Field>
        <Field label="범위 최대">
          <TextInput
            type="number"
            value={form.rangeMax ?? ''}
            onChange={(e) => set('rangeMax', numOrNull(e.target.value))}
          />
        </Field>
        <div />
        <Field label="Function Code">
          <Select value={form.functionCode} onChange={(e) => set('functionCode', Number(e.target.value))}>
            {FUNCTION_CODES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="주소">
          <TextInput
            type="number"
            value={form.address}
            onChange={(e) => set('address', Number(e.target.value))}
          />
        </Field>
        <Field label="데이터 타입">
          <Select
            value={form.dataType}
            onChange={(e) => {
              const dt = e.target.value as Editable['dataType'];
              set('dataType', dt);
              if (['UINT16', 'INT16', 'BOOL'].includes(dt)) set('wordOrder', null);
              else if (form.wordOrder === null) set('wordOrder', 'ABCD');
            }}
          >
            {DATA_TYPES.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </Select>
        </Field>
        <Field label="워드 순서">
          <Select
            value={form.wordOrder ?? ''}
            disabled={!multiWord}
            onChange={(e) => set('wordOrder', e.target.value as Editable['wordOrder'])}
          >
            {!multiWord ? <option value="">해당 없음</option> : null}
            {multiWord ? WORD_ORDERS.map((w) => <option key={w}>{w}</option>) : null}
          </Select>
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
        <span>
          변환식(읽기 전용) scale {tag.scale} · offset {tag.offsetValue}
          {tag.isActive ? (
            <button type="button" className="ml-2 text-blue-700 underline" onClick={() => setReissue(true)}>
              새 태그 발급
            </button>
          ) : null}
        </span>
        <span>
          불변 — tag_id {tag.tagId} · device_id {tag.deviceId} · {tag.isActive ? '활성' : '비활성'}
        </span>
      </div>
      {mappingChanged ? (
        <Band tone="warning">
          이 변경은 같은 tag_id의 값 원천을 바꾼다 — Modbus 매핑 변경은 현재 허용된다(판정 대기)
        </Band>
      ) : null}
      <div className="flex gap-2">
        <Button onClick={save} disabled={busy}>
          저장
        </Button>
        {tag.isActive ? (
          <Button variant="danger" onClick={deactivate} disabled={busy}>
            비활성화
          </Button>
        ) : null}
      </div>
      {reissue && tag.isActive ? (
        <ReissueDialog tag={{ ...tag, ...form }} source={tag} onClose={() => setReissue(false)} />
      ) : null}
    </div>
  );
}

/** 새 태그 발급 — 변환식 변경은 새 tag_id로만. 성공하면 새 태그 편집 화면으로 · 이전 태그 과거 추이 링크 */
function ReissueDialog({
  tag,
  source,
  onClose,
}: {
  tag: TagObjectBody;
  source: TagObjectBody;
  onClose: () => void;
}) {
  const router = useRouter();
  const invalidate = useLocalInvalidate();
  const [newTagCode, setCode] = useState(`${source.tagCode}-N`);
  const [scale, setScale] = useState(String(tag.scale));
  const [offset, setOffset] = useState(String(tag.offsetValue));
  const [unit, setUnit] = useState(tag.unit);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ newTagId: number; oldTagId: number } | null>(null);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const body = TagReissueResponse.parse(
        await bffWrite('POST', `tags/${source.tagId}/reissue`, {
          newTagCode,
          scale: Number(scale),
          offsetValue: Number(offset),
          unit,
          ...(reason ? { reason } : {}),
        }),
      );
      invalidate(['master', 'tags'], masterKeys.tag(source.tagId));
      setDone({ newTagId: body.newTag.tagId, oldTagId: body.oldTagId });
    } catch (e) {
      const ae = e instanceof ApiError ? e : new ApiError(0, null, String(e));
      setErr(ae);
      // 경합으로 방금 비활성이 됐다 — 태그를 다시 읽는다
      if (ae.code === 'master.reissue_source_inactive')
        invalidate(masterKeys.tag(source.tagId), ['master', 'tags']);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="rounded border border-blue-200 bg-white p-3 text-sm"
      role="dialog"
      aria-label="새 태그 발급"
    >
      <div className="mb-2 font-medium">
        새 태그 발급 — {source.tagCode}({source.tagName} · {source.unit} · scale {source.scale} · offset{' '}
        {source.offsetValue})
      </div>
      {done ? (
        <div className="flex flex-col gap-2">
          <span>
            발급 완료 — 새 tag_id {done.newTagId} · 이전 tag_id {done.oldTagId}(비활성)
          </span>
          <div className="flex gap-3">
            <Button onClick={() => router.push(`/admin/master/tags/${done.newTagId}`)}>
              새 태그 편집으로
            </Button>
            <Link className="text-blue-700 underline" href={`/trend?tags=${done.oldTagId}&preset=7d`}>
              이전 태그의 과거 추이 보기
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {err && err.code !== 'common.duplicate_key' ? <Band tone="warning">{errorText(err)}</Band> : null}
          <div className="grid grid-cols-3 gap-2">
            <Field
              label="새 태그 코드(필수 · 이전 코드는 비활성 뒤에도 점유된다)"
              error={err?.code === 'common.duplicate_key' ? '이미 있는 값' : null}
            >
              <TextInput value={newTagCode} onChange={(e) => setCode(e.target.value)} />
            </Field>
            <Field label="scale">
              <TextInput type="number" value={scale} onChange={(e) => setScale(e.target.value)} />
            </Field>
            <Field label="offset">
              <TextInput type="number" value={offset} onChange={(e) => setOffset(e.target.value)} />
            </Field>
            <Field label="단위">
              <TextInput value={unit} onChange={(e) => setUnit(e.target.value)} />
            </Field>
            <Field label="사유">
              <TextInput value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
          </div>
          <ul className="list-disc pl-5 text-xs text-slate-600">
            <li>scale · offset 중 적어도 하나가 현재와 달라야 한다</li>
            <li>이전 태그는 비활성화된다 · 과거 행은 이전 tag_id로 남는다</li>
            <li>알람 규칙은 옮겨지지 않는다 — 새 태그에 규칙을 새로 만든다(ALM-RULES · S7)</li>
          </ul>
          <div className="flex gap-2">
            <Button onClick={submit} disabled={busy}>
              발급
            </Button>
            <Button variant="outline" onClick={onClose}>
              닫기
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
