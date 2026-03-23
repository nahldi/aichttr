import { useState } from 'react';
import { useChatStore } from '../stores/chatStore';
import { api } from '../lib/api';

export function BulkDeleteBar() {
  const selectMode = useChatStore((s) => s.selectMode);
  const selectedIds = useChatStore((s) => s.selectedIds);
  const clearSelection = useChatStore((s) => s.clearSelection);
  const deleteMessages = useChatStore((s) => s.deleteMessages);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  if (!selectMode) return null;

  const count = selectedIds.size;

  const handleDelete = async () => {
    if (count === 0) return;
    setDeleting(true);
    setError('');
    const ids = Array.from(selectedIds);
    try {
      const result = await api.deleteMessages(ids);
      if (result.ok) {
        deleteMessages(result.deleted || ids);
        clearSelection();
      } else {
        setError('Delete failed');
      }
    } catch {
      setError('Delete failed — check connection');
    }
    setDeleting(false);
  };

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-red-500/10 border-t border-red-500/20">
      <div className="flex items-center gap-2 text-xs text-red-400">
        <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
        <span className="font-medium">
          {count === 0 ? 'Select messages to delete' : `${count} message${count > 1 ? 's' : ''} selected`}
        </span>
        {error && <span className="text-[10px] text-red-300/70 ml-1">{error}</span>}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={clearSelection}
          className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-on-surface-variant/60 hover:bg-surface-container-high transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleDelete}
          disabled={count === 0 || deleting}
          className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-40"
        >
          {deleting ? 'Deleting...' : `Delete${count > 0 ? ` (${count})` : ''}`}
        </button>
      </div>
    </div>
  );
}
