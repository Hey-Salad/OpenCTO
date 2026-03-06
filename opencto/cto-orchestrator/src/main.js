import { loadConfig } from './config.js';
import { initTracing } from './tracing.js';

const cfg = loadConfig();
await initTracing(cfg);
await import('./index.js');
