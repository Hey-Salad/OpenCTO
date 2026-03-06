import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
  DEFAULT_BASE_BRANCH,
  DEFAULT_REPO_FULL_NAME,
  DEFAULT_REPO_URL,
  DEFAULT_RUN_COMMAND,
  DEFAULT_TARGET_BRANCH_PREFIX
} from '@/config/env';
import { normalizeRunEvent } from '@/launchpad/eventNormalizer';
import {
  initialLaunchpadSessionUiState,
  reduceLaunchpadSessionUiState
} from '@/launchpad/sessionFlow';
import { useChatContext } from '@/state/ChatContext';
import { useAuthContext } from '@/state/AuthContext';
import { useRealtime } from './useRealtime';
import { ChatMessage, CodebaseRun, RunStatus } from '@/types/models';
import { createId } from '@/utils/id';

const cancellableStatuses = new Set<RunStatus>(['queued', 'in_progress']);

export const useLaunchpad = () => {
  const { messages, error, appendMessage, sendTextMessage } = useChatContext();
  const { api } = useAuthContext();
  const lastTranscriptRef = useRef<{ role: 'USER' | 'ASSISTANT'; text: string } | null>(null);
  const handleRealtimeTranscript = useCallback(
    (event: { role: 'USER' | 'ASSISTANT'; text: string }) => {
      const trimmed = event.text.trim();
      if (!trimmed) {
        return;
      }
      const previous = lastTranscriptRef.current;
      if (previous && previous.role === event.role && previous.text === trimmed) {
        return;
      }
      lastTranscriptRef.current = { role: event.role, text: trimmed };
      void appendMessage({
        id: createId('rt'),
        role: event.role,
        kind: 'speech',
        content: trimmed,
        metadata: { title: 'Transcript' }
      });
    },
    [appendMessage]
  );
  const realtime = useRealtime({ onTranscript: handleRealtimeTranscript });
  const seenRunEventsRef = useRef(new Set<string>());
  const streamAbortRef = useRef<AbortController | null>(null);
  const lastSeqRef = useRef(0);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [activeRun, setActiveRun] = useState<CodebaseRun | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [sessionUiState, dispatchSessionUi] = useReducer(
    reduceLaunchpadSessionUiState,
    initialLaunchpadSessionUiState
  );

  const stopRunPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const stopRunStream = useCallback(() => {
    if (streamAbortRef.current) {
      streamAbortRef.current.abort();
      streamAbortRef.current = null;
    }
  }, []);

  const pollRun = useCallback(
    async (runId: string) => {
      try {
        const run = await api.runs.getRunById(api.client, runId);
        setActiveRun(run);

        const events = await api.runs.getRunEvents(api.client, runId);
        for (const event of events) {
          if (seenRunEventsRef.current.has(event.id)) {
            continue;
          }
          seenRunEventsRef.current.add(event.id);
          const normalized = normalizeRunEvent(event);
          await appendMessage({
            id: `run_event_${event.id}`,
            role: 'TOOL',
            kind: normalized.kind,
            content: normalized.content,
            metadata: normalized.metadata
          });
          if (typeof event.seq === 'number') {
            lastSeqRef.current = Math.max(lastSeqRef.current, event.seq);
          }
        }

        if (!cancellableStatuses.has(run.status)) {
          stopRunStream();
          stopRunPolling();
          await appendMessage({
            id: `run_terminal_${run.id}`,
            role: 'TOOL',
            kind: 'artifact',
            content: `Run ${run.status}`,
            metadata: {
              title: 'Launchpad Run',
              runId: run.id
            }
          });
        }
      } catch {
        setRunError('Unable to refresh launchpad run.');
      }
    },
    [api, appendMessage, stopRunPolling, stopRunStream]
  );

  const startRunStream = useCallback(
    async (runId: string) => {
      stopRunStream();
      const controller = new AbortController();
      streamAbortRef.current = controller;

      try {
        await api.runs.streamRunEvents(api.client, runId, {
          signal: controller.signal,
          afterSeq: lastSeqRef.current,
          onEvents: (events, lastSeq) => {
            lastSeqRef.current = Math.max(lastSeqRef.current, lastSeq);
            for (const event of events) {
              if (seenRunEventsRef.current.has(event.id)) {
                continue;
              }
              seenRunEventsRef.current.add(event.id);
              const normalized = normalizeRunEvent(event);
              void appendMessage({
                id: `run_event_${event.id}`,
                role: 'TOOL',
                kind: normalized.kind,
                content: normalized.content,
                metadata: normalized.metadata
              });
            }
          },
          onRun: (run) => {
            setActiveRun(run);
            if (!cancellableStatuses.has(run.status)) {
              stopRunStream();
              stopRunPolling();
            }
          },
          onError: (message) => {
            setRunError(message || 'Run stream error. Falling back to polling.');
          }
        });
      } catch {
        setRunError('Run stream unavailable. Falling back to polling.');
        stopRunPolling();
        pollTimerRef.current = setInterval(() => {
          void pollRun(runId);
        }, 4000);
      }
    },
    [api, appendMessage, pollRun, stopRunPolling, stopRunStream]
  );

  const startRun = useCallback(
    async (prompt: string) => {
      if (!DEFAULT_REPO_URL) {
        setRunError('Missing EXPO_PUBLIC_DEFAULT_REPO_URL. Configure a repository before creating runs.');
        return;
      }
      try {
        const run = await api.runs.createRun(api.client, {
          repoUrl: DEFAULT_REPO_URL,
          repoFullName: DEFAULT_REPO_FULL_NAME || undefined,
          baseBranch: DEFAULT_BASE_BRANCH,
          targetBranch: `${DEFAULT_TARGET_BRANCH_PREFIX}-${Date.now().toString().slice(-6)}`,
          commands: [DEFAULT_RUN_COMMAND]
        });
        setActiveRun(run);
        setRunError(null);
        seenRunEventsRef.current = new Set();
        lastSeqRef.current = 0;

        await appendMessage({
          id: `run_start_${run.id}`,
          role: 'TOOL',
          kind: 'plan',
          content: `Launchpad started run ${run.id.slice(0, 8)} for prompt: ${prompt.slice(0, 120)}`,
          metadata: {
            title: 'Launchpad Run',
            runId: run.id
          }
        });

        stopRunPolling();
        await startRunStream(run.id);
        await pollRun(run.id);
      } catch {
        setRunError('Unable to start launchpad run.');
      }
    },
    [api, appendMessage, pollRun, startRunStream, stopRunPolling]
  );

  const sendPrompt = useCallback(
    async (content: string) => {
      await sendTextMessage(content);
      if (realtime.fallbackToText || realtime.state === 'idle' || realtime.state === 'ended' || realtime.state === 'error') {
        await startRun(content);
      }
    },
    [realtime.fallbackToText, realtime.state, sendTextMessage, startRun]
  );

  const cancelRun = useCallback(async () => {
    if (!activeRun || !cancellableStatuses.has(activeRun.status)) {
      return;
    }
    try {
      await api.runs.cancelRun(api.client, activeRun.id);
      await pollRun(activeRun.id);
    } catch {
      setRunError('Unable to cancel launchpad run.');
    }
  }, [activeRun, api, pollRun]);

  useEffect(() => {
    return () => {
      stopRunStream();
      stopRunPolling();
    };
  }, [stopRunPolling, stopRunStream]);

  useEffect(() => {
    const isLive = ['connecting', 'live', 'reconnecting'].includes(realtime.state);
    if (!isLive) {
      dispatchSessionUi({ type: 'STOP' });
    }
  }, [realtime.state]);

  const startLaunchpad = async () => {
    if (!['connecting', 'live', 'reconnecting'].includes(realtime.state)) {
      await appendMessage({
        id: createId('launchpad'),
        role: 'TOOL',
        kind: 'artifact',
        content: 'Launchpad voice session started.',
        metadata: { title: 'Session' }
      });
      void realtime.start();
      dispatchSessionUi({ type: 'START' });
    }
  };

  const stopLaunchpad = () => {
    stopRunStream();
    realtime.stop();
    dispatchSessionUi({ type: 'STOP' });
  };

  const toggleKeyboard = () => {
    dispatchSessionUi({ type: 'TOGGLE_KEYBOARD' });
  };

  return {
    messages: messages as ChatMessage[],
    error: error ?? runError,
    realtime,
    keyboardOpen: sessionUiState.keyboardOpen,
    activeRun,
    onSendPrompt: sendPrompt,
    onStartLaunchpad: startLaunchpad,
    onStopLaunchpad: stopLaunchpad,
    onToggleKeyboard: toggleKeyboard,
    onCancelRun: cancelRun,
    canCancelRun: Boolean(activeRun && cancellableStatuses.has(activeRun.status)),
    isSessionLive: ['connecting', 'live', 'reconnecting'].includes(realtime.state)
  };
};
