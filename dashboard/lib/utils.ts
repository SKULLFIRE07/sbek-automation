export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

export function timeAgo(ts: number | string): string {
  const now = Date.now();
  const then = typeof ts === 'string' ? new Date(ts).getTime() : ts;
  const diffMs = now - then;

  if (diffMs < 0) return 'just now';

  const seconds = Math.floor(diffMs / 1_000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len) + '...';
}

export function statusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'ok':
    case 'healthy':
    case 'active':
    case 'completed':
      return 'bg-green-500';
    case 'error':
    case 'failed':
    case 'down':
      return 'bg-red-500';
    case 'warning':
    case 'degraded':
    case 'stalled':
      return 'bg-yellow-500';
    case 'pending':
    case 'waiting':
    case 'queued':
      return 'bg-gray-400';
    default:
      return 'bg-gray-400';
  }
}
