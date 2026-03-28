/**
 * Agent Cockpit — in-app agent workspace viewer.
 * Tabs: Terminal | Files | Activity
 * Shows live terminal output, workspace file tree, and agent activity timeline.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useChatStore } from '../stores/chatStore';
import { api } from '../lib/api';
import { AgentIcon } from './AgentIcon';
import { toast } from './Toast';
import type { Agent, ActivityEvent } from '../types';

// ── Terminal Tab ──────────────────────────────────────────────────────

function CockpitTerminal({ agent }: { agent: Agent }) {
  const [output, setOutput] = useState('');
  const [active, setActive] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const preRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    let cancelled = false;
    const abort = new AbortController();
    const poll = async () => {
      while (!cancelled) {
        try {
          const res = await fetch(
            `/api/agents/${encodeURIComponent(agent.name)}/terminal?lines=80`,
            { signal: abort.signal },
          );
          const data = await res.json();
          if (!cancelled) {
            setOutput(data.output || '');
            setActive(data.active ?? false);
          }
        } catch {
          if (cancelled) break;
        }
        await new Promise(r => setTimeout(r, 1000));
      }
    };
    poll();
    return () => { cancelled = true; abort.abort(); };
  }, [agent.name]);

  useEffect(() => {
    if (autoScroll && preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [output, autoScroll]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 flex items-center justify-between border-b border-outline-variant/10 shrink-0">
        <div className="flex items-center gap-2">
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
            active ? 'bg-green-500/15 text-green-400' : 'bg-surface-container-highest text-on-surface-variant/30'
          }`}>
            {active ? 'LIVE' : 'INACTIVE'}
          </span>
          <span className="text-[10px] font-mono text-on-surface-variant/40">
            ghostlink-{agent.name}
          </span>
        </div>
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          className={`text-[10px] px-2 py-0.5 rounded-md transition-colors ${
            autoScroll ? 'bg-primary/15 text-primary' : 'text-on-surface-variant/30 hover:text-on-surface-variant/50'
          }`}
        >
          {autoScroll ? 'Auto-scroll ON' : 'Auto-scroll OFF'}
        </button>
      </div>
      <pre
        ref={preRef}
        className="flex-1 overflow-auto p-3 font-mono text-[11px] leading-relaxed text-green-300/80 whitespace-pre-wrap"
        style={{ background: '#06060c' }}
      >
        {output || (active ? 'Waiting for output...' : `No active session for ${agent.name}`)}
      </pre>
    </div>
  );
}

// ── Files Tab ─────────────────────────────────────────────────────────

interface FileEntry {
  name: string;
  type: 'file' | 'directory';
  size?: number;
}

function CockpitFiles({ agent }: { agent: Agent }) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [currentPath, setCurrentPath] = useState('.');
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [viewingFile, setViewingFile] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchFiles = useCallback(async (path: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/agents/${encodeURIComponent(agent.name)}/files?path=${encodeURIComponent(path)}`);
      if (res.ok) {
        const data = await res.json();
        setFiles(data.entries || []);
        setCurrentPath(path);
        setFileContent(null);
        setViewingFile(null);
      } else {
        toast('Failed to list files', 'error');
      }
    } catch {
      toast('Failed to connect', 'error');
    }
    setLoading(false);
  }, [agent.name]);

  const openFile = useCallback(async (name: string) => {
    const path = currentPath === '.' ? name : `${currentPath}/${name}`;
    try {
      const res = await fetch(`/api/agents/${encodeURIComponent(agent.name)}/file?path=${encodeURIComponent(path)}`);
      if (res.ok) {
        const data = await res.json();
        setFileContent(data.content || '');
        setViewingFile(path);
      }
    } catch {
      toast('Failed to read file', 'error');
    }
  }, [agent.name, currentPath]);

  useEffect(() => { fetchFiles('.'); }, [fetchFiles]);

  if (viewingFile && fileContent !== null) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-3 py-2 flex items-center gap-2 border-b border-outline-variant/10 shrink-0">
          <button onClick={() => { setFileContent(null); setViewingFile(null); }} className="p-1 rounded hover:bg-surface-container-high">
            <span className="material-symbols-outlined text-sm text-on-surface-variant/50">arrow_back</span>
          </button>
          <span className="text-[11px] font-mono text-on-surface-variant/60 truncate">{viewingFile}</span>
          <button
            onClick={() => navigator.clipboard?.writeText(fileContent).then(() => toast('Copied', 'success'))}
            className="ml-auto p-1 rounded hover:bg-surface-container-high"
            title="Copy contents"
          >
            <span className="material-symbols-outlined text-sm text-on-surface-variant/40">content_copy</span>
          </button>
        </div>
        <pre className="flex-1 overflow-auto p-3 font-mono text-[11px] leading-relaxed text-on-surface/80 whitespace-pre-wrap" style={{ background: '#06060c' }}>
          {fileContent}
        </pre>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 flex items-center gap-2 border-b border-outline-variant/10 shrink-0">
        {currentPath !== '.' && (
          <button onClick={() => {
            const parent = currentPath.split('/').slice(0, -1).join('/') || '.';
            fetchFiles(parent);
          }} className="p-1 rounded hover:bg-surface-container-high">
            <span className="material-symbols-outlined text-sm text-on-surface-variant/50">arrow_back</span>
          </button>
        )}
        <span className="text-[11px] font-mono text-on-surface-variant/40 truncate">
          {agent.workspace || '~'}/{currentPath === '.' ? '' : currentPath}
        </span>
      </div>
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <span className="material-symbols-outlined animate-spin text-primary/40">progress_activity</span>
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-8 text-on-surface-variant/30 text-xs">
            {agent.state === 'offline' ? 'Agent is offline — start it to browse files' : 'No files found'}
          </div>
        ) : (
          <div className="py-1">
            {files
              .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'directory' ? -1 : 1))
              .map((f) => (
                <button
                  key={f.name}
                  onClick={() => f.type === 'directory' ? fetchFiles(currentPath === '.' ? f.name : `${currentPath}/${f.name}`) : openFile(f.name)}
                  className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-surface-container-high/50 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm" style={{ color: f.type === 'directory' ? '#60a5fa' : '#a78bfa' }}>
                    {f.type === 'directory' ? 'folder' : 'description'}
                  </span>
                  <span className="text-[11px] text-on-surface/70 truncate">{f.name}</span>
                  {f.size !== undefined && f.type === 'file' && (
                    <span className="text-[9px] text-on-surface-variant/25 ml-auto">
                      {f.size < 1024 ? `${f.size}B` : f.size < 1048576 ? `${(f.size / 1024).toFixed(1)}K` : `${(f.size / 1048576).toFixed(1)}M`}
                    </span>
                  )}
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Activity Tab ──────────────────────────────────────────────────────

function CockpitActivity({ agent }: { agent: Agent }) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    let cancelled = false;
    const fetchActivity = async () => {
      try {
        const data = await api.getActivity();
        if (!cancelled) {
          // Filter to this agent's events
          const agentEvents = (data.events || []).filter(
            (e: ActivityEvent) => e.agent === agent.name || e.text?.includes(agent.name)
          );
          setEvents(agentEvents.slice(0, 50));
        }
      } catch { /* ignored */ }
    };
    fetchActivity();
    const interval = setInterval(fetchActivity, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [agent.name]);

  const iconForType = (type: string) => {
    switch (type) {
      case 'message': return 'chat';
      case 'agent_join': return 'login';
      case 'agent_leave': return 'logout';
      case 'job_created': return 'task';
      case 'job_done': return 'task_alt';
      case 'error': return 'error';
      default: return 'info';
    }
  };

  return (
    <div className="flex-1 overflow-auto">
      {events.length === 0 ? (
        <div className="text-center py-8 text-on-surface-variant/30 text-xs">
          No recent activity for {agent.label || agent.name}
        </div>
      ) : (
        <div className="py-2">
          {events.map((e) => (
            <div key={e.id} className="px-3 py-2 flex items-start gap-2 hover:bg-surface-container-high/30 transition-colors">
              <span className="material-symbols-outlined text-sm text-on-surface-variant/40 mt-0.5">{iconForType(e.type)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-on-surface/70 leading-snug">{e.text}</p>
                <p className="text-[9px] text-on-surface-variant/25 mt-0.5">
                  {new Date(e.timestamp * 1000).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Cockpit Panel ────────────────────────────────────────────────

const TABS = ['terminal', 'files', 'activity'] as const;
type CockpitTab = typeof TABS[number];

const TAB_ICONS: Record<CockpitTab, string> = {
  terminal: 'terminal',
  files: 'folder_open',
  activity: 'timeline',
};

export function AgentCockpit() {
  const agents = useChatStore((s) => s.agents);
  const cockpitAgent = useChatStore((s) => s.cockpitAgent);
  const [tab, setTab] = useState<CockpitTab>('terminal');

  const agent = agents.find((a) => a.name === cockpitAgent) || null;

  if (!agent) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-3 border-b border-outline-variant/10">
          <h2 className="text-sm font-semibold text-on-surface/80">Agent Cockpit</h2>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4">
          <span className="material-symbols-outlined text-3xl text-on-surface-variant/20">monitor</span>
          <p className="text-xs text-on-surface-variant/40 text-center">
            Click an agent in the bar above, then open Cockpit to see their live workspace
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Agent header */}
      <div className="px-3 py-2.5 border-b border-outline-variant/10 flex items-center gap-2.5 shrink-0">
        <AgentIcon base={agent.base} color={agent.color} size={20} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-on-surface/80 truncate">{agent.label || agent.name}</p>
          <p className="text-[9px] text-on-surface-variant/40">
            {agent.state === 'active' ? 'Working' : agent.state === 'idle' ? 'Ready' : agent.state === 'thinking' ? 'Thinking...' : agent.state}
          </p>
        </div>
        <div
          className="w-2 h-2 rounded-full"
          style={{ background: agent.state === 'active' || agent.state === 'thinking' ? '#22c55e' : agent.state === 'idle' ? '#60a5fa' : '#6b7280' }}
        />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-outline-variant/10 shrink-0">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-medium transition-colors ${
              tab === t
                ? 'text-primary border-b-2 border-primary'
                : 'text-on-surface-variant/40 hover:text-on-surface-variant/60'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">{TAB_ICONS[t]}</span>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === 'terminal' && <CockpitTerminal agent={agent} />}
        {tab === 'files' && <CockpitFiles agent={agent} />}
        {tab === 'activity' && <CockpitActivity agent={agent} />}
      </div>
    </div>
  );
}
