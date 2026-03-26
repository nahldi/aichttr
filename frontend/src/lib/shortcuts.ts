/**
 * GhostLink Keyboard Shortcuts System.
 *
 * Manages rebindable keyboard shortcuts with conflict detection.
 * Shortcuts persist in settings.json via the chatStore.
 *
 * Usage:
 *   import { useShortcuts, DEFAULT_SHORTCUTS } from '../lib/shortcuts';
 *   useShortcuts(customBindings);
 */

export interface ShortcutAction {
  id: string;
  label: string;
  description: string;
  defaultKey: string;  // e.g. "ctrl+k", "ctrl+shift+n"
  category: 'navigation' | 'chat' | 'agent' | 'ui';
}

export const DEFAULT_SHORTCUTS: ShortcutAction[] = [
  // Navigation
  { id: 'search', label: 'Search', description: 'Open search modal', defaultKey: 'ctrl+k', category: 'navigation' },
  { id: 'settings', label: 'Settings', description: 'Open settings panel', defaultKey: 'ctrl+,', category: 'navigation' },
  { id: 'next_channel', label: 'Next Channel', description: 'Switch to next channel', defaultKey: 'ctrl+]', category: 'navigation' },
  { id: 'prev_channel', label: 'Previous Channel', description: 'Switch to previous channel', defaultKey: 'ctrl+[', category: 'navigation' },
  // Chat
  { id: 'focus_input', label: 'Focus Input', description: 'Focus the message input', defaultKey: 'ctrl+l', category: 'chat' },
  { id: 'send_message', label: 'Send', description: 'Send current message', defaultKey: 'enter', category: 'chat' },
  { id: 'new_line', label: 'New Line', description: 'Insert new line in input', defaultKey: 'shift+enter', category: 'chat' },
  // Agent
  { id: 'spawn_agent', label: 'Spawn Agent', description: 'Open spawn agent modal', defaultKey: 'ctrl+shift+n', category: 'agent' },
  { id: 'toggle_sidebar', label: 'Toggle Sidebar', description: 'Show/hide sidebar', defaultKey: 'ctrl+b', category: 'ui' },
  { id: 'toggle_agent_bar', label: 'Toggle Agent Bar', description: 'Show/hide agent bar', defaultKey: 'ctrl+shift+a', category: 'ui' },
  // UI
  { id: 'escape', label: 'Close', description: 'Close current modal/panel', defaultKey: 'escape', category: 'ui' },
  { id: 'quick_theme', label: 'Cycle Theme', description: 'Switch to next theme', defaultKey: 'ctrl+shift+t', category: 'ui' },
];

export type ShortcutBindings = Record<string, string>;  // action id → key combo

/**
 * Parse a key combo string into its parts.
 */
export function parseKeyCombo(combo: string): { ctrl: boolean; shift: boolean; alt: boolean; meta: boolean; key: string } {
  const parts = combo.toLowerCase().split('+');
  return {
    ctrl: parts.includes('ctrl') || parts.includes('control'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
    meta: parts.includes('meta') || parts.includes('cmd'),
    key: parts.filter(p => !['ctrl', 'control', 'shift', 'alt', 'meta', 'cmd'].includes(p))[0] || '',
  };
}

/**
 * Check if a keyboard event matches a key combo.
 */
export function matchesCombo(event: KeyboardEvent, combo: string): boolean {
  const parsed = parseKeyCombo(combo);
  return (
    event.ctrlKey === parsed.ctrl &&
    event.shiftKey === parsed.shift &&
    event.altKey === parsed.alt &&
    event.metaKey === parsed.meta &&
    event.key.toLowerCase() === parsed.key
  );
}

/**
 * Get the default bindings map.
 */
export function getDefaultBindings(): ShortcutBindings {
  const bindings: ShortcutBindings = {};
  for (const s of DEFAULT_SHORTCUTS) {
    bindings[s.id] = s.defaultKey;
  }
  return bindings;
}

/**
 * Detect conflicts in bindings.
 */
export function findConflicts(bindings: ShortcutBindings): string[] {
  const keyMap: Record<string, string[]> = {};
  for (const [id, combo] of Object.entries(bindings)) {
    if (!keyMap[combo]) keyMap[combo] = [];
    keyMap[combo].push(id);
  }
  const conflicts: string[] = [];
  for (const [combo, ids] of Object.entries(keyMap)) {
    if (ids.length > 1) {
      conflicts.push(`${combo}: ${ids.join(', ')}`);
    }
  }
  return conflicts;
}

/**
 * Format a key combo for display.
 */
export function formatCombo(combo: string): string {
  const isMac = navigator.platform.includes('Mac');
  return combo
    .replace(/ctrl/gi, isMac ? '⌘' : 'Ctrl')
    .replace(/shift/gi, isMac ? '⇧' : 'Shift')
    .replace(/alt/gi, isMac ? '⌥' : 'Alt')
    .replace(/meta|cmd/gi, isMac ? '⌘' : 'Win')
    .replace(/\+/g, isMac ? '' : '+')
    .replace(/escape/gi, 'Esc')
    .replace(/enter/gi, '↵');
}
