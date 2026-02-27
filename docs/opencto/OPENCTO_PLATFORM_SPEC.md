# @heysalad/cto - OpenCTO Platform Specification

Version: v0.3
Date: February 2026
Surfaces: CLI, Mac app, iOS app

## 1. Core Principles

- Workers execute, orchestrator decides.
- Compliance-first execution.
- Full traceability with audit events.
- Safe-by-default tool execution with risk classes.
- Codex for implementation, OpenCTO for governance.

## 2. Agent Topology

Primary agents:

- Orchestrator
- Planning
- Compliance
- Worker
- Code Review
- Incident
- Voice

Communication channel:

- MQTT via orchestrator mediation

## 3. RAG and Compliance

RAG pipeline:

- Query classification
- Dense and sparse search
- Rerank
- Context assembly with citations

Corpora include:

- Regulatory controls
- Engineering patterns
- Tool documentation
- Incident runbooks
- Team knowledge

Compliance gate model:

- Gate 1: plan check before execution
- Gate 2: diff check before commit/deploy

## 4. Data Model Scope

Schemas:

- `core`: users, auth, devices, tokens
- `jobs`: jobs, steps, workers, compliance checks, artifacts
- `rag`: corpora, documents, chunks, skills
- `telemetry`: append-only audit and metrics
- `modules`: adapter registry and installs

## 5. Tool Risk Model

- SAFE: read-only
- RESTRICTED: local/reversible write
- ELEVATED: external systems write
- DANGEROUS: production-impacting actions
- CRITICAL: irreversible high-risk actions

Human approval required for DANGEROUS and CRITICAL classes.

## 6. API and Streaming

- REST API at `api.opencto.works/api/v1`
- WebSocket job stream and codex thread stream
- Idempotency keys required for mutating requests
- RFC7807 error format for deterministic automation handling

## 7. Codex Integration Contract

- Persist codex thread ID immediately.
- Resume threads on worker crash.
- Run secret scan and compliance diff checks before commit.
- Enforce per-thread and per-job spend caps.

## 8. CI/CD and Governance

Merge requirements:

- CI pass
- Compliance pass on final diff
- Human approval
- Up-to-date branch
- Audit event persisted

DORA metrics tracked automatically from deployment and incident events.

## 9. Security Baseline

- Passkeys and device trust model
- Token scoping and expiry
- TLS + network allowlists
- Secret scanning for every generated diff
- Append-only audit logs

## 10. Non-Negotiables

- No direct mainline push bypassing governance.
- No compliance BLOCK override without documented exception.
- No plaintext secret persistence.
- No production deploy without explicit approval.
