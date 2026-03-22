export function timeAgo(timestamp: number, options?: { timezone?: string; timeFormat?: '12h' | '24h' }): string {
  const now = Date.now() / 1000;
  const diff = now - timestamp;

  if (diff < 10) return 'Just now';
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;

  const date = new Date(timestamp * 1000);
  const tz = options?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const hour12 = options?.timeFormat !== '24h';

  try {
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12,
      timeZone: tz,
    });
  } catch {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}`;
  }
}

export function formatTimestamp(timestamp: number, options?: { timezone?: string; timeFormat?: '12h' | '24h' }): string {
  const date = new Date(timestamp * 1000);
  const tz = options?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const hour12 = options?.timeFormat !== '24h';

  try {
    return date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12,
      timeZone: tz,
    });
  } catch {
    return date.toLocaleTimeString();
  }
}
