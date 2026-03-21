import type { ActivityEvent } from '../types';
import { timeAgo } from '../lib/timeago';

interface ActivityTimelineProps {
  events: ActivityEvent[];
  maxItems?: number;
}

const ICONS: Record<string, string> = {
  message: 'chat_bubble',
  agent_join: 'login',
  agent_leave: 'logout',
  job_created: 'add_task',
  job_done: 'task_alt',
  rule_proposed: 'shield',
  channel_created: 'tag',
  error: 'error',
};

const COLORS: Record<string, string> = {
  message: '#a78bfa',
  agent_join: '#4ade80',
  agent_leave: '#f87171',
  job_created: '#fb923c',
  job_done: '#4ade80',
  rule_proposed: '#38bdf8',
  channel_created: '#c084fc',
  error: '#f87171',
};

export function ActivityTimeline({ events, maxItems = 20 }: ActivityTimelineProps) {
  const displayed = events.slice(-maxItems).reverse();

  if (displayed.length === 0) {
    return (
      <div className="text-center py-6 text-[11px] text-on-surface-variant/30">
        No recent activity
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {displayed.map((event) => (
        <div key={event.id} className="flex items-start gap-2.5 py-1.5 px-2 rounded-lg hover:bg-surface-container/20 transition-colors">
          <span
            className="material-symbols-outlined text-[14px] mt-0.5 shrink-0"
            style={{ color: COLORS[event.type] || '#888' }}
          >
            {ICONS[event.type] || 'info'}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-on-surface-variant/60 leading-relaxed">{event.text}</div>
            <div className="text-[9px] text-on-surface-variant/25 mt-0.5">{timeAgo(event.timestamp)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
