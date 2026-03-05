import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTriage } from '../src/openai.js';

test('normalizeTriage sanitizes unknown fields', () => {
  const triage = normalizeTriage(
    {
      summary: 'Keep calm and restart worker pool.',
      priority: 'nope',
      actions: [
        { type: 'wrong_type', text: 'x' },
        { type: 'notify_only', text: 'Escalate if sustained for 10 minutes.' },
      ],
    },
    'high',
    2
  );

  assert.equal(triage.priority, 'high');
  assert.equal(triage.actions[0].type, 'notify_only');
  assert.equal(triage.actions.length, 2);
});

test('normalizeTriage returns fallback when payload is invalid', () => {
  const triage = normalizeTriage(null, 'critical', 2);
  assert.equal(triage.priority, 'critical');
  assert.equal(triage.actions.length, 1);
});
