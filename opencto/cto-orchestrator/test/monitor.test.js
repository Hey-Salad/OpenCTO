import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveSignals } from '../src/monitor.js';

test('deriveSignals returns no incidents when metrics are healthy', () => {
  const incidents = deriveSignals({
    cpu: { load_pct_1m: 22 },
    memory: { used_pct: 51 },
    disk: { used_pct: 61 },
  });
  assert.equal(incidents.length, 0);
});

test('deriveSignals returns all expected incidents when limits exceeded', () => {
  const incidents = deriveSignals({
    cpu: { load_pct_1m: 96, load_1m: 11, cores: 8 },
    memory: { used_pct: 97 },
    disk: { used_pct: 98 },
  });
  assert.deepEqual(
    incidents.map((item) => item.key).sort(),
    ['cpu_high', 'disk_high', 'memory_high']
  );
  const cpuIncident = incidents.find((item) => item.key === 'cpu_high');
  assert.equal(cpuIncident?.severity, 'critical');
});
