import { useEffect, useRef } from 'react';
import { WebSocketClient } from '../lib/ws';
import { useChatStore } from '../stores/chatStore';
import { SoundManager } from '../lib/sounds';
import type { WSEvent } from '../types';

// Favicon badge — draws a red dot on the favicon when unread
let originalFavicon: string | null = null;

function setFaviconBadge(show: boolean) {
  try {
    const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
    if (!link) return;
    if (!originalFavicon) originalFavicon = link.href;

    if (!show) {
      link.href = originalFavicon;
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width || 32;
      canvas.height = img.height || 32;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      // Draw red dot in top-right corner
      ctx.beginPath();
      ctx.arc(canvas.width - 6, 6, 5, 0, 2 * Math.PI);
      ctx.fillStyle = '#ef4444';
      ctx.fill();
      link.href = canvas.toDataURL('image/png');
    };
    img.src = originalFavicon;
  } catch {
    // favicon badge is non-critical
  }
}

function showDesktopNotification(sender: string, text: string) {
  try {
    const settings = useChatStore.getState().settings;
    if (!settings.desktopNotifications) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    // Check quiet hours
    if (settings.quietHoursStart != null && settings.quietHoursEnd != null) {
      const hour = new Date().getHours();
      const start = settings.quietHoursStart;
      const end = settings.quietHoursEnd;
      if (start > end) {
        // Wraps midnight, e.g. 22-7
        if (hour >= start || hour < end) return;
      } else if (hour >= start && hour < end) {
        return;
      }
    }
    new Notification(`${sender}`, { body: text.slice(0, 120), icon: '/favicon.ico' });
  } catch {
    // desktop notification is non-critical
  }
}

export function useWebSocket() {
  const wsRef = useRef<WebSocketClient | null>(null);
  const {
    addMessage,
    incrementUnread,
    activeChannel,
    setAgents,
    setTyping,
    updateJob,
    setRules,
    setChannels,
    pinMessage,
    deleteMessages,
    reactMessage,
    addActivity,
    setWsState,
  } = useChatStore();

  useEffect(() => {
    let client: WebSocketClient;
    try {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${proto}//${window.location.host}/ws`;
      client = new WebSocketClient(wsUrl);
      wsRef.current = client;
    } catch {
      return;
    }

    // Track connection state
    const unsubState = client.onStateChange((state) => {
      setWsState(state);
    });

    const unsub = client.subscribe((event) => {
      try {
        const parsed: WSEvent = JSON.parse(event.data);
        switch (parsed.type) {
          case 'message':
            addMessage(parsed.data);
            if (parsed.data.channel !== activeChannel) {
              incrementUnread(parsed.data.channel);
            }
            // Play notification sound for agent messages when tab is blurred
            if (document.hidden && parsed.data.sender) {
              const settings = useChatStore.getState().settings;
              if (settings.notificationSounds && parsed.data.sender !== settings.username && parsed.data.sender !== 'You') {
                const agents = useChatStore.getState().agents;
                const agent = agents.find(a => a.name === parsed.data.sender);
                SoundManager.play(agent?.base || 'default');
              }
              // Desktop notification
              showDesktopNotification(parsed.data.sender, parsed.data.text);
              // Favicon badge
              setFaviconBadge(true);
            }
            break;
          case 'typing':
            setTyping(parsed.data.sender, parsed.data.channel);
            break;
          case 'status':
            setAgents(parsed.data.agents);
            break;
          case 'job_update':
            updateJob(parsed.data);
            break;
          case 'rule_update':
            setRules(parsed.data.rules);
            break;
          case 'channel_update':
            setChannels(parsed.data.channels);
            break;
          case 'pin':
            pinMessage(parsed.data.message_id, parsed.data.pinned);
            break;
          case 'delete':
            deleteMessages(parsed.data.message_ids);
            break;
          case 'reaction':
            reactMessage(parsed.data.message_id, parsed.data.reactions);
            break;
          case 'activity':
            addActivity(parsed.data);
            break;
        }
      } catch {
        // ignore parse errors or handler errors — never crash
      }
    });

    try {
      setWsState('connecting');
      client.connect();
    } catch {
      // WebSocket connection failed — app still works via REST
    }

    // Clear favicon badge when tab gains focus
    const handleFocus = () => setFaviconBadge(false);
    window.addEventListener('focus', handleFocus);

    return () => {
      try {
        unsub();
        unsubState();
        client.disconnect();
        window.removeEventListener('focus', handleFocus);
      } catch {}
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return wsRef;
}
