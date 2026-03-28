/**
 * Inline Diff Viewer — renders unified diffs with color-coded lines.
 * Used in cockpit Replay tab and Files tab to show agent file changes.
 */
import { useState, useMemo } from 'react';
import { toast } from './Toast';

interface DiffLine {
  type: 'add' | 'remove' | 'context' | 'header';
  content: string;
  lineNum?: { old?: number; new?: number };
}

function parseDiff(diff: string): DiffLine[] {
  const lines: DiffLine[] = [];
  let oldLine = 0;
  let newLine = 0;

  for (const raw of diff.split('\n')) {
    if (raw.startsWith('@@')) {
      // Parse hunk header: @@ -oldStart,oldCount +newStart,newCount @@
      const match = raw.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldLine = parseInt(match[1], 10);
        newLine = parseInt(match[2], 10);
      }
      lines.push({ type: 'header', content: raw });
    } else if (raw.startsWith('+')) {
      lines.push({ type: 'add', content: raw.slice(1), lineNum: { new: newLine } });
      newLine++;
    } else if (raw.startsWith('-')) {
      lines.push({ type: 'remove', content: raw.slice(1), lineNum: { old: oldLine } });
      oldLine++;
    } else if (raw.startsWith(' ')) {
      lines.push({ type: 'context', content: raw.slice(1), lineNum: { old: oldLine, new: newLine } });
      oldLine++;
      newLine++;
    } else if (raw.startsWith('diff ') || raw.startsWith('index ') || raw.startsWith('---') || raw.startsWith('+++')) {
      lines.push({ type: 'header', content: raw });
    }
  }
  return lines;
}

const LINE_COLORS = {
  add: { bg: 'rgba(34, 197, 94, 0.08)', text: 'text-green-300/80', gutter: 'text-green-400/30', prefix: '+' },
  remove: { bg: 'rgba(239, 68, 68, 0.08)', text: 'text-red-300/80', gutter: 'text-red-400/30', prefix: '-' },
  context: { bg: 'transparent', text: 'text-on-surface/50', gutter: 'text-on-surface-variant/15', prefix: ' ' },
  header: { bg: 'rgba(96, 165, 250, 0.06)', text: 'text-blue-300/50', gutter: 'text-blue-400/20', prefix: '' },
};

interface DiffViewerProps {
  diff: string;
  path: string;
  before?: string;
  after?: string;
  agentName?: string;
  agentColor?: string;
  onClose?: () => void;
  onRevert?: () => void;
}

export function DiffViewer({ diff, path, before, after: _after, agentName, agentColor, onClose, onRevert }: DiffViewerProps) {
  void _after; // Reserved for future "apply" action
  const [reverting, setReverting] = useState(false);

  const handleRevert = async () => {
    if (!agentName || !before) return;
    setReverting(true);
    try {
      const res = await fetch(`/api/agents/${encodeURIComponent(agentName)}/file`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, content: before }),
      });
      if (res.ok) {
        toast('Reverted to previous version', 'success');
        onRevert?.();
      } else {
        toast('Revert failed', 'error');
      }
    } catch {
      toast('Revert failed', 'error');
    }
    setReverting(false);
  };
  const lines = useMemo(() => parseDiff(diff), [diff]);

  const stats = useMemo(() => {
    let added = 0, removed = 0;
    for (const l of lines) {
      if (l.type === 'add') added++;
      if (l.type === 'remove') removed++;
    }
    return { added, removed };
  }, [lines]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 flex items-center gap-2 border-b border-outline-variant/10 shrink-0">
        {onClose && (
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-container-high">
            <span className="material-symbols-outlined text-sm text-on-surface-variant/50">arrow_back</span>
          </button>
        )}
        <span className="material-symbols-outlined text-sm" style={{ color: agentColor || '#a78bfa' }}>difference</span>
        <span className="text-[11px] font-mono text-on-surface-variant/60 truncate flex-1">{path}</span>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-green-400/60">+{stats.added}</span>
          <span className="text-[9px] text-red-400/60">-{stats.removed}</span>
          {agentName && before && (
            <button
              onClick={handleRevert}
              disabled={reverting}
              className="text-[9px] px-2 py-0.5 rounded-md bg-red-500/10 text-red-400/70 hover:bg-red-500/20 transition-colors disabled:opacity-30"
              title="Revert to previous version"
            >
              {reverting ? 'Reverting...' : 'Revert'}
            </button>
          )}
          <button
            onClick={() => navigator.clipboard?.writeText(diff).then(() => toast('Diff copied', 'success'))}
            className="p-1 rounded hover:bg-surface-container-high"
            title="Copy diff"
          >
            <span className="material-symbols-outlined text-[12px] text-on-surface-variant/30">content_copy</span>
          </button>
        </div>
      </div>

      {/* Diff content */}
      <div className="flex-1 overflow-auto" style={{ background: '#06060c' }}>
        {lines.length === 0 ? (
          <div className="text-center py-8 text-on-surface-variant/30 text-xs">No changes</div>
        ) : (
          <div className="font-mono text-[10px] leading-[1.7]">
            {lines.map((line, i) => {
              const colors = LINE_COLORS[line.type];
              return (
                <div
                  key={i}
                  className="flex hover:brightness-110 transition-all"
                  style={{ background: colors.bg }}
                >
                  {/* Line numbers */}
                  {line.type !== 'header' ? (
                    <>
                      <span className={`w-10 text-right px-1.5 select-none shrink-0 ${colors.gutter} border-r border-outline-variant/5`}>
                        {line.lineNum?.old || ''}
                      </span>
                      <span className={`w-10 text-right px-1.5 select-none shrink-0 ${colors.gutter} border-r border-outline-variant/5`}>
                        {line.lineNum?.new || ''}
                      </span>
                      <span className={`w-4 text-center select-none shrink-0 ${colors.gutter}`}>
                        {colors.prefix}
                      </span>
                    </>
                  ) : (
                    <span className="w-24 shrink-0" />
                  )}
                  <span className={`flex-1 px-2 whitespace-pre overflow-x-auto ${colors.text}`}>
                    {line.content}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
