import { useApi } from '../hooks/useApi';
import { L } from '../lib/labels';

interface AIStats {
  profitFactor: number | null;
  sharpeRatio: number | null;
  maxConsecutiveLosses: number;
  avgTradeDurationMinutes: number | null;
  totalTrades: number;
  wins: number;
  losses: number;
}

const DEFAULT_STATS: AIStats = {
  profitFactor: null,
  sharpeRatio: null,
  maxConsecutiveLosses: 0,
  avgTradeDurationMinutes: null,
  totalTrades: 0,
  wins: 0,
  losses: 0,
};

function MetricCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: 'var(--bg-card-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 13px' }}>
      <div className="label" style={{ marginBottom: 6 }}>{label}</div>
      <div className="mono" style={{ fontSize: 15, fontWeight: 700, color: color || 'var(--text)', letterSpacing: '-.01em', lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function profitFactorColor(v: number | null): string {
  if (v === null) return 'var(--text-3)';
  if (v >= 1.5) return 'var(--green)';
  if (v >= 1.0) return 'var(--gold)';
  return 'var(--red)';
}

function sharpeColor(v: number | null): string {
  if (v === null) return 'var(--text-3)';
  if (v >= 1) return 'var(--green)';
  if (v >= 0) return 'var(--gold)';
  return 'var(--red)';
}

function consecLossColor(v: number): string {
  if (v <= 2) return 'var(--green)';
  if (v <= 4) return 'var(--gold)';
  return 'var(--red)';
}

export function StatisticsPanel() {
  const { data: stats } = useApi<AIStats>('/api/ai-stats', DEFAULT_STATS);

  const pf = stats.profitFactor !== null ? stats.profitFactor.toFixed(2) : '—';
  const sr = stats.sharpeRatio !== null ? stats.sharpeRatio.toFixed(2) : '—';
  const cl = stats.maxConsecutiveLosses.toString();
  const dur = stats.avgTradeDurationMinutes !== null
    ? `${stats.avgTradeDurationMinutes} ${L.minutes}`
    : '—';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gold)', letterSpacing: '.12em', textTransform: 'uppercase', padding: '0 2px' }}>
        Statistik AI
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <MetricCard
          label={L.profitFactor}
          value={pf}
          sub={stats.totalTrades > 0 ? `${stats.wins}W / ${stats.losses}L` : undefined}
          color={profitFactorColor(stats.profitFactor)}
        />
        <MetricCard
          label={L.sharpeRatio}
          value={sr}
          sub={stats.totalTrades > 0 ? `${stats.totalTrades} trades` : undefined}
          color={sharpeColor(stats.sharpeRatio)}
        />
        <MetricCard
          label={L.maxConsecLoss}
          value={cl}
          sub="beruntun"
          color={consecLossColor(stats.maxConsecutiveLosses)}
        />
        <MetricCard
          label={L.avgDuration}
          value={dur}
          color="var(--text-2)"
        />
      </div>
    </div>
  );
}
