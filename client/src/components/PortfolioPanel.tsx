import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { IconTrendUp, IconTrendDown, IconDollar, IconBarChart, IconTarget, IconAlert } from './Icons';
import type { PortfolioStats } from '../types';

interface PortfolioPanelProps {
  stats: PortfolioStats;
}

function StatCard({ label, value, sub, icon: Icon, positive }: {
  label: string;
  value: string;
  sub?: string;
  icon: React.FC<{ size?: number; style?: React.CSSProperties }>;
  positive?: boolean | null;
}) {
  const color = positive === null || positive === undefined
    ? 'var(--text-secondary)'
    : positive
      ? 'var(--green)'
      : 'var(--red)';

  return (
    <div className="card p-3 flex flex-col gap-1 card-hover" data-testid={`stat-${label.toLowerCase().replace(/\s/g, '-')}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
        <Icon size={12} style={{ color: 'var(--text-muted)' }} />
      </div>
      <div className="font-mono text-base font-semibold" style={{ color }}>
        {value}
      </div>
      {sub && <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  );
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ value: number }> }) => {
  if (active && payload && payload.length) {
    return (
      <div className="card px-2 py-1 text-xs font-mono" style={{ color: 'var(--gold)' }}>
        ${payload[0].value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </div>
    );
  }
  return null;
};

export function PortfolioPanel({ stats }: PortfolioPanelProps) {
  const pnlIsPositive = stats.openPnl >= 0;
  const balanceStart = 10000;
  const totalReturn = ((stats.balance - balanceStart) / balanceStart) * 100;
  const isProfit = stats.balance >= balanceStart;

  return (
    <div className="flex flex-col gap-3 overflow-y-auto">
      <div className="px-1">
        <div className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--gold)', letterSpacing: '0.12em' }}>
          Portfolio
        </div>
      </div>

      <div className="card p-3" data-testid="equity-chart">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Ekuitas</span>
          <span className="font-mono text-xs font-semibold" style={{ color: isProfit ? 'var(--green)' : 'var(--red)' }}>
            {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(2)}%
          </span>
        </div>
        <div className="font-mono text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
          ${stats.equity.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </div>
        {stats.equityHistory && stats.equityHistory.length > 1 && (
          <ResponsiveContainer width="100%" height={60}>
            <AreaChart data={stats.equityHistory} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={isProfit ? '#00C853' : '#FF1744'} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={isProfit ? '#00C853' : '#FF1744'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" hide />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke={isProfit ? '#00C853' : '#FF1744'}
                strokeWidth={1.5}
                fill="url(#equityGrad)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StatCard
          label="Balance"
          value={`$${stats.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          icon={IconDollar}
          positive={null}
        />
        <StatCard
          label="Open PnL"
          value={`${pnlIsPositive ? '+' : ''}$${stats.openPnl.toFixed(2)}`}
          icon={pnlIsPositive ? IconTrendUp : IconTrendDown}
          positive={pnlIsPositive}
        />
        <StatCard
          label="Win Rate"
          value={`${(stats.winRate * 100).toFixed(1)}%`}
          sub={`${stats.totalTrades} trades`}
          icon={IconTarget}
          positive={stats.winRate >= 0.5}
        />
        <StatCard
          label="Max Drawdown"
          value={`${(stats.maxDrawdown * 100).toFixed(2)}%`}
          icon={IconAlert}
          positive={stats.maxDrawdown < 0.1}
        />
      </div>

      <div className="card p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Status Posisi</span>
          <IconBarChart size={12} style={{ color: 'var(--text-muted)' }} />
        </div>
        <div className="flex items-center gap-3">
          <div>
            <div className="font-mono text-lg font-bold" style={{ color: stats.openTrades > 0 ? 'var(--gold)' : 'var(--text-muted)' }}>
              {stats.openTrades}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Open</div>
          </div>
          <div style={{ width: '1px', height: '32px', background: 'var(--border)' }} />
          <div>
            <div className="font-mono text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              {stats.totalTrades}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Total Closed</div>
          </div>
        </div>
      </div>
    </div>
  );
}
