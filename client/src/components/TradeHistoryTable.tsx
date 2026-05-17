import { useState } from 'react';
import { IconChevronDown, IconChevronRight, IconTrendUp, IconTrendDown, IconChevronLeft } from './Icons';
import type { Trade } from '../types';

interface TradeHistoryTableProps {
  trades: Trade[];
  loading?: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string; bg: string; border: string }> = {
    TP_HIT: { label: 'TP Hit', color: 'var(--green)', bg: 'rgba(0,200,83,0.1)', border: 'rgba(0,200,83,0.3)' },
    SL_HIT: { label: 'SL Hit', color: 'var(--red)', bg: 'rgba(255,23,68,0.1)', border: 'rgba(255,23,68,0.3)' },
    OPEN: { label: 'Open', color: 'var(--gold)', bg: 'rgba(212,175,55,0.1)', border: 'rgba(212,175,55,0.3)' },
    CLOSED: { label: 'Closed', color: 'var(--text-muted)', bg: 'var(--bg-secondary)', border: 'var(--border)' }
  };
  const c = config[status] || config.CLOSED;
  return (
    <span className="px-1.5 py-0.5 rounded text-xs font-semibold" style={{ color: c.color, background: c.bg, border: `1px solid ${c.border}` }}>
      {c.label}
    </span>
  );
}

function TradeRow({ trade }: { trade: Trade }) {
  const [expanded, setExpanded] = useState(false);
  const pnl = Number(trade.pnl || 0);
  const isProfit = pnl > 0;
  const entryTime = new Date(trade.open_time).toLocaleString('id-ID', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const hasReflection = !!trade.reflection;

  return (
    <>
      <tr
        className="border-b transition-colors duration-150 cursor-pointer"
        style={{ borderColor: 'var(--border)' }}
        onClick={() => hasReflection && setExpanded(!expanded)}
        data-testid={`trade-row-${trade.id}`}
      >
        <td className="py-2 pl-3 pr-2">
          <div className="flex items-center gap-1">
            {hasReflection ? (
              expanded
                ? <IconChevronDown size={12} style={{ color: 'var(--gold)' }} />
                : <IconChevronRight size={12} style={{ color: 'var(--text-muted)' }} />
            ) : <div style={{ width: 12 }} />}
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{entryTime}</span>
          </div>
        </td>
        <td className="py-2 px-2">
          <div className="flex items-center gap-1">
            {trade.action === 'BUY'
              ? <IconTrendUp size={10} style={{ color: 'var(--green)' }} />
              : <IconTrendDown size={10} style={{ color: 'var(--red)' }} />
            }
            <span className="text-xs font-semibold" style={{ color: trade.action === 'BUY' ? 'var(--green)' : 'var(--red)' }}>
              {trade.action}
            </span>
          </div>
        </td>
        <td className="py-2 px-2">
          <div className="font-mono text-xs" style={{ color: 'var(--text-primary)' }}>
            {Number(trade.entry).toFixed(2)}
          </div>
          {trade.close_price && (
            <div className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
              → {Number(trade.close_price).toFixed(2)}
            </div>
          )}
        </td>
        <td className="py-2 px-2">
          {trade.status !== 'OPEN' ? (
            <span className="font-mono text-xs font-bold" style={{ color: isProfit ? 'var(--green)' : pnl < 0 ? 'var(--red)' : 'var(--text-muted)' }}>
              {isProfit ? '+' : ''}${pnl.toFixed(2)}
            </span>
          ) : (
            <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
          )}
        </td>
        <td className="py-2 pr-3">
          <StatusBadge status={trade.status} />
        </td>
      </tr>
      {expanded && hasReflection && (
        <tr style={{ background: 'rgba(212,175,55,0.04)' }} data-testid={`trade-reflection-${trade.id}`}>
          <td colSpan={5} className="px-4 py-3">
            <div className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              <span className="font-semibold" style={{ color: 'var(--gold)' }}>Refleksi AI: </span>
              {trade.reflection}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function TradeHistoryTable({ trades, loading, page, totalPages, onPageChange }: TradeHistoryTableProps) {
  const closedTrades = trades.filter(t => t.status !== 'OPEN');
  const openTrades = trades.filter(t => t.status === 'OPEN');

  return (
    <div className="flex flex-col gap-3">
      <div className="px-1">
        <div className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--gold)', letterSpacing: '0.12em' }}>
          Riwayat Trade
        </div>
      </div>

      {openTrades.length > 0 && (
        <div className="card p-3 mb-1" data-testid="open-trades-section">
          <div className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: 'var(--gold)' }}>
            <div className="w-2 h-2 rounded-full glow-green" style={{ background: 'var(--green)' }} />
            Posisi Terbuka ({openTrades.length})
          </div>
          {openTrades.map(t => (
            <div key={t.id} className="flex items-center justify-between py-1.5 text-xs" data-testid={`open-trade-${t.id}`}>
              <div className="flex items-center gap-2">
                <span className="font-mono" style={{ color: t.action === 'BUY' ? 'var(--green)' : 'var(--red)' }}>
                  {t.action}
                </span>
                <span style={{ color: 'var(--text-primary)' }}>@ {Number(t.entry).toFixed(2)}</span>
              </div>
              <span className="font-mono font-semibold" style={{ color: Number(t.open_pnl || 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {Number(t.open_pnl || 0) >= 0 ? '+' : ''}${Number(t.open_pnl || 0).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="card overflow-hidden" data-testid="trade-history-table">
        <div className="overflow-x-auto">
          <table className="w-full" style={{ minWidth: '300px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                {['Waktu', 'Arah', 'Entry→Close', 'PnL', 'Status'].map(h => (
                  <th key={h} className="text-left py-2 px-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                    Memuat data...
                  </td>
                </tr>
              )}
              {!loading && closedTrades.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                    Belum ada trade yang selesai
                  </td>
                </tr>
              )}
              {!loading && closedTrades.map(t => (
                <TradeRow key={t.id} trade={t} />
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div
            className="flex items-center justify-between px-3 py-2"
            style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}
            data-testid="pagination-controls"
          >
            <button
              onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded disabled:opacity-30"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: page === 1 ? 'not-allowed' : 'pointer' }}
              data-testid="pagination-prev"
            >
              <IconChevronLeft size={12} />
              Prev
            </button>
            <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
              {page} / {totalPages}
            </span>
            <button
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded disabled:opacity-30"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: page === totalPages ? 'not-allowed' : 'pointer' }}
              data-testid="pagination-next"
            >
              Next
              <IconChevronRight size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
