import { useSyncQueue } from '@/hooks/useSyncQueue';
import type { ConnectionStatus } from '@/constants/statuses.constants';

export function useConnectionStatus(): ConnectionStatus {
  const { connectionStatus } = useSyncQueue();
  return connectionStatus;
}
