import { useRef, useEffect } from 'react';
import type { AIDecision } from '../types';
import { L } from '../lib/labels';

interface Props {
  decisions: AIDecision[];
  isThinking: boolean;
  loading?: boolean;
  marketStatus?: 'open' | 'closed' | 'unknown';
  activeSymbol?: 'XAUUSD' | 'V75';
  xauusdStatus?: 'open' | 'closed' | 'unknown';
}

function Badge({ action }: { action: string }) {
  const cls = action === 'BUY' ? 'badge badge-buy' : action === 'SELL' ? 'badge badge-sell' : 'badge badge-hold';
  return <span className={cls}>{action}</span>;
}

function ConfBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 75 ? 'var(--green)' : pct >= 50 ? 'var(--gold)' : 'var(--red)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'var(--border-2)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width .5s ease' }} />
      </div>
      <span className="mono" style={{ fontSize: 11, fontWeight: 700, color, minWidth: 32, textAlign: 'right' }}>{pct}%</span>
    </div>
  );
}

function PricePill({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 8px', textAlign: 'center' }}>
      <div className="label" style={{ marginBottom: 3 }}>{label}</div>
      <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: highlight ? 'var(--gold)' : 'var(--text)' }}>{value}</div>
    </div>
  );
}

function Card({ d, latest }: { d: AIDecision; latest: boolean }) {
  const hasRef = d.reflection && d.reflection.trim().length > 0;
  const time = d.timestamp
    ? new Date(d.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '';

  return (
    <div
      data-testid={`card-decision-${d.id ?? 'latest'}`}
      className={latest ? 'slide-up' : ''}
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${latest ? 'var(--border-2)' : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        padding: '14px',
        display: 'flex', flexDirection: 'column', gap: 11,
      }}
    >
      {/* Reflection */}
      {hasRef && (
        <div style={{ background: 'rgba(201,168,76,.05)', border: '1px solid rgba(201,168,76,.18)', borderRadius: 9, padding: '10px 12px', display: 'flex', gap: 10 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
            <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
          </svg>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--gold)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 4 }}>Belajar dari Kesalahan</div>
            <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.65 }}>{d.reflection}</p>
          </div>
        </div>
      )}

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Badge action={d.action} />
          <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{d.symbol}</span>
          {d.strategy && (
            <span style={{ fontSize: 9, color: 'var(--text-3)', background: 'var(--bg)', border: '1px solid var(--border)', padding: '2px 7px', borderRadius: 5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase' }}>
              {d.strategy}
            </span>
          )}
        </div>
        {time && <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)', flexShrink: 0 }}>{time}</span>}
      </div>

      {/* Price pills */}
      {d.action !== 'HOLD' && (
        <div style={{ display: 'flex', gap: 6 }}>
          <PricePill label="Harga Entry" value={Number(d.entry).toFixed(2)} highlight />
          <PricePill label="Batas Rugi" value={Number(d.sl).toFixed(2)} />
          <PricePill label="Batas Untung" value={Number(d.tp).toFixed(2)} />
          <PricePill label="Ukuran Lot" value={String(d.lot ?? '0.01')} />
        </div>
      )}

      {/* Confidence */}
      <div>
        <div className="label" style={{ marginBottom: 6 }}>{L.confidence}</div>
        <ConfBar value={Number(d.confidence)} />
      </div>

      {/* Reasoning */}
      {d.reasoning && (
        <div>
          <div className="label" style={{ marginBottom: 6 }}>{L.analysisAI}</div>
          <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7 }}>{d.reasoning}</p>
        </div>
      )}

      {/* Trade result */}
      {(d.trade_status === 'TP_HIT' || d.trade_status === 'SL_HIT') && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
          background: d.trade_status === 'TP_HIT' ? 'var(--green-d)' : 'var(--red-d)',
          border: `1px solid ${d.trade_status === 'TP_HIT' ? 'rgba(0,214,143,.2)' : 'rgba(245,54,92,.2)'}`,
          color: d.trade_status === 'TP_HIT' ? 'var(--green)' : 'var(--red)',
        }}>
          <span>{d.trade_status === 'TP_HIT' ? '✓ Batas Untung Tercapai' : '✗ Batas Rugi Terkena'}</span>
          {d.trade_pnl !== undefined && (() => {
            const pnl = Number(d.trade_pnl);
            const abs = Math.abs(pnl).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
            return (
              <span className="mono" style={{ marginLeft: 'auto' }}>
                {pnl >= 0 ? '+' : '−'}Rp {abs}
              </span>
            );
          })()}
        </div>
      )}
    </div>
  );
}

function ThinkingCard() {
  return (
    <div className="fade-in" style={{
      background: 'var(--bg-card)', border: '1px solid rgba(201,168,76,.2)',
      borderRadius: 'var(--radius)', padding: '14px',
      display: 'flex', alignItems: 'center', gap: 13,
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
        background: 'var(--gold-glow)', border: '1px solid rgba(201,168,76,.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }} className="pulse-gold">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/><circle cx="12" cy="12" r="10"/>
        </svg>
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gold)', marginBottom: 3 }}>
          DzeckAI menganalisis pasar
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
          Memproses data XAUUSD &amp; makro<span className="thinking" />
        </div>
      </div>
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[1, 2].map(i => (
        <div key={i} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 44, height: 22, borderRadius: 6, background: 'linear-gradient(90deg, var(--bg-card-2) 25%, var(--border) 50%, var(--bg-card-2) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
            <div style={{ width: 80, height: 14, borderRadius: 4, background: 'linear-gradient(90deg, var(--bg-card-2) 25%, var(--border) 50%, var(--bg-card-2) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[1, 2, 3, 4].map(j => (
              <div key={j} style={{ flex: 1, height: 44, borderRadius: 8, background: 'linear-gradient(90deg, var(--bg-card-2) 25%, var(--border) 50%, var(--bg-card-2) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
            ))}
          </div>
          <div style={{ height: 8, borderRadius: 4, background: 'linear-gradient(90deg, var(--bg-card-2) 25%, var(--border) 50%, var(--bg-card-2) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {[1, 2, 3].map(j => (
              <div key={j} style={{ height: 10, width: `${85 - j * 10}%`, borderRadius: 4, background: 'linear-gradient(90deg, var(--bg-card-2) 25%, var(--border) 50%, var(--bg-card-2) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function AIThinkingFeed({ decisions, isThinking, loading, marketStatus, activeSymbol = 'XAUUSD', xauusdStatus }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = 0;
  }, [decisions.length]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%', minHeight: 0 }}>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px', flexShrink: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gold)', letterSpacing: '.12em', textTransform: 'uppercase' }}>
          {L.aiDecisionFeed}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{
            width: 5, height: 5, borderRadius: '50%', background: marketStatus === 'open' ? 'var(--green)' : 'var(--text-3)', display: 'inline-block'
          }} className={marketStatus === 'open' ? 'glow-dot' : ''} />
          <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 500 }}>
            {marketStatus === 'open' ? L.deriv : marketStatus === 'closed' ? L.marketClosed : L.connecting}
          </span>
        </div>
      </div>

      {/* Market status banner */}
      {activeSymbol === 'V75' && (
        <div style={{
          padding: '9px 13px', borderRadius: 9, fontSize: 12,
          background: 'rgba(139,92,246,.07)', border: '1px solid rgba(139,92,246,.2)',
          display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap',
        }}>
          <span style={{ color: '#a78bfa', fontWeight: 700, flexShrink: 0 }}>V75 Aktif</span>
          <span style={{ color: 'var(--text-2)' }}>— XAUUSD tutup, AI beralih ke Volatility 75 Index (Deriv Synthetic 24/7)</span>
        </div>
      )}
      {activeSymbol === 'XAUUSD' && xauusdStatus === 'closed' && (
        <div style={{
          padding: '9px 13px', borderRadius: 9, fontSize: 12,
          background: 'rgba(245,54,92,.06)', border: '1px solid rgba(245,54,92,.15)',
          display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-2)', flexShrink: 0,
        }}>
          <span style={{ color: 'var(--red)', fontWeight: 700 }}>XAUUSD Tutup</span>
          <span>— Menunggu konfirmasi market terbuka</span>
        </div>
      )}

      {/* Feed */}
      <div ref={ref} style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, overflow: 'auto' }}>
        {isThinking && <ThinkingCard />}

        {decisions.length === 0 && !isThinking && loading && <FeedSkeleton />}

        {decisions.length === 0 && !isThinking && !loading && (
          <div className="card" style={{ padding: '48px 20px', textAlign: 'center' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px' }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <div style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 500, marginBottom: 5 }}>Menunggu keputusan AI...</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Loop trading aktif saat market buka</div>
          </div>
        )}

        {decisions.map((d, i) => (
          <Card key={d.id ?? i} d={d} latest={i === 0 && !isThinking} />
        ))}
      </div>
    </div>
  );
}
