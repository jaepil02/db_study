// BFF 기록 읽기 — EXP-COMPARE 대조군 역전 지점 패널의 원천(08_screen/07 §대조군 역전 지점 · W5 리드 판정 후보 ①).
// api 표면이 아니다 — Next.js 서버가 docs/measurements를 읽기 전용으로 읽고 판독 규칙 7(10_observability/04 §BFF 판독 규칙)을 적용해 내린다.
// 쓰기 경로가 없다. 판독 불가 · 4요소 누락 · 제외 수를 함께 내려 조용히 빼지 않는다.
// evidence — 실증 요약 패널(역방향 EXP-40~44 reverse · EXP-45 streamSteps)의 판독 결과. 역전 지점 판독(최상위 필드)은 그대로 둔다.
// view=perf — EXP-PERF 성능 보기(08_screen/08 §EXP-PERF 호출 표면 — 같은 라우트의 다른 판독 보기 · 판독 규칙 P1~P6은 lib/perf.ts).
import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { NO_STORE } from '../../../lib/bff';
import { readEvidence } from '../../../lib/evidence';
import { readMeasurements } from '../../../lib/measurements';
import { readPerf } from '../../../lib/perf';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** 기록 폴더 — MEASUREMENTS_DIR가 있으면 그것 · 없으면 웹 앱(apps/web) 또는 저장소 루트 기준 docs/measurements */
async function measurementsDir(): Promise<string | null> {
  const candidates = process.env.MEASUREMENTS_DIR
    ? [process.env.MEASUREMENTS_DIR]
    : [
        path.resolve(process.cwd(), '../../docs/measurements'),
        path.resolve(process.cwd(), 'docs/measurements'),
      ];
  for (const c of candidates) {
    try {
      await access(c);
      return c;
    } catch {
      // 다음 후보
    }
  }
  return null;
}

export async function GET(request: Request): Promise<Response> {
  const dir = await measurementsDir();
  if (!dir) {
    return Response.json(
      { error: { message: 'docs/measurements 폴더를 찾지 못했다' } },
      { status: 500, headers: NO_STORE },
    );
  }
  const names = (await readdir(dir, { withFileTypes: true }))
    .filter((d) => d.isFile() && d.name.endsWith('.md'))
    .map((d) => d.name)
    .sort();
  const files = await Promise.all(
    names.map(async (name) => ({ name, text: await readFile(path.join(dir, name), 'utf8') })),
  );
  if (new URL(request.url).searchParams.get('view') === 'perf')
    return Response.json({ readAt: Date.now(), ...readPerf(files) }, { headers: NO_STORE });
  return Response.json(
    { readAt: Date.now(), ...readMeasurements(files), evidence: readEvidence(files) },
    { headers: NO_STORE },
  );
}
