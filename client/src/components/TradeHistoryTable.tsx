import { useState } from 'react';
import type { Trade } from '../types';

interface TradeHistoryTableProps {
  trades: Trade[];
  loading?: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string; border: string }> = {
    TP_HIT: { label: 'TP Hit', color: 'var(--green)', bg: 'var(--green-dim)', border: 'rgba(0,214,143,0.25)' },
    SL_HIT: { label: 'SL Hit', color: 'var(--red)', bg: 'var(--red-dim)', border: 'rgba(255,71,87,0.25)' },
    OPEN: { label: 'Open', color: 'var(--gold)', bg: 'var(--gold-glow)', border: 'rgba(201,168,76,0.25)' },
    CLOSED: { label: 'Closed', color: 'var(--text-muted)', bg: 'var(--bg-secondary)', border: 'var(--border)' },
  };
  const c = map[status] || map.CLOSED;
  return (
    <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, color: c.color, background: c.bg, border: `1px solid ${c.border}`, whiteSpace: 'nowrap' }}>
      {c.label}
    </span>
  );
}

function TradeCard({ trade }: { trade: Trade }) {
  const [expanded, setExpanded] = useState(false);
  const pnl = Number(trade.pnl || 0);
  const isProfit = pnl > 0;
  const entryTime = new Date(trade.open_time).toLocaleString('id-ID', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const hasReflection = !!trade.reflection;

  return (
    <div
      onClick={() => hasReflection && setExpanded(!expanded)}
      style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px',
        cursor: hasReflection ? 'pointer' : 'default', transition: 'border-color 0.15s',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Action */}
        <span className="font-mono" style={{
          fontSize: 12, fontWeight: 800, color: trade.action === 'BUY' ? 'var(--green)' : 'var(--red)',
          background: trade.action === 'BUY' ? 'var(--green-dim)' : 'var(--red-dim)',
          border: `1px solid ${trade.action === 'BUY' ? 'rgba(0,214,143,0.25)' : 'rgba(255,71,87,0.25)'}`,
          padding: '2px 8px', borderRadius: 6,
        }}>
          {trade.action}
        </span>

        {/* Entry / Close */}
        <div style={{ flex: 1 }}>
          <div className="font-mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            {Number(trade.entry).toFixed(2)}
            {trade.close_price && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> → {Number(trade.close_price).toFixed(2)}</span>}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{entryTime}</div>
        </div>

        {/* PnL */}
        {trade.status !== 'OPEN' && (
          <div className="font-mono" style={{ fontSize: 13, fontWeight: 700, color: isProfit ? 'var(--green)' : pnl < 0 ? 'var(--red)' : 'var(--text-muted)', textAlign: 'right' }}>
            {isProfit ? '+' : ''}${pnl.toFixed(2)}
          </div>
        )}

        <StatusPill status={trade.status} />

        {hasReflection && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ flexShrink: 0, transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        )}
      </div>

      {expanded && hasReflection && (
        <div className="animate-fade-in" style={{ background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.15)', borderRadius: 8, padding: '10px 12px' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Refleksi AI: </span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{trade.reflection}</span>
        </div>
      )}
    </div>
  );
}

export function TradeHistoryTable({ trades, loading, page, totalPages, onPageChange }: TradeHistoryTableProps) {
  const closedTrades = trades.filter(t => t.status !== 'OPEN');
  const openTrades = trades.filter(t => t.status === 'OPEN');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '0 2px' }}>
        Riwayat Trade
      </div>

      {/* Open trades */}
      {openTrades.length > 0 && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(0,214,143,0.2)', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <div className="glow-green" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)' }} />
            Posisi Terbuka ({openTrades.length})
          </div>
          {openTrades.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="font-mono" style={{ fontSize: 12, fontWeight: 700, color: t.action === 'BUY' ? 'var(--green)' : 'var(--red)' }}>{t.action}</span>
                <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>@ {Number(t.entry).toFixed(2)}</span>
              </div>
              <span className="font-mono" style={{ fontSize: 13, fontWeight: 700, color: Number(t.open_pnl || 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {Number(t.open_pnl || 0) >= 0 ? '+' : ''}${Number(t.open_pnl || 0).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Closed trades */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: 13 }}>Memuat...</div>
        )}
        {!loading && closedTrades.length === 0 && (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Belum ada trade yang selesai
          </div>
        )}
        {!loading && closedTrades.map(t => <TradeCard key={t.id} trade={t} />)}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 2px' }}>
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}
            style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              color: page === 1 ? 'var(--text-muted)' : 'var(--text-secondary)',
              cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1,
            }}
          >
            ← Prev
          </button>
          <span className="font-mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{page} / {totalPages}</span>
          <button
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              color: page === totalPages ? 'var(--text-muted)' : 'var(--text-secondary)',
              cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.4 : 1,
            }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
