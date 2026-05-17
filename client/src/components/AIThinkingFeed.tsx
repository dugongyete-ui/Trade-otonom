import { useEffect, useRef } from 'react';
import { IconBrain, IconTrendUp, IconTrendDown, IconMinus, IconInfo, IconLightbulb } from './Icons';
import type { AIDecision } from '../types';

interface AIThinkingFeedProps {
  decisions: AIDecision[];
  isThinking: boolean;
  marketStatus?: 'open' | 'closed' | 'unknown';
}

function ActionBadge({ action }: { action: string }) {
  const cls = action === 'BUY' ? 'badge-buy' : action === 'SELL' ? 'badge-sell' : 'badge-hold';
  const Icon = action === 'BUY' ? IconTrendUp : action === 'SELL' ? IconTrendDown : IconMinus;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold font-mono ${cls}`}>
      <Icon size={10} />
      {action}
    </span>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 75 ? 'var(--green)' : pct >= 50 ? 'var(--gold)' : 'var(--red)';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 rounded-full overflow-hidden" style={{ height: '4px', background: 'var(--border)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-xs font-mono font-semibold" style={{ color, minWidth: '34px' }}>{pct}%</span>
    </div>
  );
}

function DecisionCard({ decision, isLatest }: { decision: AIDecision; isLatest: boolean }) {
  const hasReflection = decision.reflection && decision.reflection.trim().length > 0;
  const time = decision.timestamp
    ? new Date(decision.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '';

  return (
    <div
      className={`card p-4 flex flex-col gap-3 ${isLatest ? 'animate-slide-in' : ''}`}
      style={isLatest ? { borderColor: 'var(--border-bright)' } : {}}
      data-testid={`decision-card-${decision.id ?? 'latest'}`}
    >
      {hasReflection && (
        <div
          className="p-3 rounded-md flex gap-2 animate-fade-in"
          style={{ background: 'rgba(212, 175, 55, 0.08)', border: '1px solid var(--gold-dim)' }}
          data-testid="reflection-card"
        >
          <IconLightbulb size={14} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--gold)' }} />
          <div>
            <div className="text-xs font-semibold mb-1" style={{ color: 'var(--gold)' }}>
              Belajar dari Kesalahan
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {decision.reflection}
            </p>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <ActionBadge action={decision.action} />
          <span className="font-mono text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {decision.symbol}
          </span>
          {decision.strategy && (
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
              {decision.strategy}
            </span>
          )}
        </div>
        {time && (
          <span className="text-xs font-mono flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{time}</span>
        )}
      </div>

      {decision.action !== 'HOLD' && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Entry', value: Number(decision.entry).toFixed(2) },
            { label: 'SL', value: Number(decision.sl).toFixed(2) },
            { label: 'TP', value: Number(decision.tp).toFixed(2) },
            { label: 'Lot', value: String(decision.lot ?? '0.01') }
          ].map(({ label, value }) => (
            <div key={label} className="text-center py-2 rounded" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{label}</div>
              <div className="font-mono text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      <div>
        <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Confidence</div>
        <ConfidenceBar value={Number(decision.confidence)} />
      </div>

      {decision.reasoning && (
        <div>
          <div className="text-xs mb-1 font-semibold" style={{ color: 'var(--text-muted)' }}>Analisis AI</div>
          <p
            className="text-xs leading-relaxed"
            style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}
            data-testid="reasoning-text"
          >
            {decision.reasoning}
          </p>
        </div>
      )}

      {(decision.trade_status === 'TP_HIT' || decision.trade_status === 'SL_HIT') && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded text-xs font-semibold font-mono"
          style={{
            background: decision.trade_status === 'TP_HIT' ? 'rgba(0,200,83,0.1)' : 'rgba(255,23,68,0.1)',
            border: `1px solid ${decision.trade_status === 'TP_HIT' ? 'rgba(0,200,83,0.3)' : 'rgba(255,23,68,0.3)'}`,
            color: decision.trade_status === 'TP_HIT' ? 'var(--green)' : 'var(--red)'
          }}
        >
          {decision.trade_status === 'TP_HIT' ? '✓ TP Hit' : '✗ SL Hit'}
          {decision.trade_pnl !== undefined && (
            <span className="ml-auto">
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
    <div className="card p-4 animate-fade-in" style={{ borderColor: 'rgba(212,175,55,0.3)' }} data-testid="thinking-card">
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center animate-pulse-gold"
          style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid var(--gold-dim)' }}
        >
          <IconBrain size={16} style={{ color: 'var(--gold)' }} />
        </div>
        <div>
          <div className="text-sm font-semibold" style={{ color: 'var(--gold)' }}>
            DzeckAI sedang menganalisis pasar
          </div>
          <div className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
            <span>Memproses data XAUUSD + makro</span>
            <span className="thinking-animation" />
          </div>
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

  const dataLabel = marketStatus === 'closed'
    ? 'XAUUSD · Market Tutup'
    : marketStatus === 'open'
      ? 'XAUUSD · Deriv Live'
      : 'XAUUSD · Simulasi';

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-1 mb-3 flex-shrink-0">
        <div className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--gold)', letterSpacing: '0.12em' }}>
          AI Decision Feed
        </div>
        <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
          <IconInfo size={10} />
          <span>{dataLabel}</span>
        </div>
      </div>

      {marketStatus === 'closed' && (
        <div
          className="mb-3 px-3 py-2 rounded text-xs flex items-center gap-2 flex-shrink-0"
          style={{ background: 'rgba(255,23,68,0.06)', border: '1px solid rgba(255,23,68,0.2)', color: 'var(--text-muted)' }}
        >
          <span style={{ color: 'var(--red)', fontWeight: 600 }}>Market Tutup</span>
          <span>— Deriv XAUUSD tidak tersedia saat ini. AI menganalisis data historis terakhir.</span>
        </div>
      )}

      <div
        ref={feedRef}
        className="flex flex-col gap-3 overflow-y-auto flex-1"
        style={{ minHeight: 0 }}
        data-testid="ai-feed"
      >
        {isThinking && <ThinkingCard />}

        {decisions.length === 0 && !isThinking && (
          <div className="card p-6 text-center">
            <IconBrain size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Menunggu keputusan AI pertama...
            </div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Loop trading akan dimulai dalam beberapa detik
            </div>
          </div>
        )}

        {decisions.map((decision, i) => (
          <DecisionCard
            key={decision.id ?? i}
            decision={decision}
            isLatest={i === 0 && !isThinking}
          />
        ))}
      </div>
    </div>
  );
}
