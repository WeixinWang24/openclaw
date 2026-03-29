#!/usr/bin/env python3
import argparse
import json
import sqlite3
from pathlib import Path
from typing import Any, Optional

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / 'db' / 'memory.db'

FACT_TYPE_TO_NOTE_TYPE = {
    'preference': 'memory',
    'decision': 'spec',
    'todo': 'workflow',
    'lesson': 'principle',
    'rule': 'principle',
    'status': 'memory',
}

NOTE_TYPE_TO_SYSTEM_DIR = {
    'principle': 'Design',
    'workflow': 'SOP',
    'spec': 'Spec',
    'memory': 'Governance',
    'reference': 'Language',
}


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def normalize_text(value: Optional[str]) -> str:
    return (value or '').strip()


def infer_module(row: sqlite3.Row) -> str:
    project_area = normalize_text(row['project_area']) if 'project_area' in row.keys() else ''
    if project_area in {'memory_system', 'memory-system', 'memory system'}:
        return 'Memory System'
    if project_area:
        return project_area.replace('_', ' ').replace('-', ' ').strip().title()
    return 'Memory System'


def infer_note_type(fact_type: str, content: str) -> str:
    note_type = FACT_TYPE_TO_NOTE_TYPE.get(fact_type, 'memory')
    lowered = content.lower()
    if fact_type == 'decision' and any(k in lowered for k in ['workflow', 'process', 'steps', 'procedure']):
        return 'workflow'
    if fact_type in {'lesson', 'rule'} and any(k in lowered for k in ['must', 'should', 'never', 'always']):
        return 'principle'
    return note_type


def infer_system_dir(note_type: str) -> str:
    return NOTE_TYPE_TO_SYSTEM_DIR.get(note_type, 'Governance')


def classify_fact(row: sqlite3.Row) -> dict[str, Any]:
    content = normalize_text(row['content'])
    fact_type = normalize_text(row['fact_type'])
    note_type = infer_note_type(fact_type, content)
    recommended_dir = infer_system_dir(note_type)
    reasons: list[str] = []
    blockers: list[str] = []
    eligible = True

    if row['scope'] != 'long_term':
        eligible = False
        blockers.append(f"scope={row['scope']} is not long_term")
    else:
        reasons.append('fact scope is long_term')

    if not row['is_active']:
        eligible = False
        blockers.append('fact is inactive')
    else:
        reasons.append('fact is active')

    if fact_type == 'todo':
        eligible = False
        blockers.append('todo facts are not stable knowledge by default')

    if len(content) < 24:
        eligible = False
        blockers.append('content too short to justify promotion')
    else:
        reasons.append('content length passes minimum threshold')

    if fact_type in {'preference', 'decision', 'lesson', 'rule', 'status'}:
        reasons.append(f'fact_type={fact_type} maps to note_type={note_type}')
    else:
        blockers.append(f'unknown or weakly governed fact_type={fact_type}')
        eligible = False

    return {
        'source_table': 'facts',
        'source_id': row['id'],
        'eligible': eligible,
        'recommended_note_type': note_type if eligible else None,
        'recommended_system_directory': recommended_dir if eligible else None,
        'module': infer_module(row),
        'title_hint': content[:80],
        'reasons': reasons,
        'blockers': blockers,
        'source': {
            'fact_type': fact_type,
            'scope': row['scope'],
            'content': content,
            'source_event_id': row['source_event_id'],
            'valid_from': row['valid_from'],
            'created_at': row['created_at'],
        },
    }


def classify_event(row: sqlite3.Row) -> dict[str, Any]:
    content = normalize_text(row['content'])
    title = normalize_text(row['title'])
    kind = normalize_text(row['kind'])
    reasons: list[str] = []
    blockers: list[str] = []
    kind_allowed = False
    content_strong = False
    note_type = None
    system_dir = None

    if kind in {'decision', 'lesson', 'review', 'note'}:
        kind_allowed = True
        reasons.append(f'event kind {kind} can contain promotable knowledge')
    else:
        blockers.append(f'event kind {kind} is treated as raw evidence by default')

    if len(content) >= 80:
        content_strong = True
        reasons.append('event content is long enough to review as candidate material')
    else:
        blockers.append('event content too short for direct promotion planning')

    lowered = f'{title}\n{content}'.lower()
    if kind == 'decision':
        note_type = 'spec'
    elif kind == 'lesson':
        note_type = 'principle'
    elif any(k in lowered for k in ['workflow', 'procedure', 'step', 'process']):
        note_type = 'workflow'
    elif any(k in lowered for k in ['rule', 'must', 'should', 'never', 'always']):
        note_type = 'principle'

    eligible = bool(kind_allowed and content_strong and note_type)

    if eligible:
        system_dir = infer_system_dir(note_type)
    else:
        blockers.append('event should usually be distilled into facts before vault promotion')

    return {
        'source_table': 'events',
        'source_id': row['id'],
        'eligible': eligible,
        'recommended_note_type': note_type,
        'recommended_system_directory': system_dir,
        'module': infer_module(row),
        'title_hint': title or content[:80],
        'reasons': reasons,
        'blockers': blockers,
        'source': {
            'kind': kind,
            'source': row['source'],
            'title': title,
            'content': content,
            'project_area': row['project_area'],
            'status': row['status'],
            'confidence': row['confidence'],
            'ts': row['ts'],
        },
    }


def fetch_facts(conn: sqlite3.Connection, limit: int, query: Optional[str]) -> list[sqlite3.Row]:
    sql = '''
    SELECT id, fact_type, content, scope, source_event_id, valid_from, created_at, is_active,
           '' as project_area
    FROM facts
    WHERE 1=1
    '''
    params: list[Any] = []
    if query:
        sql += ' AND content LIKE ?'
        params.append(f'%{query}%')
    sql += ' ORDER BY coalesce(valid_from, created_at) DESC LIMIT ?'
    params.append(limit)
    return list(conn.execute(sql, params).fetchall())


def fetch_events(conn: sqlite3.Connection, limit: int, query: Optional[str]) -> list[sqlite3.Row]:
    sql = '''
    SELECT id, ts, kind, source, title, project_area, content, status, confidence
    FROM events
    WHERE 1=1
    '''
    params: list[Any] = []
    if query:
        sql += ' AND (content LIKE ? OR title LIKE ?)'
        like = f'%{query}%'
        params.extend([like, like])
    sql += ' ORDER BY ts DESC LIMIT ?'
    params.append(limit)
    return list(conn.execute(sql, params).fetchall())


def main() -> None:
    parser = argparse.ArgumentParser(description='Plan Memory System -> Obsidian vault promotions')
    parser.add_argument('--from-table', choices=['facts', 'events', 'all'], default='all')
    parser.add_argument('--query')
    parser.add_argument('--limit', type=int, default=20)
    parser.add_argument('--eligible-only', action='store_true')
    parser.add_argument('--json', action='store_true')
    args = parser.parse_args()

    if not DB_PATH.exists():
        raise SystemExit(f'Database not found: {DB_PATH}. Run init_db.py first.')

    conn = connect()
    try:
        items: list[dict[str, Any]] = []
        if args.from_table in {'facts', 'all'}:
            items.extend(classify_fact(row) for row in fetch_facts(conn, args.limit, args.query))
        if args.from_table in {'events', 'all'}:
            items.extend(classify_event(row) for row in fetch_events(conn, args.limit, args.query))
    finally:
        conn.close()

    if args.eligible_only:
        items = [item for item in items if item['eligible']]

    result = {
        'rules_basis': {
            'workflow': 'memory-to-vault-promotion-rules.md',
            'note': 'Promotion planning is advisory; reviewed publication must still go through Agent Workspace -> Inbox -> User review -> System.'
        },
        'counts': {
            'total': len(items),
            'eligible': sum(1 for item in items if item['eligible']),
            'blocked': sum(1 for item in items if not item['eligible']),
        },
        'items': items,
    }

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return

    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
