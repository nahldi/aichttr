import { useState, useEffect, useRef } from 'react';

export function ConnectionBanner() {
  const [status, setStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('connected');
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const check = () => {
      // Check if the WebSocket is connected by pinging the backend
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${proto}//${window.location.host}/ws`;

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setStatus('connected');
          ws.close();
        };
        ws.onerror = () => {
          setStatus('disconnected');
        };
        ws.onclose = () => {
          // Don't change status on intentional close
        };
      } catch {
        setStatus('disconnected');
      }
    };

    // Poll connection status every 10s
    const interval = setInterval(check, 10000);
    check();

    return () => {
      clearInterval(interval);
      if (retryRef.current) clearTimeout(retryRef.current);
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
      }
    };
  }, []);

  if (status === 'connected') return null;

  return (
    <div className={`fixed top-0 left-0 right-0 z-[60] flex items-center justify-center gap-2 py-2 text-xs font-medium transition-all ${
      status === 'disconnected'
        ? 'bg-red-500/90 text-white'
        : 'bg-yellow-500/90 text-black'
    }`}>
      <span className="material-symbols-outlined text-sm">
        {status === 'disconnected' ? 'cloud_off' : 'sync'}
      </span>
      {status === 'disconnected' ? 'Connection lost. Trying to reconnect...' : 'Reconnecting...'}
    </div>
  );
}
