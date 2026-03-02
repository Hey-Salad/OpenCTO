from __future__ import annotations

import json
import os
import sqlite3
import threading
from abc import ABC, abstractmethod

from run_models import ArtifactRecord, RunRecord, StepRecord


class RunStore(ABC):
    @abstractmethod
    def create_run(self, run: RunRecord) -> None:
        raise NotImplementedError

    @abstractmethod
    def get_run(self, run_id: str) -> RunRecord | None:
        raise NotImplementedError

    @abstractmethod
    def update_run(self, run: RunRecord) -> None:
        raise NotImplementedError

    @abstractmethod
    def list_steps(self, run_id: str) -> list[StepRecord]:
        raise NotImplementedError

    @abstractmethod
    def append_step(self, step: StepRecord) -> None:
        raise NotImplementedError

    @abstractmethod
    def list_artifacts(self, run_id: str) -> list[ArtifactRecord]:
        raise NotImplementedError

    @abstractmethod
    def append_artifact(self, artifact: ArtifactRecord) -> None:
        raise NotImplementedError

    @abstractmethod
    def get_idempotent(self, scope: str, key: str) -> dict | None:
        raise NotImplementedError

    @abstractmethod
    def set_idempotent(self, scope: str, key: str, payload: dict) -> None:
        raise NotImplementedError


class InMemoryRunStore(RunStore):
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._runs: dict[str, RunRecord] = {}
        self._steps: dict[str, list[StepRecord]] = {}
        self._artifacts: dict[str, list[ArtifactRecord]] = {}
        self._idempotency: dict[tuple[str, str], dict] = {}

    def create_run(self, run: RunRecord) -> None:
        with self._lock:
            self._runs[run.run_id] = run
            self._steps.setdefault(run.run_id, [])
            self._artifacts.setdefault(run.run_id, [])

    def get_run(self, run_id: str) -> RunRecord | None:
        with self._lock:
            return self._runs.get(run_id)

    def update_run(self, run: RunRecord) -> None:
        with self._lock:
            self._runs[run.run_id] = run

    def list_steps(self, run_id: str) -> list[StepRecord]:
        with self._lock:
            return list(self._steps.get(run_id, []))

    def append_step(self, step: StepRecord) -> None:
        with self._lock:
            self._steps.setdefault(step.run_id, []).append(step)

    def list_artifacts(self, run_id: str) -> list[ArtifactRecord]:
        with self._lock:
            return list(self._artifacts.get(run_id, []))

    def append_artifact(self, artifact: ArtifactRecord) -> None:
        with self._lock:
            self._artifacts.setdefault(artifact.run_id, []).append(artifact)

    def get_idempotent(self, scope: str, key: str) -> dict | None:
        with self._lock:
            return self._idempotency.get((scope, key))

    def set_idempotent(self, scope: str, key: str, payload: dict) -> None:
        with self._lock:
            self._idempotency[(scope, key)] = payload


class SQLiteRunStore(RunStore):
    def __init__(self, db_path: str) -> None:
        self._db_path = db_path
        self._lock = threading.RLock()
        self._init_schema()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_schema(self) -> None:
        with self._connect() as conn:
            conn.executescript(
                '''
                CREATE TABLE IF NOT EXISTS runs (
                  run_id TEXT PRIMARY KEY,
                  status TEXT NOT NULL,
                  created_at TEXT NOT NULL,
                  updated_at TEXT NOT NULL,
                  input TEXT NOT NULL,
                  voice_model TEXT,
                  reasoning_model TEXT,
                  summary TEXT,
                  error TEXT
                );
                CREATE TABLE IF NOT EXISTS steps (
                  step_id TEXT PRIMARY KEY,
                  run_id TEXT NOT NULL,
                  type TEXT NOT NULL,
                  status TEXT NOT NULL,
                  started_at TEXT NOT NULL,
                  ended_at TEXT,
                  title TEXT NOT NULL,
                  details_json TEXT NOT NULL,
                  FOREIGN KEY(run_id) REFERENCES runs(run_id)
                );
                CREATE INDEX IF NOT EXISTS idx_steps_run_id ON steps(run_id);
                CREATE TABLE IF NOT EXISTS artifacts (
                  artifact_id TEXT PRIMARY KEY,
                  run_id TEXT NOT NULL,
                  step_id TEXT,
                  kind TEXT NOT NULL,
                  title TEXT NOT NULL,
                  content TEXT NOT NULL,
                  metadata_json TEXT NOT NULL,
                  created_at TEXT NOT NULL,
                  FOREIGN KEY(run_id) REFERENCES runs(run_id)
                );
                CREATE INDEX IF NOT EXISTS idx_artifacts_run_id ON artifacts(run_id);
                CREATE TABLE IF NOT EXISTS idempotency (
                  scope TEXT NOT NULL,
                  key TEXT NOT NULL,
                  payload_json TEXT NOT NULL,
                  PRIMARY KEY(scope, key)
                );
                '''
            )

    def create_run(self, run: RunRecord) -> None:
        with self._lock, self._connect() as conn:
            conn.execute(
                '''
                INSERT INTO runs (run_id, status, created_at, updated_at, input, voice_model, reasoning_model, summary, error)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''',
                (
                    run.run_id,
                    run.status,
                    run.created_at,
                    run.updated_at,
                    run.input,
                    run.voice_model,
                    run.reasoning_model,
                    run.summary,
                    run.error,
                ),
            )

    def get_run(self, run_id: str) -> RunRecord | None:
        with self._lock, self._connect() as conn:
            row = conn.execute('SELECT * FROM runs WHERE run_id = ?', (run_id,)).fetchone()
            return RunRecord(**dict(row)) if row else None

    def update_run(self, run: RunRecord) -> None:
        with self._lock, self._connect() as conn:
            conn.execute(
                '''
                UPDATE runs
                SET status = ?, updated_at = ?, summary = ?, error = ?
                WHERE run_id = ?
                ''',
                (run.status, run.updated_at, run.summary, run.error, run.run_id),
            )

    def list_steps(self, run_id: str) -> list[StepRecord]:
        with self._lock, self._connect() as conn:
            rows = conn.execute(
                'SELECT * FROM steps WHERE run_id = ? ORDER BY started_at ASC',
                (run_id,),
            ).fetchall()
            out: list[StepRecord] = []
            for row in rows:
                item = dict(row)
                item['details'] = json.loads(item.pop('details_json') or '{}')
                out.append(StepRecord(**item))
            return out

    def append_step(self, step: StepRecord) -> None:
        with self._lock, self._connect() as conn:
            conn.execute(
                '''
                INSERT INTO steps (step_id, run_id, type, status, started_at, ended_at, title, details_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''',
                (
                    step.step_id,
                    step.run_id,
                    step.type,
                    step.status,
                    step.started_at,
                    step.ended_at,
                    step.title,
                    json.dumps(step.details),
                ),
            )

    def list_artifacts(self, run_id: str) -> list[ArtifactRecord]:
        with self._lock, self._connect() as conn:
            rows = conn.execute(
                'SELECT * FROM artifacts WHERE run_id = ? ORDER BY created_at ASC',
                (run_id,),
            ).fetchall()
            out: list[ArtifactRecord] = []
            for row in rows:
                item = dict(row)
                item['metadata'] = json.loads(item.pop('metadata_json') or '{}')
                out.append(ArtifactRecord(**item))
            return out

    def append_artifact(self, artifact: ArtifactRecord) -> None:
        with self._lock, self._connect() as conn:
            conn.execute(
                '''
                INSERT INTO artifacts (artifact_id, run_id, step_id, kind, title, content, metadata_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''',
                (
                    artifact.artifact_id,
                    artifact.run_id,
                    artifact.step_id,
                    artifact.kind,
                    artifact.title,
                    artifact.content,
                    json.dumps(artifact.metadata),
                    artifact.created_at,
                ),
            )

    def get_idempotent(self, scope: str, key: str) -> dict | None:
        with self._lock, self._connect() as conn:
            row = conn.execute(
                'SELECT payload_json FROM idempotency WHERE scope = ? AND key = ?',
                (scope, key),
            ).fetchone()
            if not row:
                return None
            return json.loads(row['payload_json'])

    def set_idempotent(self, scope: str, key: str, payload: dict) -> None:
        with self._lock, self._connect() as conn:
            conn.execute(
                '''
                INSERT OR REPLACE INTO idempotency (scope, key, payload_json)
                VALUES (?, ?, ?)
                ''',
                (scope, key, json.dumps(payload)),
            )


def create_store() -> RunStore:
    db_path = os.getenv('RUNS_DB_PATH', '').strip()
    if db_path:
        return SQLiteRunStore(db_path)
    return InMemoryRunStore()
