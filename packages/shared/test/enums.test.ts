import { describe, expect, it } from 'vitest';
import { QUALITY, SIGNAL_PROFILES, STREAM_QUALITY_CODES } from '../src/enums';
import { docTable } from './doc-table';

describe('열거 — 정본 11_glossary/03과 같다', () => {
  it('품질 코드 7 — 코드 · 이름', () => {
    const rows = docTable('11_glossary/03_enums_state_machines.md', '품질 코드');
    const fromDoc = Object.fromEntries(rows.map((r) => [r[1], Number(r[0])]));
    expect(fromDoc).toEqual(QUALITY);
  });

  it('신호 프로파일 8 — 이름 · 순서', () => {
    const rows = docTable('11_glossary/03_enums_state_machines.md', '신호 프로파일');
    expect(rows.map((r) => r[0])).toEqual([...SIGNAL_PROFILES]);
  });

  it('Stream에 실리는 품질은 0 · 1 · 2 · 4 · 9 — 3은 행이 없고 5는 조회 시점 판정', () => {
    expect([...STREAM_QUALITY_CODES].sort()).toEqual([0, 1, 2, 4, 9]);
  });
});
