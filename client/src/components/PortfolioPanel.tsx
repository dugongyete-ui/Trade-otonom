import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import type { PortfolioStats } from '../types';

interface PortfolioPanelProps { stats: PortfolioStats; }

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ value: number }> }) => {
  if (active && payload?.length) {
    return (
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-bright)', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: 'var(--gold)' }}>
        ${payload[0].value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </div>
    );
  }
  return null;
};

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
        {label}
      </div>
      <div className="font-mono" style={{ fontSize: 16, fontWeight: 700, color: color || 'var(--text-primary)', letterSpacing: '-0.02em' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

export function PortfolioPanel({ stats }: PortfolioPanelProps) {
  const balanceStart = 10000;
  const totalReturn = ((stats.balance - balanceStart) / balanceStart) * 100;
  const isProfit = stats.balance >= balanceStart;
  const pnlPos = stats.openPnl >= 0;
  const chartColor = isProfit ? 'var(--green)' : 'var(--red)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Equity card */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: 120, height: 120, background: `radial-gradient(circle at top right, ${isProfit ? 'rgba(0,214,143,0.06)' : 'rgba(255,71,87,0.06)'}, transparent 70%)`, pointerEvents: 'none' }} />
        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Total Ekuitas</div>
        <div className="font-mono" style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
          ${stats.equity.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </div>
        <div style={{ fontSize: 12, marginTop: 4, color: isProfit ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
          {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(2)}% dari modal awal
        </div>

        {stats.equityHistory && stats.equityHistory.length > 1 && (
          <div style={{ marginTop: 16 }}>
            <ResponsiveContainer width="100%" height={56}>
              <AreaChart data={stats.equityHistory} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartColor} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" hide />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="value" stroke={chartColor} strokeWidth={1.5} fill="url(#eqGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Stat label="Balance" value={`$${stats.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} />
        <Stat
          label="Open PnL"
          value={`${pnlPos ? '+' : ''}$${stats.openPnl.toFixed(2)}`}
          color={pnlPos ? 'var(--green)' : stats.openPnl < 0 ? 'var(--red)' : 'var(--text-secondary)'}
        />
        <Stat
          label="Win Rate"
          value={`${(stats.winRate * 100).toFixed(1)}%`}
          sub={`${stats.totalTrades} trades`}
          color={stats.winRate >= 0.5 ? 'var(--green)' : 'var(--text-secondary)'}
        />
        <Stat
          label="Max Drawdown"
          value={`${(stats.maxDrawdown * 100).toFixed(2)}%`}
          color={stats.maxDrawdown < 0.1 ? 'var(--text-secondary)' : 'var(--red)'}
        />
      </div>

      {/* Positions */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 24 }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, fontWeight: 500 }}>Open</div>
          <div className="font-mono" style={{ fontSize: 22, fontWeight: 700, color: stats.openTrades > 0 ? 'var(--gold)' : 'var(--text-muted)' }}>
            {stats.openTrades}
          </div>
        </div>
        <div style={{ width: 1, height: 36, background: 'var(--border-bright)' }} />
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, fontWeight: 500 }}>Closed</div>
          <div className="font-mono" style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
            {stats.totalTrades}
          </div>
        </div>
      </div>
    </div>
  );
}
