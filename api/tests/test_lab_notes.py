from datetime import timedelta

import pytest

from .test_api import TODAY, at, reset_demo


def start(client):
    reset_demo(client)
    client.post('/api/auth/demo')
    return f'/api/classes/DEMO/cards/{TODAY.isoformat()}'


def payload(lab, revision=0, bullets=None):
    return {'revision': revision, 'entries': [{'subject_code': 'TCI', 'is_lab': True, 'bullets': bullets or [], 'lab': lab}], 'notes': '', 'items': []}


def test_multiline_lab_roundtrip_publication_subject_and_dated_assignment(client):
    path = start(client)
    notes = 'La tabella delle misure è nel quaderno.\nControllare la portata del multimetro.'
    data = payload({'notes': f'  {notes}\n', 'repo_url': 'phet.colorado.edu/it/simulations/circuit-construction-kit-dc'}, bullets=['Montato un circuito in serie.'])
    due = (TODAY + timedelta(days=3)).isoformat()
    data['items'] = [{'type': 'compito', 'subject_code': 'TCI', 'title': 'Portare il multimetro e completare i calcoli', 'due_date': due}]
    response = client.put(path, json=data, headers=at(15))
    assert response.status_code == 200, response.text
    card = response.json()
    assert card['entries'][0]['lab']['notes'] == notes
    assert card['entries'][0]['lab']['repo_url'].startswith('https://phet.')
    assert client.get(path).json()['card']['entries'] == card['entries']
    assert not any(item['title'] == data['items'][0]['title'] for item in client.get('/api/classes/DEMO/upcoming').json())
    assert client.post(path + '/publish', headers=at(15)).status_code == 200
    rows = client.get('/api/classes/DEMO/subjects/TCI/entries?range=all').json()
    assert rows[0]['lab'] == card['entries'][0]['lab']
    item = next(item for item in client.get('/api/classes/DEMO/upcoming').json() if item['title'] == data['items'][0]['title'])
    assert item['due_date'] == due and item['due_time'] is None


def test_legacy_lab_is_readable_and_conversion_is_editable_and_repeatable(client):
    path = start(client)
    old = {'goal': 'Confrontare le misure', 'repo_url': 'https://example.org/scheda', 'pitfall': 'Controllare la portata', 'bring': 'Multimetro'}
    response = client.put(path, json=payload(old), headers=at(15))
    assert response.status_code == 200, response.text
    card = response.json()
    assert card['entries'][0]['lab'] == {**old, 'notes': None}
    assert client.post(path + '/publish', headers=at(15)).status_code == 200
    assert client.get(path).json()['card']['entries'][0]['lab'] == {**old, 'notes': None}
    card = client.get(path).json()['card']
    combined = 'Obiettivo: Confrontare le misure\n\nTrappola: Controllare la portata\n\nCosa portare: Multimetro'
    lab = {'notes': combined, 'repo_url': old['repo_url']}
    for notes in (combined, combined + '\nMisure ricontrollate.', ''):
        lab['notes'] = notes
        response = client.put(path, json=payload(lab, card['revision']), headers=at(15))
        assert response.status_code == 200, response.text
        card = response.json()
        assert card['entries'][0]['lab'] == {**lab, 'goal': '', 'pitfall': '', 'bring': ''}
        assert client.get(path).json()['card']['entries'][0]['lab']['notes'] == notes
        assert not card['items'], 'Old materials must not become invented deadlines'


@pytest.mark.parametrize('lab', [None, {}, {'notes': '  \n  ', 'repo_url': '   '}, {'notes': '', 'goal': ' ', 'pitfall': ' ', 'bring': ' '}])
def test_lab_marker_and_whitespace_do_not_allow_empty_publication(client, lab):
    path = start(client)
    response = client.put(path, json=payload(lab), headers=at(15))
    assert response.status_code == 200, response.text
    assert client.post(path + '/publish', headers=at(15)).status_code == 422


@pytest.mark.parametrize('lab', [{'notes': 'Controllare la portata.'}, {'repo_url': 'example.org/scheda'}])
def test_optional_notes_or_link_are_useful_content(client, lab):
    path = start(client)
    response = client.put(path, json=payload(lab), headers=at(15))
    assert response.status_code == 200, response.text
    assert client.post(path + '/publish', headers=at(15)).status_code == 200


def test_notes_length_and_link_removal(client):
    path = start(client)
    assert client.put(path, json=payload({'notes': 'a' * 3001}), headers=at(15)).status_code == 422
    response = client.put(path, json=payload({'notes': 'a' * 3000, 'repo_url': 'example.org/scheda'}), headers=at(15))
    assert response.status_code == 200, response.text
    card = response.json()
    response = client.put(path, json=payload({'notes': 'a' * 3000, 'repo_url': ''}, card['revision']), headers=at(15))
    assert response.status_code == 200, response.text
    assert response.json()['entries'][0]['lab']['repo_url'] == ''
