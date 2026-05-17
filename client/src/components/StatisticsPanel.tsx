import { TrendingUp, Activity, AlertTriangle, Clock } from 'lucide-react';
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

function SkeletonBox({ h = 14, w = '100%' }: { h?: number; w?: string }) {
  return (
    <div style={{
      height: h, width: w, borderRadius: 6,
      background: 'linear-gradient(90deg, var(--bg-card-2) 25%, var(--border) 50%, var(--bg-card-2) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
    }} />
  );
}

function MetricCard({
  label, value, sub, color, icon
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  icon: React.ReactNode;
}) {
  return (
    <div style={{ background: 'var(--bg-card-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 13px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <div style={{ color: color || 'var(--text-3)', flexShrink: 0 }}>{icon}</div>
        <div className="label">{label}</div>
      </div>
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
  const { data: stats, loading } = useApi<AIStats>('/api/ai-stats', DEFAULT_STATS);

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

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ background: 'var(--bg-card-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 13px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <SkeletonBox h={8} w="50%" />
              <SkeletonBox h={16} w="60%" />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <MetricCard
            label={L.profitFactor}
            value={pf}
            sub={stats.totalTrades > 0 ? `${stats.wins}M / ${stats.losses}K` : undefined}
            color={profitFactorColor(stats.profitFactor)}
            icon={<TrendingUp size={12} />}
          />
          <MetricCard
            label={L.sharpeRatio}
            value={sr}
            sub={stats.totalTrades > 0 ? `${stats.totalTrades} trades` : undefined}
            color={sharpeColor(stats.sharpeRatio)}
            icon={<Activity size={12} />}
          />
          <MetricCard
            label={L.maxConsecLoss}
            value={cl}
            sub="beruntun"
            color={consecLossColor(stats.maxConsecutiveLosses)}
            icon={<AlertTriangle size={12} />}
          />
          <MetricCard
            label={L.avgDuration}
            value={dur}
            color="var(--text-2)"
            icon={<Clock size={12} />}
          />
        </div>
      )}
    </div>
  );
}
