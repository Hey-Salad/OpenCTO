import { CodebaseRunEvent, LaunchpadMessageKind } from '@/types/models';

export interface NormalizedLaunchpadEvent {
  kind: LaunchpadMessageKind;
  content: string;
  metadata: {
    title: string;
    runId: string;
    eventId: string;
    language?: string;
    command?: string;
    exitCode?: number;
    source?: string;
  };
}

const PLAN_TYPES = ['plan', 'planning'];
const CODE_TYPES = ['code', 'diff', 'patch'];
const COMMAND_TYPES = ['command', 'exec', 'shell'];
const OUTPUT_TYPES = ['output', 'stdout', 'stderr', 'log'];
const ARTIFACT_TYPES = ['artifact', 'file'];

function includesAny(type: string, patterns: string[]): boolean {
  return patterns.some((pattern) => type.includes(pattern));
}

function extractStructuredPayload(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

function chooseKind(type: string, message: string): LaunchpadMessageKind {
  const normalizedType = type.toLowerCase();
  const lowerMessage = message.toLowerCase();

  if (includesAny(normalizedType, PLAN_TYPES) || lowerMessage.startsWith('[plan]')) {
    return 'plan';
  }
  if (includesAny(normalizedType, CODE_TYPES) || message.includes('```') || lowerMessage.startsWith('[code]')) {
    return 'code';
  }
  if (includesAny(normalizedType, COMMAND_TYPES) || lowerMessage.startsWith('[cmd]')) {
    return 'command';
  }
  if (includesAny(normalizedType, OUTPUT_TYPES) || lowerMessage.startsWith('[out]')) {
    return 'output';
  }
  if (includesAny(normalizedType, ARTIFACT_TYPES) || lowerMessage.startsWith('[artifact]')) {
    return 'artifact';
  }

  return 'artifact';
}

function normalizeMessage(kind: LaunchpadMessageKind, raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return 'No details provided.';
  }
  if (kind === 'command') {
    return trimmed.replace(/^\[(cmd|command)\]\s*/i, '');
  }
  if (kind === 'code') {
    return trimmed.replace(/^\[code\]\s*/i, '');
  }
  if (kind === 'plan') {
    return trimmed.replace(/^\[plan\]\s*/i, '');
  }
  if (kind === 'output') {
    return trimmed.replace(/^\[(out|output)\]\s*/i, '');
  }
  return trimmed.replace(/^\[artifact\]\s*/i, '');
}

function titleFromType(type: string): string {
  const clean = type.replace(/[._]/g, ' ').trim();
  if (!clean) {
    return 'Run event';
  }
  return clean
    .split(/\s+/)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
}

export function normalizeRunEvent(event: CodebaseRunEvent): NormalizedLaunchpadEvent {
  const payloadFromMessage = extractStructuredPayload(event.message);
  const payload = event.payload ?? payloadFromMessage ?? {};

  const type = event.type ?? 'run.event';
  const rawContent =
    (typeof payload.message === 'string' ? payload.message : event.message) ||
    (typeof payload.text === 'string' ? payload.text : '') ||
    '';

  const kind = chooseKind(type, rawContent);

  const command = typeof payload.command === 'string' ? payload.command : undefined;
  const language = typeof payload.language === 'string' ? payload.language : undefined;
  const source = typeof payload.source === 'string' ? payload.source : undefined;
  const exitCode = typeof payload.exitCode === 'number' ? payload.exitCode : undefined;

  return {
    kind,
    content: normalizeMessage(kind, rawContent),
    metadata: {
      title: titleFromType(type),
      runId: event.runId,
      eventId: event.id,
      command,
      language,
      source,
      exitCode
    }
  };
}
