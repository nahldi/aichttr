import { create } from 'zustand';
import type { Message, Agent, Channel, Job, Rule, Settings, ActivityEvent } from '../types';

export type WSConnectionState = 'connected' | 'connecting' | 'disconnected';

interface ChatState {
  // Messages
  messages: Message[];
  addMessage: (msg: Message) => void;
  setMessages: (msgs: Message[]) => void;
  pinMessage: (id: number, pinned: boolean) => void;
  deleteMessages: (ids: number[]) => void;
  reactMessage: (id: number, reactions: Record<string, string[]>) => void;
  editMessage: (id: number, text: string) => void;
  bookmarkMessage: (id: number, bookmarked: boolean) => void;

  // Channels
  channels: Channel[];
  activeChannel: string;
  setChannels: (channels: Channel[]) => void;
  setActiveChannel: (name: string) => void;
  incrementUnread: (channel: string) => void;
  clearUnread: (channel: string) => void;

  // Agents
  agents: Agent[];
  setAgents: (agents: Agent[]) => void;
  typingAgents: Record<string, number>;
  setTyping: (sender: string, channel: string) => void;

  // Jobs
  jobs: Job[];
  setJobs: (jobs: Job[]) => void;
  updateJob: (job: Job) => void;

  // Rules
  rules: Rule[];
  setRules: (rules: Rule[]) => void;

  // Settings
  settings: Settings;
  updateSettings: (s: Partial<Settings>) => void;

  // Activities
  activities: ActivityEvent[];
  addActivity: (event: ActivityEvent) => void;
  setActivities: (events: ActivityEvent[]) => void;

  // Connection state
  wsState: 'connected' | 'connecting' | 'disconnected';
  setWsState: (state: 'connected' | 'connecting' | 'disconnected') => void;

  // Failed messages
  failedMessages: Message[];
  addFailedMessage: (msg: Message) => void;
  clearFailedMessages: () => void;

  // Session
  sessionStart: number;

  // UI state
  sidebarPanel: 'jobs' | 'rules' | 'settings' | null;
  setSidebarPanel: (p: 'jobs' | 'rules' | 'settings' | null) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  replyTo: Message | null;
  setReplyTo: (msg: Message | null) => void;
  chatAtBottom: boolean;
  setChatAtBottom: (v: boolean) => void;
  newMsgCount: number;
  setNewMsgCount: (v: number | ((n: number) => number)) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  addMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, msg] })),
  setMessages: (messages) => set({ messages }),
  pinMessage: (id, pinned) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, pinned } : m
      ),
    })),
  deleteMessages: (ids) =>
    set((s) => ({
      messages: s.messages.filter((m) => !ids.includes(m.id)),
    })),
  reactMessage: (id, reactions) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, reactions } : m
      ),
    })),
  editMessage: (id, text) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, text, edited: true } : m
      ),
    })),
  bookmarkMessage: (id, bookmarked) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, bookmarked } : m
      ),
    })),

  channels: [{ name: 'general', unread: 0 }],
  activeChannel: 'general',
  setChannels: (channels) => set({ channels }),
  setActiveChannel: (name) => set({ activeChannel: name }),
  incrementUnread: (channel) =>
    set((s) => ({
      channels: s.channels.map((c) =>
        c.name === channel ? { ...c, unread: c.unread + 1 } : c
      ),
    })),
  clearUnread: (channel) =>
    set((s) => ({
      channels: s.channels.map((c) =>
        c.name === channel ? { ...c, unread: 0 } : c
      ),
    })),

  agents: [],
  setAgents: (agents) => set({ agents }),
  typingAgents: {},
  setTyping: (sender, _channel) =>
    set((s) => ({
      typingAgents: { ...s.typingAgents, [sender]: Date.now() },
    })),

  jobs: [],
  setJobs: (jobs) => set({ jobs }),
  updateJob: (job) =>
    set((s) => ({
      jobs: s.jobs.map((j) => (j.id === job.id ? job : j)),
    })),

  rules: [],
  setRules: (rules) => set({ rules }),

  settings: {
    username: 'You',
    title: 'AI Chattr',
    theme: 'dark' as const,
    fontSize: 14,
    loopGuard: 4,
    notificationSounds: true,
  },
  updateSettings: (updates) =>
    set((s) => ({ settings: { ...s.settings, ...updates } })),

  activities: [],
  addActivity: (event) =>
    set((s) => ({
      activities: [...s.activities, event].slice(-200),
    })),
  setActivities: (events) => set({ activities: events }),

  wsState: 'disconnected',
  setWsState: (wsState) => set({ wsState }),

  failedMessages: [],
  addFailedMessage: (msg) =>
    set((s) => ({ failedMessages: [...s.failedMessages, msg] })),
  clearFailedMessages: () => set({ failedMessages: [] }),

  sessionStart: Date.now(),

  sidebarPanel: null,
  setSidebarPanel: (p) => set({ sidebarPanel: p }),
  mobileMenuOpen: false,
  setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),
  replyTo: null,
  setReplyTo: (msg) => set({ replyTo: msg }),
  chatAtBottom: true,
  setChatAtBottom: (v) => set({ chatAtBottom: v }),
  newMsgCount: 0,
  setNewMsgCount: (v) => set((s) => ({ newMsgCount: typeof v === 'function' ? v(s.newMsgCount) : v })),
}));
