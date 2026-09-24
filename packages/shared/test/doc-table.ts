// 정본 문서의 마크다운 표를 읽는 테스트 도우미 — 코드의 상수가 문서 정본과 어긋나면 테스트가 실패하게 한다
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DOCS = resolve(__dirname, '../../../docs');

/** heading(## 제목 · level로 ### 가능)부터 다음 ## 전까지의 첫 표를 셀 배열로 돌려준다(머리 · 구분 줄 제외) */
export function docTable(relPath: string, heading: string, level = 2): string[][] {
  const text = readFileSync(resolve(DOCS, relPath), 'utf8');
  const start = text.indexOf(`\n${'#'.repeat(level)} ${heading}`);
  if (start < 0) throw new Error(`${relPath}에 §${heading}이 없다`);
  const rest = text.slice(start + 1);
  const end = rest.indexOf('\n## ', 3);
  const section = end < 0 ? rest : rest.slice(0, end);
  const lines = section.split('\n').filter((l) => l.startsWith('|'));
  return lines.slice(2).map((l) =>
    l
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim().replace(/\*\*/g, '')),
  );
}

/** 절 전체의 표 행을 모은다 — 한 절에 표가 여럿(### 하위 절)일 때 */
export function docSectionRows(relPath: string, heading: string): string[][] {
  const text = readFileSync(resolve(DOCS, relPath), 'utf8');
  const start = text.indexOf(`\n## ${heading}`);
  if (start < 0) throw new Error(`${relPath}에 §${heading}이 없다`);
  const rest = text.slice(start + 1);
  const end = rest.indexOf('\n## ', 3);
  const section = end < 0 ? rest : rest.slice(0, end);
  return section
    .split('\n')
    .filter((l) => l.startsWith('|') && !/^\|[\s:|-]+\|$/.test(l))
    .map((l) =>
      l
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim().replace(/\*\*/g, '')),
    );
}
