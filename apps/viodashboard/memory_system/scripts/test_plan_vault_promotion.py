#!/usr/bin/env python3
import importlib.util
from pathlib import Path

SCRIPT = Path(__file__).resolve().parent / 'plan_vault_promotion.py'
spec = importlib.util.spec_from_file_location('plan_vault_promotion', SCRIPT)
mod = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(mod)


class FakeRow(dict):
    def keys(self):
        return super().keys()


def test_fact_lesson_long_term_is_eligible():
    row = FakeRow({
        'id': 'f1',
        'fact_type': 'lesson',
        'content': 'Do not hardcode runtime-only bundle hashes in imports; always resolve stable entry points dynamically.',
        'scope': 'long_term',
        'source_event_id': 'e1',
        'valid_from': '2026-03-28T00:00:00Z',
        'created_at': '2026-03-28T00:00:00Z',
        'is_active': 1,
        'project_area': 'memory_system',
    })
    out = mod.classify_fact(row)
    assert out['eligible'] is True
    assert out['recommended_note_type'] == 'principle'
    assert out['recommended_system_directory'] == 'Design'


def test_unknown_fact_type_is_blocked():
    row = FakeRow({
        'id': 'f2',
        'fact_type': 'analysis-sample',
        'content': 'This is retained as an analysis sample for future comparison across failure cases and dry diffs.',
        'scope': 'long_term',
        'source_event_id': 'e2',
        'valid_from': '2026-03-28T00:00:00Z',
        'created_at': '2026-03-28T00:00:00Z',
        'is_active': 1,
        'project_area': 'memory_system',
    })
    out = mod.classify_fact(row)
    assert out['eligible'] is False
    assert any('unknown or weakly governed fact_type' in x for x in out['blockers'])


def test_raw_event_kind_is_blocked():
    row = FakeRow({
        'id': 'e3',
        'kind': 'analysis-flag',
        'source': 'session',
        'title': 'Keep this for later analysis',
        'project_area': 'memory_system',
        'content': 'This is a sufficiently long analysis note that might be useful later, but it should still be treated as raw evidence first and distilled before direct vault promotion.',
        'status': 'active',
        'confidence': 0.9,
        'ts': '2026-03-28T00:00:00Z',
    })
    out = mod.classify_event(row)
    assert out['eligible'] is False
    assert any('raw evidence' in x for x in out['blockers'])


if __name__ == '__main__':
    test_fact_lesson_long_term_is_eligible()
    test_unknown_fact_type_is_blocked()
    test_raw_event_kind_is_blocked()
    print('ok')
