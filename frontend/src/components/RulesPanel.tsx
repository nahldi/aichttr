import { useState } from 'react';
import { useChatStore } from '../stores/chatStore';
import { api } from '../lib/api';

export function RulesPanel() {
  const rules = useChatStore((s) => s.rules);
  const settings = useChatStore((s) => s.settings);
  const [showForm, setShowForm] = useState(false);
  const [text, setText] = useState('');

  const active = rules.filter((r) => r.status === 'active');
  const drafts = rules.filter((r) => r.status === 'draft' || r.status === 'pending');
  const archived = rules.filter((r) => r.status === 'archived');

  const sections = [
    { label: 'Active', items: active, color: '#5de6ff' },
    { label: 'Drafts', items: drafts, color: '#d2bbff' },
    { label: 'Archived', items: archived, color: '#958da1' },
  ];

  const handleCreate = async () => {
    if (!text.trim()) return;
    try {
      await api.proposeRule(text.trim(), settings.username, '');
      const res = await api.getRules();
      useChatStore.getState().setRules(res.rules);
      setText('');
      setShowForm(false);
    } catch {}
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/10">
        <h2 className="text-sm font-bold text-on-surface uppercase tracking-widest">
          Rules
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="p-1 rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <span className="material-symbols-outlined text-lg">{showForm ? 'close' : 'add'}</span>
        </button>
      </div>

      {showForm && (
        <div className="px-4 py-3 border-b border-outline-variant/10 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Propose a rule..."
            className="flex-1 bg-surface-container rounded-lg px-3 py-1.5 text-xs text-on-surface outline-none border border-outline-variant/10 focus:border-primary/50"
            autoFocus
          />
          <button
            onClick={handleCreate}
            className="px-3 py-1.5 bg-primary-container text-on-primary-container rounded-lg text-xs font-medium hover:brightness-110 transition-all"
          >
            Propose
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {sections.map((section) => (
          <div key={section.label}>
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: section.color }}
              />
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                {section.label}
              </span>
              <span className="text-[10px] text-outline">
                {section.items.length}
              </span>
            </div>
            <div className="space-y-2">
              {section.items.length === 0 ? (
                <div className="text-xs text-outline-variant text-center py-4">
                  No {section.label.toLowerCase()} rules
                </div>
              ) : (
                section.items.map((rule) => (
                  <div
                    key={rule.id}
                    className="glass-card rounded-xl p-4 border-l-2 cursor-pointer hover:brightness-110 transition-all"
                    style={{ borderLeftColor: section.color }}
                  >
                    <div className="text-sm text-on-surface mb-2 leading-relaxed">
                      {rule.text}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-outline uppercase font-bold">
                        by {rule.author}
                      </span>
                      {rule.reason && (
                        <span className="text-[10px] text-on-surface-variant truncate ml-2 max-w-[150px]">
                          {rule.reason}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
