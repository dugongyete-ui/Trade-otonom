import { useState } from 'react';
import type { Trade } from '../types';
import { L } from '../lib/labels';

function fmtRp(value: number): string {
  return 'Rp ' + Math.abs(value).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string; border: string }> = {
    TP_HIT: { label: 'Batas Untung', color: 'var(--green)',  bg: 'var(--green-d)', border: 'rgba(0,214,143,.2)' },
    SL_HIT: { label: 'Batas Rugi',  color: 'var(--red)',    bg: 'var(--red-d)',   border: 'rgba(245,54,92,.2)' },
    OPEN:   { label: 'Buka',    color: 'var(--gold)',   bg: 'var(--gold-glow)', border: 'rgba(201,168,76,.2)' },
    CLOSED: { label: 'Tutup',   color: 'var(--text-3)', bg: 'var(--bg)',      border: 'var(--border)' },
  };
  const c = map[status] || map.CLOSED;
  return (
    <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, color: c.color, background: c.bg, border: `1px solid ${c.border}`, whiteSpace: 'nowrap' }}>
      {c.label}
    </span>
  );
}

function TradeCard({ trade }: { trade: Trade }) {
  const [open, setOpen] = useState(false);
  const pnl  = Number(trade.pnl || 0);
  const pos  = pnl > 0;
  const time = new Date(trade.open_time).toLocaleString('id-ID', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const hasRef = !!trade.reflection;
  const isV75  = trade.symbol?.includes('Volatility') || trade.symbol === 'V75';

  return (
    <div
      data-testid={`card-trade-${trade.id}`}
      onClick={() => hasRef && setOpen(!open)}
      style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '11px 13px',
        cursor: hasRef ? 'pointer' : 'default',
        display: 'flex', flexDirection: 'column', gap: 0,
        transition: 'border-color .15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="mono" style={{
          fontSize: 11, fontWeight: 800,
          color: trade.action === 'BUY' ? 'var(--green)' : 'var(--red)',
          background: trade.action === 'BUY' ? 'var(--green-d)' : 'var(--red-d)',
          border: `1px solid ${trade.action === 'BUY' ? 'rgba(0,214,143,.2)' : 'rgba(245,54,92,.2)'}`,
          padding: '2px 8px', borderRadius: 6, flexShrink: 0,
        }}>
          {trade.action}
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: isV75 ? '#a78bfa' : 'var(--gold)', letterSpacing: '.03em' }}>
              {isV75 ? 'V75' : 'XAU'}
            </span>
            <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {Number(trade.entry).toFixed(isV75 ? 3 : 2)}
              {trade.close_price && <span style={{ color: 'var(--text-3)', fontWeight: 400 }}> → {Number(trade.close_price).toFixed(isV75 ? 3 : 2)}</span>}
            </span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{time}</div>
        </div>

        {trade.status !== 'OPEN' && (
          <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: pos ? 'var(--green)' : pnl < 0 ? 'var(--red)' : 'var(--text-3)', flexShrink: 0 }}>
            {pos ? '+' : pnl < 0 ? '−' : ''}{fmtRp(pnl)}
          </span>
        )}

        <StatusPill status={trade.status} />

        {hasRef && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ flexShrink: 0, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .18s' }}>
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        )}
      </div>

      {open && hasRef && (
        <div className="fade-in" style={{ background: 'rgba(201,168,76,.05)', border: '1px solid rgba(201,168,76,.14)', borderRadius: 7, padding: '9px 11px', marginTop: 10 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Refleksi AI: </span>
          <span style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.65 }}>{trade.reflection}</span>
        </div>
      )}
    </div>
  );
}

type SymFilter = 'ALL' | 'XAUUSD' | 'V75';

interface Props {
  trades: Trade[];
  loading?: boolean;
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  symbolFilter?: SymFilter;
  onSymbolFilterChange?: (s: SymFilter) => void;
}

export function TradeHistoryTable({ trades, loading, page, totalPages, onPageChange, symbolFilter = 'ALL', onSymbolFilterChange }: Props) {
  const closed = trades.filter(t => t.status !== 'OPEN');
  const opens  = trades.filter(t => t.status === 'OPEN');

  const SYM_OPTS: { key: SymFilter; label: string; color: string }[] = [
    { key: 'ALL',    label: 'Semua',  color: 'var(--text-3)' },
    { key: 'XAUUSD', label: 'XAUUSD ⭐', color: 'var(--gold)' },
    { key: 'V75',    label: 'V75',    color: '#a78bfa' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
        <div className="label">{L.tradeHistory}</div>
        {onSymbolFilterChange && (
          <div style={{ display: 'flex', gap: 3 }}>
            {SYM_OPTS.map(o => (
              <button
                key={o.key}
                data-testid={`btn-trade-sym-${o.key}`}
                onClick={() => onSymbolFilterChange(o.key)}
                style={{
                  padding: '2px 7px', borderRadius: 5, fontSize: 9, fontWeight: 700, cursor: 'pointer',
                  background: symbolFilter === o.key ? (o.key === 'XAUUSD' ? 'rgba(201,168,76,.1)' : o.key === 'V75' ? 'rgba(167,139,250,.1)' : 'var(--bg-card-2)') : 'transparent',
                  border: `1px solid ${symbolFilter === o.key ? (o.key === 'XAUUSD' ? 'rgba(201,168,76,.3)' : o.key === 'V75' ? 'rgba(167,139,250,.3)' : 'var(--border-2)') : 'var(--border)'}`,
                  color: symbolFilter === o.key ? o.color : 'var(--text-3)',
                  transition: 'all .15s',
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {opens.length > 0 && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(0,214,143,.18)', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} className="glow-dot" />
            {L.openPositions} ({opens.length})
          </div>
          {opens.map(t => {
            const openPnl = Number(t.open_pnl || 0);
            const isV75 = t.symbol?.includes('Volatility') || t.symbol === 'V75';
            return (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: t.action === 'BUY' ? 'var(--green)' : 'var(--red)' }}>{t.action}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: isV75 ? '#a78bfa' : 'var(--gold)' }}>{isV75 ? 'V75' : 'XAUUSD'}</span>
                  <span style={{ fontSize: 12, color: 'var(--text)' }}>@ {Number(t.entry).toFixed(isV75 ? 3 : 2)}</span>
                </div>
                <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: openPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {openPnl >= 0 ? '+' : '−'}{fmtRp(openPnl)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {loading && (
          <>
            {[1,2,3].map(i => (
              <div key={i} style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '11px 13px', display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 44, height: 22, borderRadius: 6, background: 'linear-gradient(90deg, var(--bg-card-2) 25%, var(--border) 50%, var(--bg-card-2) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 12, width: '50%', borderRadius: 4, background: 'linear-gradient(90deg, var(--bg-card-2) 25%, var(--border) 50%, var(--bg-card-2) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
                    <div style={{ height: 9, width: '30%', borderRadius: 4, marginTop: 5, background: 'linear-gradient(90deg, var(--bg-card-2) 25%, var(--border) 50%, var(--bg-card-2) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
                  </div>
                  <div style={{ width: 60, height: 20, borderRadius: 6, background: 'linear-gradient(90deg, var(--bg-card-2) 25%, var(--border) 50%, var(--bg-card-2) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
                </div>
              </div>
            ))}
          </>
        )}
        {!loading && closed.length === 0 && (
          <div className="card" style={{ padding: '28px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
            {L.noClosedTrades}
          </div>
        )}
        {!loading && closed.map(t => <TradeCard key={t.id} trade={t} />)}
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 2px' }}>
          <button
            data-testid="btn-prev-page"
            className="btn"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}
          >
            {L.prev}
          </button>
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{page} / {totalPages}</span>
          <button
            data-testid="btn-next-page"
            className="btn"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
          >
            {L.next}
          </button>
        </div>
      )}
    </div>
  );
}
