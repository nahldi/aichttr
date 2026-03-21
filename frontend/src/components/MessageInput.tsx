import { useState, useRef, useCallback, useMemo, type KeyboardEvent, type ClipboardEvent } from 'react';
import { useChatStore } from '../stores/chatStore';
import { useMentionAutocomplete } from '../hooks/useMentionAutocomplete';
import { api } from '../lib/api';

interface SlashCommand {
  name: string;
  description: string;
  execute: () => void;
}

export function MessageInput() {
  const [text, setText] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  const [slashIndex, setSlashIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeChannel = useChatStore((s) => s.activeChannel);
  const settings = useChatStore((s) => s.settings);
  const replyTo = useChatStore((s) => s.replyTo);
  const setReplyTo = useChatStore((s) => s.setReplyTo);
  const messages = useChatStore((s) => s.messages);
  const agents = useChatStore((s) => s.agents);
  const setMessages = useChatStore((s) => s.setMessages);
  const addMessage = useChatStore((s) => s.addMessage);

  const { suggestions, selectedIndex, setSelectedIndex, isOpen, applyMention } =
    useMentionAutocomplete(text, cursorPos);

  const updateSettings = useChatStore((s) => s.updateSettings);
  const sessionStart = useChatStore((s) => s.sessionStart);

  // Helper to create system messages
  const sysMsg = useCallback((text: string) => {
    addMessage({
      id: Date.now(),
      uid: 'cmd-' + Date.now(),
      sender: 'system',
      text,
      type: 'system',
      timestamp: Date.now() / 1000,
      time: new Date().toLocaleTimeString(),
      channel: activeChannel,
    });
  }, [addMessage, activeChannel]);

  // Slash commands
  const slashCommands: SlashCommand[] = useMemo(() => [
    {
      name: '/status',
      description: 'Show agent states',
      execute: () => {
        const lines = agents.length
          ? agents.map(a => `${a.label || a.name}: ${a.state}`).join('\n')
          : 'No agents registered';
        sysMsg(lines);
      },
    },
    {
      name: '/clear',
      description: 'Clear chat display',
      execute: () => {
        setMessages(messages.filter(m => m.channel !== activeChannel));
      },
    },
    {
      name: '/export',
      description: 'Download channel as markdown',
      execute: () => {
        const channelMsgs = messages.filter(m => m.channel === activeChannel);
        const md = channelMsgs
          .map(m => `**${m.sender}** (${m.time})\n${m.text}`)
          .join('\n\n---\n\n');
        const blob = new Blob([`# #${activeChannel}\n\n${md}`], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${activeChannel}-export.md`;
        a.click();
        URL.revokeObjectURL(url);
      },
    },
    {
      name: '/help',
      description: 'Show available commands',
      execute: () => {
        sysMsg(
          '/status -- show agent states\n/clear -- clear chat display\n/export -- download channel as markdown\n/help -- show this help\n' +
          '/focus [agent] [topic] -- set agent focus\n/theme dark|light -- switch theme\n/mute -- mute notifications\n/unmute -- unmute notifications\n' +
          '/agents -- show all agent details\n/ping [agent] -- check agent status\n/stats -- session statistics\n/role [agent] [role] -- set agent role\n' +
          '/spawn [base] [label] -- spawn agent\n/kill [agent] -- kill agent'
        );
      },
    },
    {
      name: '/focus',
      description: 'Set agent focus topic',
      execute: () => { /* handled by text parsing below */ },
    },
    {
      name: '/theme',
      description: 'Switch theme (dark|light)',
      execute: () => { /* handled by text parsing below */ },
    },
    {
      name: '/mute',
      description: 'Mute notification sounds',
      execute: () => {
        updateSettings({ notificationSounds: false });
        api.saveSettings({ notificationSounds: false }).catch(() => {});
        sysMsg('Notifications muted');
      },
    },
    {
      name: '/unmute',
      description: 'Unmute notification sounds',
      execute: () => {
        updateSettings({ notificationSounds: true });
        api.saveSettings({ notificationSounds: true }).catch(() => {});
        sysMsg('Notifications unmuted');
      },
    },
    {
      name: '/agents',
      description: 'Show all agent details',
      execute: () => {
        if (!agents.length) { sysMsg('No agents registered'); return; }
        const lines = agents.map(a =>
          `${a.label || a.name} | state: ${a.state} | role: ${a.role || 'none'} | base: ${a.base}`
        ).join('\n');
        sysMsg(lines);
      },
    },
    {
      name: '/ping',
      description: 'Ping agent for status',
      execute: () => { /* handled by text parsing below */ },
    },
    {
      name: '/stats',
      description: 'Show session statistics',
      execute: () => {
        const channelMsgs = messages.filter(m => m.channel === activeChannel);
        const uptime = Math.round((Date.now() - sessionStart) / 1000);
        const mins = Math.floor(uptime / 60);
        const secs = uptime % 60;
        const agentMsgs = channelMsgs.filter(m => agents.some(a => a.name === m.sender)).length;
        const userMsgs = channelMsgs.length - agentMsgs;
        sysMsg(
          `Session stats:\n` +
          `Uptime: ${mins}m ${secs}s\n` +
          `Messages in #${activeChannel}: ${channelMsgs.length}\n` +
          `User messages: ${userMsgs}\n` +
          `Agent messages: ${agentMsgs}\n` +
          `Active agents: ${agents.filter(a => a.state === 'active' || a.state === 'thinking').length}/${agents.length}`
        );
      },
    },
    {
      name: '/role',
      description: 'Set agent role (manager|worker|peer)',
      execute: () => { /* handled by text parsing below */ },
    },
    {
      name: '/spawn',
      description: 'Spawn a new agent',
      execute: () => { /* handled by text parsing below */ },
    },
    {
      name: '/kill',
      description: 'Kill an agent',
      execute: () => { /* handled by text parsing below */ },
    },
  ], [agents, activeChannel, messages, addMessage, setMessages, sysMsg, updateSettings, sessionStart]);

  const slashQuery = text.startsWith('/') && !text.includes(' ') ? text.toLowerCase() : '';
  const uniqueCommands = slashCommands.filter((c, i, arr) => arr.findIndex(x => x.name === c.name) === i);
  const filteredCommands = slashQuery
    ? uniqueCommands.filter(c => c.name.startsWith(slashQuery))
    : [];
  const showSlash = filteredCommands.length > 0 && slashQuery.length > 0;

  const executeSlashCommand = (cmd: SlashCommand) => {
    cmd.execute();
    setText('');
    setSlashIndex(0);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    // Check for slash command
    if (trimmed.startsWith('/')) {
      const parts = trimmed.split(/\s+/);
      const cmdName = parts[0].toLowerCase();

      // Commands with arguments
      if (cmdName === '/focus' && parts.length >= 3) {
        const agentName = parts[1];
        const topic = parts.slice(2).join(' ');
        sysMsg(`Focus set: ${agentName} -> ${topic}`);
        api.sendMessage('system', `@${agentName} focus on: ${topic}`, activeChannel).catch(() => {});
        setText('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
        return;
      }
      if (cmdName === '/theme' && parts.length >= 2) {
        const theme = parts[1] as 'dark' | 'light';
        if (theme === 'dark' || theme === 'light') {
          updateSettings({ theme });
          api.saveSettings({ theme }).catch(() => {});
          sysMsg(`Theme set to ${theme}`);
        } else {
          sysMsg('Usage: /theme dark|light');
        }
        setText('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
        return;
      }
      if (cmdName === '/ping' && parts.length >= 2) {
        const target = parts[1];
        const agent = agents.find(a => a.name === target || a.label === target);
        if (agent) {
          const start = performance.now();
          api.getStatus().then(() => {
            const elapsed = Math.round(performance.now() - start);
            sysMsg(`${agent.label || agent.name}: ${agent.state} (${elapsed}ms)`);
          }).catch(() => sysMsg(`${target}: unreachable`));
        } else {
          sysMsg(`Agent "${target}" not found`);
        }
        setText('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
        return;
      }
      if (cmdName === '/role' && parts.length >= 3) {
        const agentName = parts[1];
        const role = parts[2];
        if (['manager', 'worker', 'peer'].includes(role)) {
          fetch(`/api/agents/${agentName}/role`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role }),
          }).then(() => sysMsg(`${agentName} role set to ${role}`))
            .catch(() => sysMsg(`Failed to set role for ${agentName}`));
        } else {
          sysMsg('Usage: /role [agent] [manager|worker|peer]');
        }
        setText('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
        return;
      }
      if (cmdName === '/spawn' && parts.length >= 3) {
        const base = parts[1];
        const label = parts.slice(2).join(' ');
        api.spawnAgent(base, label, '.', []).then((r) => {
          sysMsg(`Spawned ${label} (${base}) — pid ${r.pid}`);
        }).catch(() => sysMsg(`Failed to spawn ${label}`));
        setText('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
        return;
      }
      if (cmdName === '/kill' && parts.length >= 2) {
        const target = parts[1];
        api.killAgent(target).then(() => {
          sysMsg(`Killed agent: ${target}`);
        }).catch(() => sysMsg(`Failed to kill ${target}`));
        setText('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
        return;
      }

      // Simple commands (no arguments)
      const cmd = slashCommands.find(c => c.name === cmdName);
      if (cmd) {
        cmd.execute();
        setText('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
        return;
      }
    }

    try {
      await api.sendMessage(settings.username, trimmed, activeChannel, replyTo?.id);
      setText('');
      setReplyTo(null);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (e) {
      console.error('Send failed:', e);
    }
  }, [text, activeChannel, settings.username, replyTo, setReplyTo, slashCommands, sysMsg, agents, updateSettings]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Slash command picker navigation
    if (showSlash) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashIndex((slashIndex + 1) % filteredCommands.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashIndex((slashIndex - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        setText(filteredCommands[slashIndex].name);
        setSlashIndex(0);
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        executeSlashCommand(filteredCommands[slashIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setText('');
        return;
      }
    }
    // Mention autocomplete
    if (isOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((selectedIndex + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(
          (selectedIndex - 1 + suggestions.length) % suggestions.length
        );
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        const newText = applyMention(suggestions[selectedIndex].name);
        setText(newText);
        setSelectedIndex(0);
        return;
      }
      if (e.key === 'Escape') {
        setCursorPos(0);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePaste = async (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;
        try {
          const result = await api.uploadImage(file);
          if (result.url) {
            setText((prev) => prev + `![image](${result.url})`);
          }
        } catch (err) {
          console.error('Upload failed:', err);
        }
        return;
      }
    }
  };

  const handleInput = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 160) + 'px';
      setCursorPos(textareaRef.current.selectionStart);
    }
  };

  const handleFileUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const result = await api.uploadImage(file);
        if (result.url) {
          setText((prev) => prev + `![image](${result.url})`);
        }
      } catch (err) {
        console.error('Upload failed:', err);
      }
    };
    input.click();
  };

  return (
    <div className="relative">
      {/* Reply indicator */}
      {replyTo && (
        <div className="w-full flex items-center gap-2 px-4 py-2 bg-surface-container border-t border-outline-variant/10 text-xs text-on-surface-variant">
          <span className="material-symbols-outlined text-sm">reply</span>
          Replying to <span className="font-bold text-primary">{replyTo.sender}</span>
          <button
            onClick={() => setReplyTo(null)}
            className="ml-auto text-outline hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Mention autocomplete dropdown */}
      {isOpen && (
        <div className="absolute bottom-full left-4 right-4 mb-1 bg-surface-container-high border border-outline-variant/20 rounded-lg overflow-hidden shadow-xl z-50">
          {suggestions.map((s, i) => (
            <button
              key={s.name}
              onClick={() => {
                const newText = applyMention(s.name);
                setText(newText);
                setSelectedIndex(0);
                textareaRef.current?.focus();
              }}
              className={`w-full text-left px-4 py-2 text-xs flex items-center gap-2 transition-colors ${
                i === selectedIndex
                  ? 'bg-primary-container/20 text-primary'
                  : 'text-on-surface-variant hover:bg-surface-container-highest'
              }`}
            >
              <span className="font-bold">@{s.name}</span>
              <span className="text-outline">{s.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Slash command picker */}
      {showSlash && (
        <div className="absolute bottom-full left-4 right-4 mb-1 bg-surface-container-high border border-outline-variant/20 rounded-lg overflow-hidden shadow-xl z-50">
          {filteredCommands.map((cmd, i) => (
            <button
              key={cmd.name}
              onClick={() => executeSlashCommand(cmd)}
              className={`w-full text-left px-4 py-2.5 text-xs flex items-center gap-3 transition-colors ${
                i === slashIndex
                  ? 'bg-primary-container/20 text-primary'
                  : 'text-on-surface-variant hover:bg-surface-container-highest'
              }`}
            >
              <span className="font-bold text-primary/80">{cmd.name}</span>
              <span className="text-outline">{cmd.description}</span>
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="w-full flex items-end gap-2 p-3 lg:px-6 lg:py-4 safe-bottom">
        <button
          onClick={handleFileUpload}
          className="p-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors shrink-0"
          title="Upload image"
        >
          <span className="material-symbols-outlined text-xl">attachment</span>
        </button>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            handleInput();
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onClick={handleInput}
          placeholder={`Message #${activeChannel}...`}
          rows={1}
          className="flex-1 bg-surface-container/60 rounded-xl px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/30 resize-none max-h-40 outline-none border border-outline-variant/8 focus:border-primary/25 focus:shadow-[0_0_16px_rgba(167,139,250,0.08)] transition-all"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim()}
          className="p-2 rounded-lg bg-primary-container text-primary-fixed hover:brightness-110 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
        >
          <span className="material-symbols-outlined text-xl">send</span>
        </button>
      </div>
    </div>
  );
}
