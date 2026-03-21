interface Vote {
  agent: string;
  color: string;
  vote: 'approve' | 'reject' | 'abstain';
}

interface ConsensusCardProps {
  title: string;
  description?: string;
  votes: Vote[];
  resolved?: boolean;
  result?: 'approved' | 'rejected';
}

export function ConsensusCard({ title, description, votes, resolved, result }: ConsensusCardProps) {
  const approvals = votes.filter(v => v.vote === 'approve').length;
  const rejections = votes.filter(v => v.vote === 'reject').length;
  const total = votes.length;
  const pct = total > 0 ? Math.round((approvals / total) * 100) : 0;

  return (
    <div className="my-2 rounded-xl overflow-hidden border border-outline-variant/10" style={{
      background: resolved
        ? result === 'approved' ? 'rgba(74, 222, 128, 0.04)' : 'rgba(248, 113, 113, 0.04)'
        : 'rgba(167, 139, 250, 0.04)',
    }}>
      <div className="px-3.5 py-2.5 flex items-center gap-2 border-b border-outline-variant/8">
        <span className="material-symbols-outlined text-[16px] text-on-surface-variant/40">how_to_vote</span>
        <span className="text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-wider">Consensus</span>
        {resolved && (
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ml-auto ${
            result === 'approved' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
          }`}>
            {result === 'approved' ? 'APPROVED' : 'REJECTED'}
          </span>
        )}
      </div>
      <div className="px-3.5 py-3 space-y-2.5">
        <div className="text-[12px] font-semibold text-on-surface">{title}</div>
        {description && <div className="text-[11px] text-on-surface-variant/50">{description}</div>}

        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-green-400/60">{approvals} approve</span>
            <span className="text-[9px] text-on-surface-variant/30">{pct}%</span>
            <span className="text-[9px] text-red-400/60">{rejections} reject</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-container-highest/30 overflow-hidden flex">
            {approvals > 0 && <div className="h-full bg-green-400/60 transition-all" style={{ width: `${(approvals / total) * 100}%` }} />}
            {rejections > 0 && <div className="h-full bg-red-400/60 transition-all ml-auto" style={{ width: `${(rejections / total) * 100}%` }} />}
          </div>
        </div>

        {/* Votes */}
        <div className="flex flex-wrap gap-1.5">
          {votes.map((v, i) => (
            <span key={i} className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
              v.vote === 'approve' ? 'border-green-500/20 bg-green-500/8 text-green-400' :
              v.vote === 'reject' ? 'border-red-500/20 bg-red-500/8 text-red-400' :
              'border-outline-variant/15 bg-surface-container/30 text-on-surface-variant/40'
            }`}>
              {v.vote === 'approve' ? '\u2713' : v.vote === 'reject' ? '\u2717' : '\u2014'} {v.agent}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
