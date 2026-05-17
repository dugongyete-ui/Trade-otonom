import { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import type { PortfolioStats, SessionStats, SymbolStat } from '../types';
import { L } from '../lib/labels';

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

type EquityRange = 'today' | '7d' | 'all';

interface EquityPoint {
  time: string;
  value: number;
  rawTime?: string;
}

function SymbolStatCard({ symbol, stat, isPriority }: { symbol: 'XAUUSD' | 'V75'; stat: SymbolStat; isPriority: boolean }) {
  const pnlPos = stat.totalPnl >= 0;
  const wr = stat.winRate * 100;
  const wrColor = wr >= 55 ? 'var(--green)' : wr >= 40 ? 'var(--gold)' : wr > 0 ? 'var(--red)' : 'var(--text-3)';
  const symbolColor = symbol === 'XAUUSD' ? 'var(--gold)' : '#a78bfa';

  return (
    <div style={{
      flex: 1, background: 'var(--bg-card-2)',
      border: `1px solid ${isPriority ? 'rgba(201,168,76,.25)' : 'var(--border)'}`,
      borderRadius: 10, padding: '10px 11px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: symbolColor, letterSpacing: '.03em' }}>
          {symbol === 'XAUUSD' ? 'XAUUSD' : 'V75'}
        </span>
        {isPriority
          ? <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--gold)', background: 'rgba(201,168,76,.12)', border: '1px solid rgba(201,168,76,.25)', padding: '1px 5px', borderRadius: 4 }}>⭐ UTAMA</span>
          : <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-3)', background: 'var(--bg)', border: '1px solid var(--border)', padding: '1px 5px', borderRadius: 4 }}>CADANGAN</span>
        }
      </div>

      {stat.totalTrades === 0 ? (
        <div style={{ fontSize: 10, color: 'var(--text-3)', textAlign: 'center' as const, padding: '4px 0' }}>—</div>
      ) : (
        <>
          <div className="mono" style={{ fontSize: 14, fontWeight: 800, color: pnlPos ? 'var(--green)' : 'var(--red)', lineHeight: 1, marginBottom: 5 }}>
            {pnlPos ? '+' : '−'}Rp {Math.abs(stat.totalPnl).toLocaleString('id-ID', { minimumFractionDigits: 0 })}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
            <span style={{ fontSize: 9, color: wrColor, fontWeight: 700 }}>{stat.totalTrades > 0 ? `${wr.toFixed(0)}% WR` : '—'}</span>
            <span style={{ fontSize: 9, color: 'var(--green)' }}>{stat.wins}W</span>
            <span style={{ fontSize: 9, color: 'var(--red)' }}>{stat.losses}L</span>
            <span style={{ fontSize: 9, color: 'var(--text-3)' }}>{stat.totalTrades} trade</span>
          </div>
        </>
      )}
    </div>
  );
}

function SessionCard({ name, session }: { name: string; session: { trades: number; pnl: number; winRate: number } }) {
  const pos = session.pnl >= 0;
  return (
    <div style={{ flex: 1, background: 'var(--bg-card-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 11px' }}>
      <div className="label" style={{ marginBottom: 5 }}>{name}</div>
      <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: session.trades === 0 ? 'var(--text-3)' : pos ? 'var(--green)' : 'var(--red)', lineHeight: 1 }}>
        {session.trades === 0 ? '—' : fmtRpSmall(session.pnl)}
      </div>
      {session.trades > 0 && (
        <div style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 3 }}>
          {session.trades} {L.trades} · {(session.winRate * 100).toFixed(0)}% menang
        </div>
      )}
    </div>
  );
}

export function PortfolioPanel({ stats, loading }: { stats: PortfolioStats; loading?: boolean }) {
  const [equityRange, setEquityRange] = useState<EquityRange>('all');

  const ret = ((stats.balance - INITIAL_BALANCE) / INITIAL_BALANCE) * 100;
  const profit    = stats.balance >= INITIAL_BALANCE;
  const pnlPos    = stats.openPnl >= 0;
  const chartColor = profit ? 'var(--green)' : 'var(--red)';
  const totalPnl  = stats.balance - INITIAL_BALANCE;

  const filteredHistory = useMemo((): EquityPoint[] => {
    const hist = (stats.equityHistory || []) as EquityPoint[];
    if (equityRange === 'all') return hist;

    const now = Date.now();
    let cutoff: number;
    if (equityRange === 'today') {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      cutoff = todayStart.getTime();
    } else {
      cutoff = now - 7 * 24 * 60 * 60 * 1000;
    }

    const filtered = hist.filter(p => {
      if (!p.rawTime) return false;
      return new Date(p.rawTime).getTime() >= cutoff;
    });

    if (filtered.length === 0) return hist.slice(-5);
    const firstFiltered = filtered[0];
    const startPoint: EquityPoint = { time: 'Awal', value: firstFiltered.value, rawTime: firstFiltered.rawTime };
    return [startPoint, ...filtered.slice(1)];
  }, [stats.equityHistory, equityRange]);

  const sessionStats = stats.sessionStats;
  const hasSession = !!sessionStats;

  const rangeOptions: { key: EquityRange; label: string }[] = [
    { key: 'today', label: L.equityToday },
    { key: '7d',   label: L.equity7Days },
    { key: 'all',  label: L.equityAll },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SkeletonBox h={10} w="60%" />
          <SkeletonBox h={28} w="80%" />
          <SkeletonBox h={10} w="40%" />
          <SkeletonBox h={52} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ background: 'var(--bg-card-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 13px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <SkeletonBox h={8} w="50%" />
              <SkeletonBox h={16} w="70%" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* Equity hero card */}
      <div className="card" style={{ padding: '16px', position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `radial-gradient(ellipse at top right, ${profit ? 'rgba(0,214,143,.05)' : 'rgba(245,54,92,.05)'} 0%, transparent 65%)`,
        }} />
        <div className="label" style={{ marginBottom: 6 }}>{L.totalEquity}</div>
        <div className="mono" style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', letterSpacing: '-.03em', lineHeight: 1 }}>
          {fmtRp(stats.equity)}
        </div>
        <div style={{ fontSize: 12, marginTop: 5, fontWeight: 600, color: profit ? 'var(--green)' : 'var(--red)' }}>
          {ret >= 0 ? '+' : ''}{ret.toFixed(2)}% {L.fromInitialCapital}
        </div>

        {/* Equity range toggle */}
        <div style={{ display: 'flex', gap: 4, marginTop: 12, marginBottom: 4 }}>
          {rangeOptions.map(o => (
            <button
              key={o.key}
              data-testid={`btn-equity-range-${o.key}`}
              onClick={() => setEquityRange(o.key)}
              style={{
                padding: '3px 9px', borderRadius: 6, fontSize: 9, fontWeight: 700, cursor: 'pointer',
                letterSpacing: '.04em', textTransform: 'uppercase' as const,
                background: equityRange === o.key ? 'var(--gold-glow)' : 'transparent',
                border: `1px solid ${equityRange === o.key ? 'rgba(201,168,76,.3)' : 'var(--border)'}`,
                color: equityRange === o.key ? 'var(--gold)' : 'var(--text-3)',
                transition: 'all .15s',
              }}
            >
              {o.label}
            </button>
          ))}
        </div>

        {/* Equity curve chart */}
        {filteredHistory && filteredHistory.length > 1 && (
          <div style={{ height: 140, marginTop: 10 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={filteredHistory} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                <defs>
                  <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColor} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={chartColor} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 9, fill: 'var(--text-3)', fontFamily: 'inherit' }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={40}
                />
                <YAxis
                  hide
                  domain={(() => {
                    const vals = filteredHistory.map(p => p.value);
                    const min = Math.min(...vals);
                    const max = Math.max(...vals);
                    const range = max - min;
                    const pad = Math.max(range * 0.08, max * 0.001, 1);
                    return [min - pad, max + pad];
                  })()}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={chartColor}
                  strokeWidth={2}
                  fill="url(#eqGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: chartColor, strokeWidth: 0 }}
                />
                <Tooltip content={<ChartTip />} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Per-symbol breakdown — always visible */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '.08em', textTransform: 'uppercase' as const, padding: '0 2px', marginBottom: 6 }}>
          Per Instrumen
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <SymbolStatCard
            symbol="XAUUSD"
            stat={stats.symbolStats?.XAUUSD ?? { totalTrades: 0, wins: 0, losses: 0, winRate: 0, totalPnl: 0, maxDrawdown: 0, pnlHistory: [] }}
            isPriority
          />
          <SymbolStatCard
            symbol="V75"
            stat={stats.symbolStats?.V75 ?? { totalTrades: 0, wins: 0, losses: 0, winRate: 0, totalPnl: 0, maxDrawdown: 0, pnlHistory: [] }}
            isPriority={false}
          />
        </div>
      </div>

      {/* Session PnL cards */}
      {hasSession && (
        <div style={{ display: 'flex', gap: 6 }}>
          <SessionCard name={L.sessionAsia} session={sessionStats!.Asia} />
          <SessionCard name={L.sessionLondon} session={sessionStats!.London} />
          <SessionCard name={L.sessionNewYork} session={sessionStats!.NewYork} />
        </div>
      )}

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Stat label={L.saldo} value={fmtRp(stats.balance)} />
        <Stat
          label={L.openPnl}
          value={fmtRpSmall(stats.openPnl)}
          color={pnlPos ? 'var(--green)' : stats.openPnl < 0 ? 'var(--red)' : 'var(--text)'}
        />
        <Stat
          label={L.winRate}
          value={`${(stats.winRate * 100).toFixed(1)}%`}
          sub={`${stats.totalTrades} perdagangan`}
          color={stats.winRate >= 0.5 ? 'var(--green)' : stats.winRate > 0 ? 'var(--gold)' : undefined}
        />
        <Stat
          label={L.maxDrawdown}
          value={`${(stats.maxDrawdown * 100).toFixed(2)}%`}
          sub={`${stats.totalTrades} perdagangan`}
          color={stats.maxDrawdown > 0.1 ? 'var(--red)' : stats.maxDrawdown > 0.05 ? 'var(--gold)' : undefined}
        />
      </div>

      {/* Total P&L card */}
      <div className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="label" style={{ marginBottom: 4 }}>{L.totalPnlFromCapital}</div>
          <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: totalPnl >= 0 ? 'var(--green)' : 'var(--red)', letterSpacing: '-.02em' }}>
            {fmtRpSmall(totalPnl)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="label" style={{ marginBottom: 4 }}>{L.positionClosed}</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ textAlign: 'center' }}>
              <div className="mono" style={{ fontSize: 20, fontWeight: 800, color: 'var(--gold)' }}>{stats.openTrades}</div>
              <div style={{ fontSize: 9, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase' }}>{L.open}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="mono" style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-2)' }}>{stats.totalTrades}</div>
              <div style={{ fontSize: 9, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase' }}>{L.closed}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
