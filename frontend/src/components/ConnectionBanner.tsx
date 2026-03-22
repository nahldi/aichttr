import { useChatStore } from '../stores/chatStore';

export function ConnectionBanner() {
  const wsState = useChatStore((s) => s.wsState);

  if (wsState === 'connected') return null;

  return (
    <div className={`fixed top-0 left-0 right-0 z-[60] flex items-center justify-center gap-2 py-2 text-xs font-medium transition-all ${
      wsState === 'disconnected'
        ? 'bg-red-500/90 text-white'
        : 'bg-yellow-500/90 text-black'
    }`}>
      <span className="material-symbols-outlined text-sm">
        {wsState === 'disconnected' ? 'cloud_off' : 'sync'}
      </span>
      {wsState === 'disconnected' ? 'Connection lost. Trying to reconnect...' : 'Reconnecting...'}
    </div>
  );
}
