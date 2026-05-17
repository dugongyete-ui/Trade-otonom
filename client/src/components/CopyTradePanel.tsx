import { useState } from 'react';
import type { Signal } from '../types';

interface CopyTradePanelProps { signal: Signal; }

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={handle} style={{
      padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer',
      background: copied ? 'rgba(0,214,143,0.12)' : 'var(--bg-secondary)',
      border: `1px solid ${copied ? 'rgba(0,214,143,0.3)' : 'var(--border)'}`,
      color: copied ? 'var(--green)' : 'var(--text-muted)',
      transition: 'all 0.2s', flexShrink: 0,
    }}>
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  );
}

function SignalRow({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="font-mono" style={{ fontSize: 14, fontWeight: 700, color: gold ? 'var(--gold)' : 'var(--text-primary)' }}>{value}</span>
        <CopyBtn text={value} />
      </div>
    </div>
  );
}

const MT5_STEPS = [
  'Buka MetaTrader 5 di PC / HP',
  'Klik kanan chart XAUUSD → "Trading" → "New Order"',
  'Isi semua field sesuai signal di atas',
  'Klik "Buy by Market" atau "Sell by Market"',
  'Pasang SL & TP setelah order terisi',
];

export function CopyTradePanel({ signal }: CopyTradePanelProps) {
  const activeSignal = signal.hasSignal ? signal.signal : null;
  const lastDecision = signal.lastDecision;
  const displayData = activeSignal || lastDecision;
  const hasActive = !!activeSignal;

  if (!displayData) {
    return (
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '40px 20px', textAlign: 'center' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px' }}>
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>Menunggu signal AI...</div>
      </div>
    );
  }

  const action = displayData.action;
  const entry = Number(displayData.entry).toFixed(2);
  const sl = Number(displayData.sl).toFixed(2);
  const tp = Number(displayData.tp).toFixed(2);
  const lot = activeSignal ? Number(activeSignal.lot).toFixed(2) : '0.01';
  const denominator = Math.abs(Number(entry) - Number(sl));
  const rr = denominator > 0 ? (Math.abs(Number(tp) - Number(entry)) / denominator).toFixed(2) : '—';
  const actionColor = action === 'BUY' ? 'var(--green)' : action === 'SELL' ? 'var(--red)' : 'var(--text-muted)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Status badge */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600,
        background: hasActive ? 'var(--green-dim)' : 'var(--bg-card)',
        border: `1px solid ${hasActive ? 'rgba(0,214,143,0.25)' : 'var(--border)'}`,
        color: hasActive ? 'var(--green)' : 'var(--text-muted)',
      }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: hasActive ? 'var(--green)' : 'var(--text-muted)', flexShrink: 0 }} className={hasActive ? 'glow-green' : ''} />
        {hasActive ? 'Signal Aktif — Posisi Terbuka' : 'Signal Terakhir — Tidak Ada Posisi Open'}
      </div>

      {/* Signal card */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span className="font-mono" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>XAUUSD</span>
          <span style={{
            padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 800,
            fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.06em',
            background: action === 'BUY' ? 'var(--green-dim)' : action === 'SELL' ? 'var(--red-dim)' : 'rgba(61,81,102,0.2)',
            border: `1px solid ${action === 'BUY' ? 'rgba(0,214,143,0.25)' : action === 'SELL' ? 'rgba(255,71,87,0.25)' : 'var(--border)'}`,
            color: actionColor,
          }}>
            {action}
          </span>
        </div>

        <SignalRow label="Entry Price" value={entry} gold />
        <SignalRow label="Stop Loss" value={sl} />
        <SignalRow label="Take Profit" value={tp} />
        <SignalRow label="Lot Size" value={lot} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>Risk / Reward</span>
          <span className="font-mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold)' }}>1 : {rr}</span>
        </div>
      </div>

      {/* Open PnL */}
      {activeSignal && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Open PnL</div>
          <div className="font-mono" style={{ fontSize: 22, fontWeight: 700, color: Number(activeSignal.openPnl) >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {Number(activeSignal.openPnl) >= 0 ? '+' : ''}${Number(activeSignal.openPnl).toFixed(2)}
          </div>
        </div>
      )}

      {/* MT5 Steps */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Cara Entry di MT5</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {MT5_STEPS.map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{
                width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                background: 'var(--gold-glow)', border: '1px solid rgba(201,168,76,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 700, color: 'var(--gold)',
              }}>
                {i + 1}
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, paddingTop: 1 }}>{step}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
