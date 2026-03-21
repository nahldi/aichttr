interface HandoffCardProps {
  from: string;
  to: string;
  reason?: string;
  context?: string;
  fromColor?: string;
  toColor?: string;
}

export function HandoffCard({ from, to, reason, context, fromColor = '#a78bfa', toColor = '#38bdf8' }: HandoffCardProps) {
  return (
    <div className="my-2 rounded-xl overflow-hidden border border-outline-variant/10" style={{
      background: 'linear-gradient(135deg, rgba(167,139,250,0.06) 0%, rgba(56,189,248,0.06) 100%)',
    }}>
      <div className="px-3.5 py-2.5 flex items-center gap-2 border-b border-outline-variant/8">
        <span className="material-symbols-outlined text-[16px] text-on-surface-variant/40">swap_horiz</span>
        <span className="text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-wider">Handoff</span>
      </div>
      <div className="px-3.5 py-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold" style={{ color: fromColor }}>{from}</span>
          <span className="material-symbols-outlined text-[14px] text-on-surface-variant/30">arrow_forward</span>
          <span className="text-[11px] font-semibold" style={{ color: toColor }}>{to}</span>
        </div>
        {reason && (
          <div className="text-[11px] text-on-surface-variant/50">{reason}</div>
        )}
        {context && (
          <div className="text-[10px] text-on-surface-variant/35 italic border-l-2 border-outline-variant/15 pl-2">{context}</div>
        )}
      </div>
    </div>
  );
}
