import { Badge } from '@/components/ui';
import { RunStatus } from '@/types/models';

export const RunStatusBadge = ({ status }: { status: RunStatus }) => {
  return <Badge label={status.replace('_', ' ')} />;
};
