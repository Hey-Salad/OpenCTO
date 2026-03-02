from fastapi import HTTPException

from run_models import CompleteRunRequest, RunCreateRequest, StepCreateRequest
from run_service import RunService
from run_store import InMemoryRunStore


def test_run_transition_validation():
    svc = RunService(InMemoryRunStore())
    created = svc.create_run(RunCreateRequest(goal='ship feature'))

    with __import__('pytest').raises(HTTPException) as exc:
        svc.complete_run(created.run_id, CompleteRunRequest(summary='done'))
    assert exc.value.status_code == 409


def test_step_moves_queued_to_running():
    svc = RunService(InMemoryRunStore())
    created = svc.create_run(RunCreateRequest(goal='ship feature'))

    svc.append_step(
        created.run_id,
        StepCreateRequest(type='plan', status='running', title='plan work', details={}),
    )

    bundle = svc.get_bundle(created.run_id)
    assert bundle.run.status == 'running'
    assert len(bundle.steps) == 1
