import { PropsWithChildren, createContext, useContext, useState } from 'react';
import { CodebaseRun, CodebaseRunEvent } from '@/types/models';
import { useAuthContext } from './AuthContext';

interface RunsContextValue {
  runs: CodebaseRun[];
  eventsByRunId: Record<string, CodebaseRunEvent[]>;
  loading: boolean;
  error: string | null;
  refreshRuns: () => Promise<void>;
  refreshRun: (runId: string) => Promise<CodebaseRun | null>;
  refreshRunEvents: (runId: string) => Promise<void>;
  cancelRunById: (runId: string) => Promise<void>;
}

const RunsContext = createContext<RunsContextValue | null>(null);

export const RunsProvider = ({ children }: PropsWithChildren) => {
  const { api } = useAuthContext();
  const [runs, setRuns] = useState<CodebaseRun[]>([]);
  const [eventsByRunId, setEventsByRunId] = useState<Record<string, CodebaseRunEvent[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshRuns = async () => {
    setLoading(true);
    try {
      const next = await api.runs.getRuns(api.client);
      setRuns(next);
      setError(null);
    } catch {
      setError('Failed to load runs.');
    } finally {
      setLoading(false);
    }
  };

  const refreshRun = async (runId: string) => {
    try {
      const run = await api.runs.getRunById(api.client, runId);
      setRuns((prev) => {
        const others = prev.filter((item) => item.id !== run.id);
        return [run, ...others];
      });
      setError(null);
      return run;
    } catch {
      setError('Failed to load run details.');
      return null;
    }
  };

  const refreshRunEvents = async (runId: string) => {
    try {
      const events = await api.runs.getRunEvents(api.client, runId);
      setEventsByRunId((prev) => ({
        ...prev,
        [runId]: events
      }));
      setError(null);
    } catch {
      setError('Failed to load run events.');
    }
  };

  const cancelRunById = async (runId: string) => {
    try {
      await api.runs.cancelRun(api.client, runId);
      await refreshRun(runId);
      setError(null);
    } catch {
      setError('Failed to cancel run.');
    }
  };

  return (
    <RunsContext.Provider
      value={{
        runs,
        eventsByRunId,
        loading,
        error,
        refreshRuns,
        refreshRun,
        refreshRunEvents,
        cancelRunById
      }}
    >
      {children}
    </RunsContext.Provider>
  );
};

export const useRunsContext = (): RunsContextValue => {
  const context = useContext(RunsContext);
  if (!context) {
    throw new Error('useRunsContext must be used inside RunsProvider');
  }
  return context;
};
