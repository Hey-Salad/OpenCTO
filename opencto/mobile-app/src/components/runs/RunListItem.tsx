import { ListItem } from '@/components/ui';
import { CodebaseRun } from '@/types/models';
import { RunStatusBadge } from './RunStatusBadge';

interface RunListItemProps {
  run: CodebaseRun;
  onPress: () => void;
}

export const RunListItem = ({ run, onPress }: RunListItemProps) => (
  <ListItem
    title={run.title}
    subtitle={`${run.repo ?? 'Repo'} • ${new Date(run.updatedAt).toLocaleString()}`}
    right={<RunStatusBadge status={run.status} />}
    onPress={onPress}
  />
);
