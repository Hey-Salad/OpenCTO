from fastapi.testclient import TestClient

from app import create_app
from run_service import RunService
from run_store import InMemoryRunStore


def _client(max_artifact_bytes: int = 200):
    svc = RunService(InMemoryRunStore(), max_artifact_bytes=max_artifact_bytes)
    return TestClient(create_app(svc)), svc


def test_create_get_and_fail_flow():
    client, _ = _client()
    with client:
        run_res = client.post('/v1/runs', json={'goal': 'deploy now'})
        assert run_res.status_code == 200
        run_id = run_res.json()['run_id']

        step_res = client.post(
            f'/v1/runs/{run_id}/steps',
            json={'type': 'plan', 'status': 'running', 'title': 'plan', 'details': {'owner': 'cto'}},
        )
        assert step_res.status_code == 200

        artifact_res = client.post(
            f'/v1/runs/{run_id}/artifacts',
            json={'kind': 'output', 'title': 'logs', 'content': 'all good', 'metadata': {}},
        )
        assert artifact_res.status_code == 200

        fail_res = client.post(
            f'/v1/runs/{run_id}/fail',
            json={'summary': 'failed on deploy', 'error': 'timeout'},
        )
        assert fail_res.status_code == 200
        assert fail_res.json()['run']['status'] == 'failed'

        get_res = client.get(f'/v1/runs/{run_id}')
        assert get_res.status_code == 200
        payload = get_res.json()
        assert payload['run']['status'] == 'failed'
        assert len(payload['steps']) == 1
        assert len(payload['artifacts']) == 1


def test_create_run_idempotency_key_returns_same_run():
    client, _ = _client()
    with client:
        headers = {'Idempotency-Key': 'same-create-key'}
        a = client.post('/v1/runs', json={'goal': 'idempotent'}, headers=headers)
        b = client.post('/v1/runs', json={'goal': 'idempotent changed'}, headers=headers)
        assert a.status_code == 200
        assert b.status_code == 200
        assert a.json()['run_id'] == b.json()['run_id']


def test_artifact_idempotency_key_returns_same_artifact():
    client, _ = _client()
    with client:
        run_id = client.post('/v1/runs', json={'goal': 'artifact idem'}).json()['run_id']

        headers = {'Idempotency-Key': 'artifact-key'}
        a = client.post(
            f'/v1/runs/{run_id}/artifacts',
            json={'kind': 'log', 'title': 'log1', 'content': 'hello', 'metadata': {}},
            headers=headers,
        )
        b = client.post(
            f'/v1/runs/{run_id}/artifacts',
            json={'kind': 'log', 'title': 'log2', 'content': 'hello2', 'metadata': {}},
            headers=headers,
        )
        assert a.status_code == 200
        assert b.status_code == 200
        assert a.json()['artifact']['artifact_id'] == b.json()['artifact']['artifact_id']


def test_artifact_too_large_rejected():
    client, _ = _client(max_artifact_bytes=10)
    with client:
        run_id = client.post('/v1/runs', json={'goal': 'big artifact'}).json()['run_id']
        res = client.post(
            f'/v1/runs/{run_id}/artifacts',
            json={'kind': 'output', 'title': 'too big', 'content': '01234567890', 'metadata': {}},
        )
        assert res.status_code == 413


def test_invalid_status_transition_returns_409():
    client, _ = _client()
    with client:
        run_id = client.post('/v1/runs', json={'goal': 'transition'}).json()['run_id']
        # queued -> completed is invalid in this backend
        res = client.post(f'/v1/runs/{run_id}/complete', json={'summary': 'done'})
        assert res.status_code == 409


def test_sse_disconnect_service_path():
    _, svc = _client()
    created = svc.create_run(__import__('run_models').RunCreateRequest(goal='sse disconnect'))
    q = svc.subscribe(created.run_id)
    svc.unsubscribe(created.run_id, q)
    step = svc.append_step(
        created.run_id,
        __import__('run_models').StepCreateRequest(type='plan', status='running', title='after disconnect', details={}),
    )
    assert step.status == 'running'
