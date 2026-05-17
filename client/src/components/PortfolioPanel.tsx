import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import type { PortfolioStats } from '../types';

const INITIAL_BALANCE = 1_000_000;

function fmtRp(value: number, showSign = false): string {
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const sign = showSign ? (value >= 0 ? '+' : '−') : '';
  return `${sign}Rp ${formatted}`;
}

function fmtRpSmall(value: number): string {
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const sign = value >= 0 ? '+' : '−';
  return `${sign}Rp ${formatted}`;
}

const ChartTip = ({ active, payload }: { active?: boolean; payload?: Array<{ value: number }> }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-card-2)', border: '1px solid var(--border-2)', borderRadius: 8, padding: '4px 10px' }}>
      <span className="mono" style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 700 }}>
        {fmtRp(payload[0].value)}
      </span>
    </div>
  );
};

function Stat({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div style={{ background: 'var(--bg-card-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 13px' }}>
      <div className="label" style={{ marginBottom: 6 }}>{label}</div>
      <div className="mono" style={{ fontSize: 14, fontWeight: 700, color: color || 'var(--text)', letterSpacing: '-.01em', lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export function PortfolioPanel({ stats }: { stats: PortfolioStats }) {
  const ret = ((stats.balance - INITIAL_BALANCE) / INITIAL_BALANCE) * 100;
  const profit  = stats.balance >= INITIAL_BALANCE;
  const pnlPos  = stats.openPnl >= 0;
  const chartColor = profit ? 'var(--green)' : 'var(--red)';
  const totalPnl = stats.balance - INITIAL_BALANCE;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* Equity hero card */}
      <div className="card" style={{ padding: '16px', position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `radial-gradient(ellipse at top right, ${profit ? 'rgba(0,214,143,.05)' : 'rgba(245,54,92,.05)'} 0%, transparent 65%)`,
        }} />
        <div className="label" style={{ marginBottom: 6 }}>Total Ekuitas</div>
        <div className="mono" style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', letterSpacing: '-.03em', lineHeight: 1 }}>
          {fmtRp(stats.equity)}
        </div>
        <div style={{ fontSize: 12, marginTop: 5, fontWeight: 600, color: profit ? 'var(--green)' : 'var(--red)' }}>
          {ret >= 0 ? '+' : ''}{ret.toFixed(2)}% dari modal awal
        </div>

        {/* Mini chart */}
        {stats.equityHistory && stats.equityHistory.length > 1 && (
          <div style={{ height: 48, marginTop: 14 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.equityHistory} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColor} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="value" stroke={chartColor} strokeWidth={1.5} fill="url(#eqGrad)" dot={false} />
                <Tooltip content={<ChartTip />} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Stat label="Balance" value={fmtRp(stats.balance)} />
        <Stat
          label="Open PnL"
          value={fmtRpSmall(stats.openPnl)}
          color={pnlPos ? 'var(--green)' : stats.openPnl < 0 ? 'var(--red)' : 'var(--text)'}
        />
        <Stat
          label="Win Rate"
          value={`${(stats.winRate * 100).toFixed(1)}%`}
          sub={`${stats.totalTrades} trades`}
          color={stats.winRate >= 0.5 ? 'var(--green)' : stats.winRate > 0 ? 'var(--gold)' : undefined}
        />
        <Stat
          label="Max Drawdown"
          value={`${(stats.maxDrawdown * 100).toFixed(2)}%`}
          sub={`${stats.totalTrades} trades`}
          color={stats.maxDrawdown > 0.1 ? 'var(--red)' : stats.maxDrawdown > 0.05 ? 'var(--gold)' : undefined}
        />
      </div>

      {/* Total P&L card */}
      <div className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="label" style={{ marginBottom: 4 }}>Total P&amp;L dari Modal Awal</div>
          <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: totalPnl >= 0 ? 'var(--green)' : 'var(--red)', letterSpacing: '-.02em' }}>
            {fmtRpSmall(totalPnl)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="label" style={{ marginBottom: 4 }}>Posisi / Closed</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ textAlign: 'center' }}>
              <div className="mono" style={{ fontSize: 20, fontWeight: 800, color: 'var(--gold)' }}>{stats.openTrades}</div>
              <div style={{ fontSize: 9, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase' }}>Open</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="mono" style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-2)' }}>{stats.totalTrades}</div>
              <div style={{ fontSize: 9, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase' }}>Closed</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
