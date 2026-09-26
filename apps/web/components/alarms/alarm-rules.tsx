'use client';
// ALM-RULES — 정본 docs/08_screen/05_alarm_console.md §ALM-RULES
// 요소 7: 규칙 목록 · 추가 · 편집 폼 · 비활성화 · 태그 선택기 · 판정 분석 차트 · 빈 버킷 주의 표지 · 원 시계열 보기.
// 삭제 버튼이 없다(REQ-ALM-01 — 끄는 수단은 사용 해제). 편집 모드에서 태그 · 조건은 읽기 전용이다(불변 — 바꾸려면 새 규칙 등록 후 옛 규칙 끄기).
// 인증 전(S7 ①)에는 조회 · 쓰기 · 분석 모두 무인증 — 역할로 패널을 숨기지 않는다.
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import {
  type AlarmRule,
  alarmErrorText,
  alarmKeys,
  CONDITION_TYPES,
  type ConditionType,
  conditionText,
  DEFAULT_EVAL_RANGE,
  EMPTY_RULE_FORM,
  EVAL_RANGES,
  type EvalRangeId,
  RULE_SAVED_NOTE,
  type RuleForm,
  type RuleFormErrors,
  ruleFormOf,
  rulePatchBody,
  SEVERITIES,
  serverFieldErrors,
  validateRuleForm,
} from '../../lib/alarms';
import { ApiError } from '../../lib/api';
import { errorText } from '../../lib/error-display';
import { Button, Field, Select, TextInput } from '../master/field';
import { useDevices, useSites, useTag, useTags } from '../master/queries';
import { Badge } from '../ui/badge';
import { Band } from '../ui/band';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { SeverityBadge } from './alarm-console';
import { EvalPanel } from './eval-panel';
import { createRule, patchRule, useAlarmInvalidate, useRules } from './queries';

export function AlarmRules({ ruleId }: { ruleId: number | null }) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const rules = useRules();
  const creating = ruleId === null && sp.get('new') === '1';
  const range: EvalRangeId = EVAL_RANGES.find((r) => r.id === sp.get('range'))?.id ?? DEFAULT_EVAL_RANGE;
  const setRange = (r: EvalRangeId) => router.replace(`${pathname}?range=${r}`);
  const selected = ruleId === null ? null : (rules.data?.find((r) => r.ruleId === ruleId) ?? null);
  const [note, setNote] = useState<string | null>(() =>
    sp.get('saved') === '1' && ruleId !== null ? `규칙 #${ruleId} 등록 — ${RULE_SAVED_NOTE}` : null,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold">알람 규칙</h1>
        <Link className="text-xs text-slate-500 underline" href="/alarms">
          알람 콘솔
        </Link>
      </div>
      {note ? <Band tone="info">{note}</Band> : null}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>규칙 목록</CardTitle>
            <Link
              className="rounded border border-slate-300 bg-white px-3 py-1 text-sm hover:bg-slate-50"
              href="/alarms/rules?new=1"
            >
              + 규칙 추가
            </Link>
          </CardHeader>
          <CardContent>
            <RuleList rules={rules} selectedId={ruleId} />
          </CardContent>
        </Card>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>
                {creating ? '규칙 추가' : selected ? `규칙 #${selected.ruleId} 편집` : '규칙 편집'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {creating ? (
                <RuleEditor rule={null} onSaved={(r) => router.push(`/alarms/rules/${r.ruleId}?saved=1`)} />
              ) : selected ? (
                <RuleEditor
                  key={selected.ruleId}
                  rule={selected}
                  onSaved={(r) => setNote(`규칙 #${r.ruleId} 저장 — ${RULE_SAVED_NOTE}`)}
                />
              ) : ruleId !== null && rules.isSuccess ? (
                <p className="text-sm text-slate-600">
                  대상이 없다 — 규칙 #{ruleId}가 목록에 없다.{' '}
                  <Link className="text-blue-700 underline" href="/alarms/rules">
                    목록으로
                  </Link>
                </p>
              ) : rules.isPending ? (
                <div className="h-40 animate-pulse rounded bg-slate-100" />
              ) : (
                <p className="text-sm text-slate-600">왼쪽에서 규칙을 고르거나 새 규칙을 추가한다.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>판정 분석</CardTitle>
            </CardHeader>
            <CardContent>
              <EvalPanel rule={selected} range={range} onRange={setRange} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function RuleList({ rules, selectedId }: { rules: ReturnType<typeof useRules>; selectedId: number | null }) {
  if (rules.isPending)
    return (
      <div className="flex flex-col gap-2" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-7 animate-pulse rounded bg-slate-100" />
        ))}
      </div>
    );
  return (
    <div className="flex flex-col gap-2">
      {rules.isError ? <Band tone="danger">{alarmErrorText(rules.error, errorText)}</Band> : null}
      {rules.isSuccess && rules.data.length === 0 ? (
        <p className="text-sm text-slate-600">
          규칙이 없다 · 여기서 만든다 — 규칙은 시드하지 않는다(규칙 쓰기의 감사와 무효화 체인이 시연 안에서
          함께 검증된다).
        </p>
      ) : null}
      {rules.data && rules.data.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>태그</TableHead>
              <TableHead>조건</TableHead>
              <TableHead>심각도</TableHead>
              <TableHead>사용</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.data.map((r) => (
              <TableRow key={r.ruleId} className={r.ruleId === selectedId ? 'bg-slate-100' : undefined}>
                <TableCell>
                  <Link className="text-blue-700 hover:underline" href={`/alarms/rules/${r.ruleId}`}>
                    <RuleTagLabel tagId={r.tagId} />
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {conditionText(r.conditionType, r.threshold, r.thresholdLow)}
                </TableCell>
                <TableCell>
                  <SeverityBadge severity={r.severity} />
                </TableCell>
                <TableCell>{r.enabled ? '✓' : <span className="text-slate-400">해제</span>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
    </div>
  );
}

/** 규칙 객체에는 태그 표시 필드가 없다 — 마스터 단건 조회(BFF · 30초)로 이름 · 활성 여부를 붙인다 */
function RuleTagLabel({ tagId }: { tagId: number }) {
  const tag = useTag(tagId);
  if (!tag.data) return <span>태그 {tagId}</span>;
  return (
    <span className="inline-flex flex-col">
      <span>
        {tag.data.tagName} ({tag.data.tagCode})
      </span>
      {!tag.data.isActive ? (
        <span
          className="text-xs text-amber-700"
          title="임계값은 공학 단위 값이라 옮겨 붙이면 단위가 어긋난다"
        >
          비활성 — 새 태그에 규칙을 새로 만든다
        </span>
      ) : null}
    </span>
  );
}

function RuleEditor({ rule, onSaved }: { rule: AlarmRule | null; onSaved: (r: AlarmRule) => void }) {
  const editing = rule !== null;
  const [form, setForm] = useState<RuleForm>(() => (rule ? ruleFormOf(rule) : EMPTY_RULE_FORM));
  const [tagActive, setTagActive] = useState<boolean | null>(null);
  const [errors, setErrors] = useState<RuleFormErrors>({});
  const [err, setErr] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const invalidate = useAlarmInvalidate();
  const set = <K extends keyof RuleForm>(k: K, v: RuleForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (override?: Partial<RuleForm>) => {
    const f = { ...form, ...override };
    // 편집은 태그를 바꾸지 않는다 — 태그 활성 판정은 서버가 한다(null)
    const v = validateRuleForm(f, editing ? null : tagActive);
    if (!v.ok) {
      setErrors(v.errors);
      return;
    }
    setErrors({});
    setErr(null);
    setBusy(true);
    try {
      let saved: AlarmRule;
      if (rule) {
        const patch = rulePatchBody(rule, v.body);
        if (Object.keys(patch).length === 0) {
          setBusy(false);
          return;
        }
        saved = await patchRule(rule.ruleId, patch);
      } else saved = await createRule(v.body);
      // 쓴 탭은 저장 응답으로 즉시 무효화한다 — 다른 탭 · 사용자는 체인 ⑥(cache:alarmrules 신호)
      await invalidate(alarmKeys.rules());
      if (override) setForm(f);
      onSaved(saved);
    } catch (e) {
      const ae = e instanceof ApiError ? e : new ApiError(0, null, String(e));
      setErr(ae);
      setErrors(serverFieldErrors(ae));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {err && Object.keys(serverFieldErrors(err)).length === 0 ? (
        <Band tone={err.status === 503 ? 'danger' : 'warning'}>{alarmErrorText(err, errorText)}</Band>
      ) : null}
      {editing ? (
        <div className="grid grid-cols-2 gap-2">
          <Field label="태그(불변)">
            <div className="rounded border border-slate-200 bg-slate-100 px-2 py-1 text-sm">
              <RuleTagLabel tagId={rule.tagId} />
            </div>
          </Field>
          <Field label="조건(불변 — 바꾸려면 새 규칙 등록 후 옛 규칙 끄기)">
            <TextInput value={rule.conditionType} disabled readOnly />
          </Field>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <TagPicker
            tagId={form.tagId}
            error={errors.tagId}
            onPick={(id, active) => {
              set('tagId', id);
              setTagActive(active);
            }}
          />
          <Field label="조건" error={errors.conditionType}>
            <Select
              value={form.conditionType}
              onChange={(e) => set('conditionType', e.target.value as ConditionType)}
            >
              {CONDITION_TYPES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      )}
      <div className="grid grid-cols-4 gap-2">
        <Field
          label={form.conditionType === 'RATE_OF_CHANGE' ? '임계(초당 변화량)' : '임계'}
          error={errors.threshold}
        >
          <TextInput
            inputMode="decimal"
            value={form.threshold}
            onChange={(e) => set('threshold', e.target.value)}
          />
        </Field>
        {form.conditionType === 'OUT_OF_RANGE' ? (
          <Field label="하한" error={errors.thresholdLow}>
            <TextInput
              inputMode="decimal"
              value={form.thresholdLow}
              onChange={(e) => set('thresholdLow', e.target.value)}
            />
          </Field>
        ) : null}
        <Field label="디바운스(ms)" error={errors.debounceMs}>
          <TextInput
            inputMode="numeric"
            value={form.debounceMs}
            onChange={(e) => set('debounceMs', e.target.value)}
          />
        </Field>
        <Field label="심각도" error={errors.severity}>
          <Select value={form.severity} onChange={(e) => set('severity', Number(e.target.value))}>
            {SEVERITIES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.value} {s.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.enabled} onChange={(e) => set('enabled', e.target.checked)} />
        사용
      </label>
      <div className="flex items-center gap-2">
        <Button disabled={busy} onClick={() => void submit()}>
          {busy ? '저장 중…' : '저장'}
        </Button>
        {editing && rule.enabled ? (
          <Button variant="danger" disabled={busy} onClick={() => void submit({ enabled: false })}>
            비활성화
          </Button>
        ) : null}
        <span className="text-xs text-slate-500">
          저장하면 다음 판정 배치부터 새 임계값이 쓰인다 · 규칙을 꺼도 열린 알람은 닫히지 않는다(확인만 가능)
        </span>
      </div>
    </div>
  );
}

/** 태그 선택기 — 사이트 → 설비 → 태그 · 비활성 태그는 목록에 싣지 않아 고를 수 없다(MST-04 조회 · BFF) */
function TagPicker({
  tagId,
  error,
  onPick,
}: {
  tagId: number | null;
  error?: string;
  onPick: (tagId: number | null, active: boolean | null) => void;
}) {
  const [siteId, setSiteId] = useState<number | null>(null);
  const [deviceId, setDeviceId] = useState<number | null>(null);
  const sites = useSites();
  const devices = useDevices(siteId, false);
  const tags = useTags(deviceId, false);
  const pickErr = sites.error ?? devices.error ?? tags.error;
  return (
    <Field label="태그(사이트 → 설비 → 태그)" error={error ?? (pickErr ? errorText(pickErr) : null)}>
      <div className="flex gap-1">
        <Select
          value={siteId ?? ''}
          onChange={(e) => {
            setSiteId(e.target.value === '' ? null : Number(e.target.value));
            setDeviceId(null);
            onPick(null, null);
          }}
        >
          <option value="">사이트</option>
          {sites.data?.map((s) => (
            <option key={s.siteId} value={s.siteId}>
              {s.siteName}
            </option>
          ))}
        </Select>
        <Select
          value={deviceId ?? ''}
          disabled={siteId === null}
          onChange={(e) => {
            setDeviceId(e.target.value === '' ? null : Number(e.target.value));
            onPick(null, null);
          }}
        >
          <option value="">설비</option>
          {devices.data?.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.deviceName}
            </option>
          ))}
        </Select>
        <Select
          value={tagId ?? ''}
          disabled={deviceId === null}
          onChange={(e) => {
            const id = e.target.value === '' ? null : Number(e.target.value);
            onPick(id, id === null ? null : (tags.data?.find((t) => t.tagId === id)?.isActive ?? null));
          }}
        >
          <option value="">태그</option>
          {tags.data
            ?.filter((t) => t.isActive)
            .map((t) => (
              <option key={t.tagId} value={t.tagId}>
                {t.tagName} ({t.tagCode})
              </option>
            ))}
        </Select>
      </div>
      {tagId !== null ? <Badge variant="outline">tag_id {tagId}</Badge> : null}
    </Field>
  );
}
