/**
 * Generative UI Card — renders structured data from agent metadata as interactive cards.
 *
 * Agents send metadata.card with a type and data. The frontend renders it accordingly.
 * Supported card types: table, list, kv (key-value), buttons, metric, code
 */

interface CardData {
  type: 'table' | 'list' | 'kv' | 'buttons' | 'metric' | 'code';
  title?: string;
  // table: { headers: string[], rows: string[][] }
  headers?: string[];
  rows?: string[][];
  // list: { items: string[] }
  items?: string[];
  // kv: { entries: { key: string, value: string }[] }
  entries?: { key: string; value: string }[];
  // buttons: { options: { label: string, value: string }[] }
  options?: { label: string; value: string }[];
  // metric: { value: string, label: string, change?: string, trend?: 'up' | 'down' | 'flat' }
  value?: string;
  label?: string;
  change?: string;
  trend?: 'up' | 'down' | 'flat';
  // code: { language: string, code: string }
  language?: string;
  code?: string;
}

interface GenerativeCardProps {
  card: CardData;
  agentColor?: string;
}

export function GenerativeCard({ card, agentColor }: GenerativeCardProps) {
  const color = agentColor || '#a78bfa';

  return (
    <div className="my-3 rounded-xl border border-outline-variant/15 overflow-hidden" style={{ background: 'rgba(17,17,25,0.4)' }}>
      {card.title && (
        <div className="px-4 py-2.5 border-b border-outline-variant/10 flex items-center gap-2">
          <span className="material-symbols-outlined text-[14px]" style={{ color }}>
            {card.type === 'table' ? 'table_chart' : card.type === 'list' ? 'list' : card.type === 'kv' ? 'data_object' : card.type === 'metric' ? 'speed' : card.type === 'code' ? 'code' : 'widgets'}
          </span>
          <span className="text-[11px] font-semibold text-on-surface">{card.title}</span>
        </div>
      )}

      <div className="p-3">
        {card.type === 'table' && card.headers && card.rows && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-outline-variant/15">
                  {card.headers.map((h, i) => (
                    <th key={i} className="text-left py-2 px-3 text-[10px] font-semibold text-on-surface-variant/60 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {card.rows.map((row, ri) => (
                  <tr key={ri} className="border-b border-outline-variant/5 last:border-0">
                    {row.map((cell, ci) => (
                      <td key={ci} className="py-2 px-3 text-on-surface/80">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {card.type === 'list' && card.items && (
          <ul className="space-y-1.5">
            {card.items.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-on-surface/80">
                <span className="text-[10px] mt-0.5" style={{ color }}>&#x2022;</span>
                {item}
              </li>
            ))}
          </ul>
        )}

        {card.type === 'kv' && card.entries && (
          <div className="space-y-1.5">
            {card.entries.map((entry, i) => (
              <div key={i} className="flex items-center justify-between gap-4">
                <span className="text-[10px] text-on-surface-variant/50 font-medium">{entry.key}</span>
                <span className="text-[11px] text-on-surface font-mono">{entry.value}</span>
              </div>
            ))}
          </div>
        )}

        {card.type === 'buttons' && card.options && (
          <div className="flex flex-wrap gap-2">
            {card.options.map((opt) => (
              <button
                key={opt.value}
                className="px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all active:scale-95 border"
                style={{ borderColor: `${color}30`, color, background: `${color}10` }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {card.type === 'metric' && (
          <div className="flex items-end gap-3">
            <span className="text-2xl font-bold text-on-surface">{card.value}</span>
            <div>
              <span className="text-[10px] text-on-surface-variant/50">{card.label}</span>
              {card.change && (
                <span className={`text-[10px] ml-2 font-medium ${
                  card.trend === 'up' ? 'text-green-400' : card.trend === 'down' ? 'text-red-400' : 'text-on-surface-variant/40'
                }`}>
                  {card.trend === 'up' ? '+' : card.trend === 'down' ? '-' : ''}{card.change}
                </span>
              )}
            </div>
          </div>
        )}

        {card.type === 'code' && card.code && (
          <pre className="text-xs font-mono bg-surface-container/60 rounded-lg p-3 overflow-x-auto text-on-surface/80">
            <code>{card.code}</code>
          </pre>
        )}
      </div>
    </div>
  );
}
