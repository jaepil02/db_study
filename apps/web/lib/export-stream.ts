// 원시 내보내기 — fetch 스트림으로 받아 파일로 쓴다(08_screen/04 §호출 표면 · 링크 다운로드 금지 — S7 Bearer 헤더를 실을 수 없다)
// 완결 = 종결 청크 수신(스트림 읽기가 done으로 끝남). 읽기 오류로 끝나면 불완전 — 서버는 상태 200을 이미 보냈다.
import { ApiError, directUrl } from './api';
import { toKstOffsetIso } from './time';
import { exportFileName } from './trend';

export interface ExportResult {
  fileName: string;
  complete: boolean;
  bytes: number;
}

export async function exportStream(
  req: { tagIds: number[]; fromMs: number; toMs: number; format: 'csv' | 'parquet' },
  onProgress: (bytes: number) => void,
): Promise<ExportResult> {
  const q = new URLSearchParams({
    tagIds: req.tagIds.join(','),
    from: toKstOffsetIso(req.fromMs),
    to: toKstOffsetIso(req.toMs),
    format: req.format,
  });
  let res: Response;
  try {
    res = await fetch(directUrl(`/api/v1/timeseries/export?${q}`), { cache: 'no-store' });
  } catch {
    throw new ApiError(0, null, 'api에 닿지 못했다');
  }
  if (!res.ok || !res.body) {
    let code: string | null = null;
    try {
      code = ((await res.json()) as { error?: { code?: string } }).error?.code ?? null;
    } catch {
      // 봉투 아님
    }
    throw new ApiError(res.status, code, `내보내기 시작 실패 HTTP ${res.status}`);
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  let complete = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        complete = true;
        break;
      }
      chunks.push(value);
      bytes += value.byteLength;
      onProgress(bytes);
    }
  } catch {
    complete = false; // 도중 중단 — 종결 청크 없음
  }
  const fileName = exportFileName(req.format, req.fromMs, complete);
  const blob = new Blob(chunks as BlobPart[], {
    type: req.format === 'csv' ? 'text/csv' : 'application/octet-stream',
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  return { fileName, complete, bytes };
}
