import { useEffect, useRef } from 'react';
import type { AIDecision } from '../types';

interface AIThinkingFeedProps {
  decisions: AIDecision[];
  isThinking: boolean;
  marketStatus?: 'open' | 'closed' | 'unknown';
}

function ActionBadge({ action }: { action: string }) {
  const cls = action === 'BUY' ? 'badge-buy' : action === 'SELL' ? 'badge-sell' : 'badge-hold';
  return (
    <span className={cls} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.05em' }}>
      {action}
    </span>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 75 ? 'var(--green)' : pct >= 50 ? 'var(--gold)' : 'var(--red)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'var(--border-bright)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.6s ease' }} />
      </div>
      <span className="font-mono" style={{ fontSize: 11, fontWeight: 700, color, minWidth: 34, textAlign: 'right' }}>{pct}%</span>
    </div>
  );
}

function PricePill({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ flex: 1, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
      <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>{label}</div>
      <div className="font-mono" style={{ fontSize: 13, fontWeight: 700, color: highlight ? 'var(--gold)' : 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}

function DecisionCard({ decision, isLatest }: { decision: AIDecision; isLatest: boolean }) {
  const hasReflection = decision.reflection && decision.reflection.trim().length > 0;
  const time = decision.timestamp
    ? new Date(decision.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '';
  const isBuy = decision.action === 'BUY';
  const isSell = decision.action === 'SELL';

  return (
    <div className={isLatest ? 'animate-slide-up' : ''} style={{
      background: 'var(--bg-card)',
      border: `1px solid ${isLatest ? 'var(--border-bright)' : 'var(--border)'}`,
      borderRadius: 12,
      padding: '14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      {/* Reflection */}
      {hasReflection && (
        <div style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 8, padding: '10px 12px', display: 'flex', gap: 10 }}>
          <div style={{ flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--gold)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>Belajar dari Kesalahan</div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{decision.reflection}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <ActionBadge action={decision.action} />
          <span className="font-mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{decision.symbol}</span>
          {decision.strategy && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-secondary)', border: '1px solid var(--border)', padding: '2px 7px', borderRadius: 6, fontWeight: 500 }}>
              {decision.strategy}
            </span>
          )}
        </div>
        {time && <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{time}</span>}
      </div>

      {/* Price pills */}
      {decision.action !== 'HOLD' && (
        <div style={{ display: 'flex', gap: 6 }}>
          <PricePill label="Entry" value={Number(decision.entry).toFixed(2)} highlight />
          <PricePill label="SL" value={Number(decision.sl).toFixed(2)} />
          <PricePill label="TP" value={Number(decision.tp).toFixed(2)} />
          <PricePill label="Lot" value={String(decision.lot ?? '0.01')} />
        </div>
      )}

      {/* Confidence */}
      <div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Confidence</div>
        <ConfidenceBar value={Number(decision.confidence)} />
      </div>

      {/* Reasoning */}
      {decision.reasoning && (
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Analisis AI</div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.65 }}>{decision.reasoning}</p>
        </div>
      )}

      {/* Trade result */}
      {(decision.trade_status === 'TP_HIT' || decision.trade_status === 'SL_HIT') && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
          background: decision.trade_status === 'TP_HIT' ? 'var(--green-dim)' : 'var(--red-dim)',
          border: `1px solid ${decision.trade_status === 'TP_HIT' ? 'rgba(0,214,143,0.25)' : 'rgba(255,71,87,0.25)'}`,
          color: decision.trade_status === 'TP_HIT' ? 'var(--green)' : 'var(--red)',
        }}>
          <span>{decision.trade_status === 'TP_HIT' ? '✓ Take Profit' : '✗ Stop Loss'}</span>
          {decision.trade_pnl !== undefined && (
            <span className="font-mono" style={{ marginLeft: 'auto' }}>
              {Number(decision.trade_pnl) >= 0 ? '+' : ''}${Number(decision.trade_pnl).toFixed(2)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function ThinkingCard() {
  return (
    <div className="animate-fade-in" style={{
      background: 'var(--bg-card)', border: '1px solid rgba(201,168,76,0.25)',
      borderRadius: 12, padding: '16px', display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        background: 'var(--gold-glow)', border: '1px solid rgba(201,168,76,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }} className="animate-pulse-gold">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/><circle cx="12" cy="12" r="10"/>
        </svg>
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gold)', marginBottom: 3 }}>
          DzeckAI menganalisis pasar
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Memproses data XAUUSD &amp; makro<span className="thinking-animation" />
        </div>
      </div>
    </div>
  );
}

export function AIThinkingFeed({ decisions, isThinking, marketStatus }: AIThinkingFeedProps) {
  const feedRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = 0;
  }, [decisions.length]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Market closed banner */}
      {marketStatus === 'closed' && (
        <div style={{
          padding: '10px 14px', borderRadius: 10, fontSize: 12,
          background: 'rgba(255,71,87,0.06)', border: '1px solid rgba(255,71,87,0.18)',
          display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)',
        }}>
          <span style={{ color: 'var(--red)', fontWeight: 700 }}>Market Tutup</span>
          <span>— AI menunggu XAUUSD buka kembali</span>
        </div>
      )}

      {/* Header label */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>AI Decision Feed</div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>
          {marketStatus === 'open' ? '● Deriv Live' : marketStatus === 'closed' ? '○ Market Tutup' : '○ Connecting'}
        </div>
      </div>

      <div ref={feedRef} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {isThinking && <ThinkingCard />}

        {decisions.length === 0 && !isThinking && (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '40px 20px', textAlign: 'center' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px' }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 500 }}>Menunggu keputusan AI...</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Loop trading dimulai saat market buka</div>
          </div>
        )}

        {decisions.map((d, i) => (
          <DecisionCard key={d.id ?? i} decision={d} isLatest={i === 0 && !isThinking} />
        ))}
      </div>
    </div>
  );
}
