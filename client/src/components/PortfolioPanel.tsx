import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import type { PortfolioStats } from '../types';

const ChartTip = ({ active, payload }: { active?: boolean; payload?: Array<{ value: number }> }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-card-2)', border: '1px solid var(--border-2)', borderRadius: 8, padding: '4px 10px' }}>
      <span className="mono" style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 700 }}>
        ${payload[0].value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </span>
    </div>
  );
};

function Stat({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
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

export function PortfolioPanel({ stats }: { stats: PortfolioStats }) {
  const START = 10000;
  const ret = ((stats.balance - START) / START) * 100;
  const profit = stats.balance >= START;
  const pnlPos = stats.openPnl >= 0;
  const chartColor = profit ? 'var(--green)' : 'var(--red)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* Equity hero card */}
      <div className="card" style={{ padding: '16px', position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `radial-gradient(ellipse at top right, ${profit ? 'rgba(0,214,143,.05)' : 'rgba(245,54,92,.05)'} 0%, transparent 65%)`,
        }} />
        <div className="label" style={{ marginBottom: 6 }}>Total Ekuitas</div>
        <div className="mono" style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', letterSpacing: '-.03em', lineHeight: 1 }}>
          ${stats.equity.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </div>
        <div style={{ fontSize: 12, marginTop: 5, fontWeight: 600, color: profit ? 'var(--green)' : 'var(--red)' }}>
          {ret >= 0 ? '+' : ''}{ret.toFixed(2)}% dari modal awal
        </div>

        {stats.equityHistory && stats.equityHistory.length > 1 && (
          <div style={{ marginTop: 14 }}>
            <ResponsiveContainer width="100%" height={50}>
              <AreaChart data={stats.equityHistory} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartColor} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Tooltip content={<ChartTip />} />
                <Area type="monotone" dataKey="value" stroke={chartColor} strokeWidth={1.5} fill="url(#eq)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Stats 2×2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Stat label="Balance" value={`$${stats.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} />
        <Stat
          label="Open PnL"
          value={`${pnlPos ? '+' : ''}$${stats.openPnl.toFixed(2)}`}
          color={pnlPos ? 'var(--green)' : stats.openPnl < 0 ? 'var(--red)' : 'var(--text-2)'}
        />
        <Stat
          label="Win Rate"
          value={`${(stats.winRate * 100).toFixed(1)}%`}
          sub={`${stats.totalTrades} trades`}
          color={stats.winRate >= 0.5 ? 'var(--green)' : 'var(--text-2)'}
        />
        <Stat
          label="Max Drawdown"
          value={`${(stats.maxDrawdown * 100).toFixed(2)}%`}
          color={stats.maxDrawdown < 0.1 ? 'var(--text-2)' : 'var(--red)'}
        />
      </div>

      {/* Open / Closed positions */}
      <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 0 }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div className="label" style={{ marginBottom: 5 }}>Posisi Open</div>
          <div className="mono" style={{ fontSize: 20, fontWeight: 800, color: stats.openTrades > 0 ? 'var(--gold)' : 'var(--text-3)' }}>
            {stats.openTrades}
          </div>
        </div>
        <div className="divider" style={{ height: 32 }} />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div className="label" style={{ marginBottom: 5 }}>Total Closed</div>
          <div className="mono" style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>
            {stats.totalTrades}
          </div>
        </div>
      </div>
    </div>
  );
}
