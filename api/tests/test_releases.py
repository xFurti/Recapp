import dataclasses
import json
from pathlib import Path
import subprocess

import pytest
from sqlalchemy import inspect
from sqlmodel import Session, select

from api import releases
from api.db import engine
from api.models import ReleaseSeen
from .conftest import make_client
from .test_tour import _official_member


def test_public_notes_and_unique_content_source(client):
    body = client.get('/api/releases').json()
    built = json.loads(subprocess.check_output(['node', 'scripts/release-notes.mjs', '--json']))
    assert {key: body[key] for key in ('current', 'releases')} == built
    assert body['version'] == releases.settings.app_version
    assert client.get('/api/releases').headers['cache-control'] == 'no-store'
    assert body['current'] == '2026.10.13.1'
    assert len(body['releases'][0]['summary']) == 3


def test_running_artifact_controls_history_and_rollback(client, tmp_path, monkeypatch):
    monkeypatch.setattr(releases, 'settings', dataclasses.replace(releases.settings, web_dist=tmp_path, app_version='deployed'))
    path = tmp_path / 'release-manifest.json'
    for release_id in ('old', 'new', 'old'):
        path.write_text(json.dumps({'current': release_id, 'releases': [{'id': release_id}]}))
        response = client.get('/api/releases').json()
        assert response['current'] == release_id
        assert response['version'] == 'deployed'
        assert response['releases'] == [{'id': release_id}]


def test_missing_or_broken_notes_do_not_break_app(client, tmp_path, monkeypatch):
    monkeypatch.setattr(releases, 'settings', dataclasses.replace(releases.settings, web_dist=tmp_path, app_env='prod'))
    assert client.get('/api/releases').json()['current'] is None
    (tmp_path / 'release-manifest.json').write_text('broken')
    assert client.get('/api/releases').status_code == 503
    assert client.get('/api/healthz').status_code == 200


def test_seen_release_survives_login_and_another_device(client):
    _, student, code = _official_member()
    release_id = releases.manifest()['current']
    assert student.get('/api/release-preference').json() == {'seen': [], 'stored': True}
    assert student.post('/api/release-preference', json={'release_id': release_id}).json()['stored'] is True
    assert student.post('/api/release-preference', json={'release_id': release_id}).status_code == 200
    member_id = student.get('/api/me').json()['member']['id']
    second_device = make_client()
    assert second_device.post(f'/api/classes/{code}/login', json={'member_id': member_id, 'pin': '111111'}).status_code == 200
    assert second_device.get('/api/release-preference').json()['seen'] == [release_id]
    second_device.post('/api/auth/logout')
    assert second_device.get('/api/release-preference').status_code == 401


def test_account_isolation_and_owner_support(client):
    owner, student, code = _official_member()
    release_id = releases.manifest()['current']
    assert student.get('/api/release-preference').json()['seen'] == []
    owner.post('/api/release-preference', json={'release_id': release_id})
    assert student.get('/api/release-preference').json()['seen'] == []
    student.post('/api/release-preference', json={'release_id': release_id})
    other_id = student.post(f'/api/classes/{code}/members', json={'nick': 'other'}).json()['member_id']
    invite = student.post(f'/api/classes/{code}/members/{other_id}/reset-invite').json()['invite']
    other = make_client()
    other.post(f'/api/classes/{code}/activate', json={'member_id': other_id, 'invite': invite, 'pin': '222222'})
    assert other.get('/api/release-preference').json()['seen'] == []


def test_demo_never_stores_shared_preference(client):
    client.post('/api/auth/demo')
    assert client.get('/api/release-preference').json()['stored'] is False
    assert client.post('/api/release-preference', json={'release_id': releases.manifest()['current']}).json()['stored'] is False


@pytest.mark.parametrize('release_id', ['unreleased', 'withdrawn', '', 'x' * 81])
def test_unknown_and_withdrawn_releases_cannot_be_acknowledged(client, release_id):
    client.post('/api/auth/demo')
    assert client.post('/api/release-preference', json={'release_id': release_id}).status_code in (409, 422)


def test_preference_requires_authentication(client):
    assert client.get('/api/release-preference').status_code == 401
    assert client.post('/api/release-preference', json={'release_id': releases.manifest()['current']}).status_code == 401


def test_new_table_is_created_without_altering_existing_accounts(client):
    assert 'releaseseen' in inspect(engine).get_table_names()
    with Session(engine) as session:
        rows = session.exec(select(ReleaseSeen)).all()
        assert len({(row.account_kind, row.account_id, row.release_id) for row in rows}) == len(rows)


@pytest.mark.parametrize('change', ['missing_language', 'unsafe_link', 'too_many_points', 'duplicate_id'])
def test_build_rejects_invalid_notes(tmp_path, change):
    source = Path('release-notes/2026-10-13-novita.json')
    note = json.loads(source.read_text())
    if change == 'missing_language':
        del note['title']['en']
    elif change == 'unsafe_link':
        note['entries'][0]['link']['href'] = 'javascript:alert(1)'
    elif change == 'too_many_points':
        note['summary'] *= 2
    else:
        (tmp_path / 'duplicate.json').write_text(json.dumps(note))
    (tmp_path / 'note.json').write_text(json.dumps(note))
    import os
    result = subprocess.run(['node', 'scripts/release-notes.mjs'], env={**os.environ, 'RELEASE_NOTES_DIR': str(tmp_path)}, capture_output=True)
    assert result.returncode != 0


def test_internal_only_update_keeps_history_without_announcing(tmp_path):
    import os
    note = json.loads(Path('release-notes/2026-10-13-novita.json').read_text())
    (tmp_path / 'public.json').write_text(json.dumps(note))
    (tmp_path / 'internal.json').write_text(json.dumps({'id': 'internal', 'published_at': '2026-10-14T12:00:00Z', 'visibility': 'internal', 'reason': {'it': 'Nessuna novità da mostrare', 'en': 'No user-facing updates'}}))
    result = json.loads(subprocess.check_output(['node', 'scripts/release-notes.mjs', '--json'], env={**os.environ, 'RELEASE_NOTES_DIR': str(tmp_path)}))
    assert result['current'] is None
    assert [note['id'] for note in result['releases']] == ['2026.10.13.1']
