#!/usr/bin/env python3
"""docs/ 설계 문서군 기계 검사.

사용: python3 scripts/docs_lint.py [--final] [파일 또는 폴더 ...]  (task docs:lint -- [인자] 와 같다)
  인자가 없으면 docs/ 전체(docs/measurements 제외)를 검사한다.
  --final 이면 예정 파일로 가는 링크도 오류로 보고 파일 수 122를 검사한다.
"""
import os
import re
import sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'docs'))
EXCLUDE_DIRS = {'measurements'}

PLANNED = {
    '': ['README.md', 'CLAUDE.md'],
    '01_overview': ['README.md', '01_purpose_learning_goals.md', '02_goals_scope.md', '03_personas_roles.md',
                    '04_domain_map.md', '05_priorities_roadmap.md', '06_design_decisions.md'],
    '02_features': ['README.md', '01_auth.md', '02_master.md', '03_collector.md', '04_plc_sim.md', '05_datagen.md',
                    '06_ingest.md', '07_timeseries.md', '08_realtime.md', '09_alarms.md', '10_work_orders.md',
                    '11_metrics.md', '12_permission_matrix.md', '13_switch_matrix.md'],
    '03_requirements': ['README.md', '01_global_rules.md', '02_auth.md', '03_master.md', '04_collector.md',
                        '05_plc_sim.md', '06_datagen.md', '07_ingest.md', '08_timeseries.md', '09_realtime.md',
                        '10_alarms.md', '11_work_orders.md', '12_metrics.md', '13_nonfunctional.md',
                        '14_acceptance_criteria.md', '15_traceability.md', '16_official_references.md'],
    '04_architecture': ['README.md', '01_system_architecture.md', '02_module_boundaries.md',
                        '03_execution_topology.md', '04_storage_split.md', '05_latency_budget.md',
                        '06_backpressure_failure.md', '07_capacity_planning.md', '08_scaling_roadmap.md',
                        '09_decision_records.md'],
    '05_data_stores': ['README.md', '01_postgresql_schema.md', '02_postgresql_constraints.md',
                       '03_clickhouse_schema.md', '04_clickhouse_rollup.md', '05_redis_keyspace.md',
                       '06_redis_memory.md', '07_cross_store_consistency.md', '08_retention_lifecycle.md',
                       '09_migrations_seed.md', '10_olap_vs_rdb_control.md', 'erd.md'],
    '06_pipeline': ['README.md', '01_flow_inventory.md', '02_collect.md', '03_ingest_batch.md', '04_routing.md',
                    '05_realtime_read.md', '06_timeseries_read.md', '07_business_crud.md', '08_alarm.md',
                    '09_rollup.md', '10_datagen_inject.md', '11_backpressure_failure.md', '12_data_contract.md'],
    '07_api': ['README.md', '01_conventions.md', '02_errors.md', '03_auth.md', '04_master.md', '05_timeseries.md',
               '06_realtime.md', '07_alarms.md', '08_work_orders.md', '09_datagen.md', '10_metrics.md',
               '11_websocket.md'],
    '08_screen': ['README.md', '01_standards.md', '02_traceability.md', '03_realtime_dashboard.md',
                  '04_trend_analysis.md', '05_alarm_console.md', '06_master_admin.md', '07_experiment_console.md'],
    '09_tech_stack': ['README.md', '01_frontend.md', '02_backend.md', '03_data_infra.md',
                      '04_local_environment.md', '05_tooling_devops.md', '06_decisions_rationale.md'],
    '10_observability': ['README.md', '01_metrics_catalog.md', '02_instrumentation.md', '03_dashboards_alerts.md',
                         '04_experiment_protocol.md', '05_load_scenarios.md', '06_experiment_catalog.md',
                         '07_measurement_limits.md'],
    '11_glossary': ['README.md', '01_domain_terms.md', '02_error_codes.md', '03_enums_state_machines.md',
                    '04_id_conventions.md', '05_units_and_time.md'],
    '12_security': ['README.md', '01_authn_authz.md', '02_secrets_config.md', '03_api_surface_defense.md',
                    '04_threat_model.md', '05_local_exposure.md'],
}
PLANNED_SET = {os.path.normpath(os.path.join(ROOT, d, f)) for d, fs in PLANNED.items() for f in fs}

FENCE_LANGS = {'plain', 'json', 'mermaid', 'sql'}
MERMAID_TYPES = ('flowchart', 'erDiagram', 'stateDiagram-v2')
FORBIDDEN = ['권장한다', '고려한다', '하는 것이 좋다', 'TBD', 'FIXME']
RULE_DOC = os.path.normpath(os.path.join(ROOT, 'CLAUDE.md'))  # 금지어·절 표기를 정의하는 문서
URL_OK_FILE = os.path.normpath(os.path.join(ROOT, '03_requirements', '16_official_references.md'))
LINK_RE = re.compile(r'\[([^\]]*)\]\(([^)\s]+)\)')
SECTION_RE = re.compile(r'(?<![§\d.])\d+(\.\d+)*절')
URL_RE = re.compile(r'https?://(?!localhost|127\.0\.0\.1)[^\s)|]+')


def md_files(targets):
    out = []
    for t in targets:
        t = os.path.abspath(t)
        if os.path.isfile(t):
            out.append(t)
            continue
        for dp, dns, fns in os.walk(t):
            dns[:] = [d for d in dns if d not in EXCLUDE_DIRS]
            out += [os.path.join(dp, f) for f in fns if f.endswith('.md')]
    return sorted(out)


def check(path, final):
    errs = []
    rel = os.path.relpath(path, ROOT)
    lines = open(path, encoding='utf-8').read().split('\n')
    if lines and lines[-1] == '':
        lines = lines[:-1]

    def e(n, msg):
        errs.append(f'{rel}:{n}: {msg}')

    # 골격
    if not lines or not lines[0].startswith('# '):
        e(1, '줄1이 H1이 아니다')
    if len(lines) < 4 or lines[1] != '':
        e(2, '줄2가 빈 줄이 아니다')
    if len(lines) < 4 or not lines[2].startswith('> **대상**: '):
        e(3, '줄3이 대상 메타가 아니다')
    if len(lines) < 4 or not lines[3].startswith('> **작성일**: '):
        e(4, '줄4가 작성일 메타가 아니다')
    i = 2
    while i < len(lines) and lines[i].startswith('> '):
        i += 1
    meta = lines[2:i]
    if not meta or not meta[-1].startswith('> **원천**: '):
        e(i, '메타 블록의 마지막 줄이 원천이 아니다')
    for k, m in enumerate(meta[2:-1], start=5):
        if not (m.startswith('> **개정일**: ') or m.startswith('> **성격**: ')):
            e(k, '메타 블록에 허용되지 않은 줄')
    if i < len(lines) and lines[i] != '':
        e(i + 1, '메타 블록 뒤에 빈 줄이 없다')

    in_fence = False
    fence_lang = None
    mermaid_first = False
    h1 = 0
    h2s = []
    prev_blank = False
    for n, line in enumerate(lines, start=1):
        s = line.strip()
        if s.startswith('```'):
            if not in_fence:
                in_fence = True
                fence_lang = s[3:].strip()
                mermaid_first = fence_lang == 'mermaid'
                if fence_lang not in FENCE_LANGS:
                    e(n, f'허용되지 않은 펜스 언어: "{fence_lang}"')
            else:
                in_fence = False
                fence_lang = None
            prev_blank = False
            continue
        if in_fence:
            if fence_lang == 'mermaid':
                if mermaid_first and s:
                    if not s.startswith(MERMAID_TYPES):
                        e(n, f'허용되지 않은 mermaid 형식: {s.split()[0]}')
                    mermaid_first = False
                if re.search(r'^\s*style\s|classDef|fill:#|stroke:#', line):
                    e(n, 'mermaid 스타일 지시자')
            continue
        if line == '':
            if prev_blank:
                e(n, '이중 빈 줄')
            prev_blank = True
        else:
            prev_blank = False
        if line.startswith('# '):
            h1 += 1
        if line.startswith('## '):
            h2s.append(line)
        if '`' in line:
            e(n, '인라인 백틱')
        rule_doc = os.path.normpath(path) == RULE_DOC
        if SECTION_RE.search(line) and not rule_doc:
            e(n, '절 참조는 § 형식으로 쓴다')
        for w in FORBIDDEN:
            if w in line and not rule_doc:
                e(n, f'금지어: {w}')
        if os.path.normpath(path) != URL_OK_FILE and URL_RE.search(line):
            e(n, '외부 URL은 03_requirements/16_official_references.md에만 둔다')
        for label, target in LINK_RE.findall(line):
            if re.match(r'https?://', target):
                continue
            tpath = target.split('#')[0]
            if not tpath:
                continue
            abs_t = os.path.normpath(os.path.join(os.path.dirname(path), tpath))
            if os.path.isdir(abs_t):
                e(n, f'링크 대상이 폴더다(README.md를 가리킨다): {target}')
                continue
            if not os.path.exists(abs_t):
                if abs_t in PLANNED_SET and not final:
                    pass
                else:
                    e(n, f'깨진 링크: {target}')
            folder_label = os.path.basename(os.path.dirname(abs_t))
            ok_labels = {target, target[2:] if target.startswith('./') else target}
            if tpath.endswith('/README.md'):
                folder = tpath[:-len('/README.md')]
                ok_labels |= {folder, folder[2:] if folder.startswith('./') else folder}
            if label not in ok_labels and not (tpath.endswith('README.md') and label == folder_label):
                e(n, f'링크 라벨이 대상과 다르다: [{label}]({target})')
    if in_fence:
        e(len(lines), '닫히지 않은 펜스')
    # 표 열 수 검사 — 헤더와 다른 칸 수의 행은 빈 칸이나 밀린 칸을 만든다
    fence = False
    cols = None
    for n, line in enumerate(lines, start=1):
        if line.strip().startswith('```'):
            fence = not fence
            cols = None
            continue
        if fence:
            continue
        if line.startswith('|'):
            c = line.replace('\\|', '').rstrip().rstrip('|').count('|')
            if cols is None:
                cols = c
            elif c != cols:
                e(n, f'표 열 수 불일치: {c}칸 · 헤더 {cols}칸')
        else:
            cols = None
    if h1 != 1:
        e(1, f'H1이 {h1}개다')
    if not h2s or h2s[-1] != '## 관련 문서':
        e(len(lines), '마지막 H2가 "## 관련 문서"가 아니다')
    if os.path.basename(path) == 'README.md' and os.path.dirname(os.path.normpath(path)) != ROOT:
        if not any(h.startswith('## 파일 목차') for h in h2s):
            e(1, '폴더 README에 "## 파일 목차"가 없다')
        if not any(h.startswith('## 고정 기준') for h in h2s):
            e(1, '폴더 README에 "## 고정 기준"이 없다')
    if os.path.normpath(path) not in PLANNED_SET:
        e(1, '계획에 없는 파일')
    return errs


def main():
    args = sys.argv[1:]
    final = '--final' in args
    targets = [a for a in args if a != '--final'] or [ROOT]
    files = md_files(targets)
    errs = []
    for f in files:
        errs += check(f, final)
    if final:
        allf = md_files([ROOT])
        if len(allf) != 122:
            errs.append(f'파일 수 {len(allf)} ≠ 122')
        missing = sorted(PLANNED_SET - {os.path.normpath(f) for f in allf})
        errs += [f'미작성: {os.path.relpath(m, ROOT)}' for m in missing]
    for x in errs:
        print(x)
    print(f'검사 파일 {len(files)}개 · 오류 {len(errs)}건')
    sys.exit(1 if errs else 0)


if __name__ == '__main__':
    main()
