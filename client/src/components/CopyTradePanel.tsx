import { useState } from 'react';
import type { Signal } from '../types';

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); }}
      style={{
        padding: '3px 9px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer',
        background: copied ? 'var(--green-d)' : 'var(--bg)',
        border: `1px solid ${copied ? 'rgba(0,214,143,.25)' : 'var(--border-2)'}`,
        color: copied ? 'var(--green)' : 'var(--text-3)',
        transition: 'all .15s', flexShrink: 0,
      }}
    >
      {copied ? '✓' : 'Copy'}
    </button>
  );
}

function Row({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: gold ? 'var(--gold)' : 'var(--text)' }}>{value}</span>
        <CopyBtn text={value} />
      </div>
    </div>
  );
}

const MT5_STEPS = [
  'Buka MetaTrader 5 di PC / HP',
  'Klik kanan chart XAUUSD → Trading → New Order',
  'Isi semua field sesuai signal di atas',
  'Klik "Buy by Market" atau "Sell by Market"',
  'Pasang SL & TP setelah order terisi',
];

export function CopyTradePanel({ signal }: { signal: Signal }) {
  const activeSignal = signal.hasSignal ? signal.signal : null;
  const display = activeSignal || signal.lastDecision;
  const hasActive = !!activeSignal;

  if (!display) {
    return (
      <div className="card" style={{ padding: '48px 20px', textAlign: 'center' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px' }}>
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
        <div style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 500 }}>Menunggu signal AI...</div>
      </div>
    );
  }

  const action = display.action;
  const entry = Number(display.entry).toFixed(2);
  const sl    = Number(display.sl).toFixed(2);
  const tp    = Number(display.tp).toFixed(2);
  const lot   = activeSignal ? Number(activeSignal.lot).toFixed(2) : '0.01';
  const den   = Math.abs(Number(entry) - Number(sl));
  const rr    = den > 0 ? (Math.abs(Number(tp) - Number(entry)) / den).toFixed(2) : '—';
  const aColor = action === 'BUY' ? 'var(--green)' : action === 'SELL' ? 'var(--red)' : 'var(--text-2)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* Status */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '9px 13px', borderRadius: 10, fontSize: 12, fontWeight: 600,
        background: hasActive ? 'var(--green-d)' : 'var(--bg-card)',
        border: `1px solid ${hasActive ? 'rgba(0,214,143,.2)' : 'var(--border)'}`,
        color: hasActive ? 'var(--green)' : 'var(--text-3)',
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: hasActive ? 'var(--green)' : 'var(--text-3)', flexShrink: 0, display: 'inline-block' }}
          className={hasActive ? 'glow-dot' : ''} />
        {hasActive ? 'Signal Aktif — Posisi Terbuka' : 'Signal Terakhir — No Open Position'}
      </div>

      {/* Signal card */}
      <div className="card" style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span className="mono" style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>XAUUSD</span>
          <span style={{
            padding: '4px 13px', borderRadius: 20, fontSize: 12, fontWeight: 800,
            fontFamily: 'JetBrains Mono, monospace', letterSpacing: '.06em',
            background: action === 'BUY' ? 'var(--green-d)' : action === 'SELL' ? 'var(--red-d)' : 'rgba(43,60,82,.3)',
            border: `1px solid ${action === 'BUY' ? 'rgba(0,214,143,.2)' : action === 'SELL' ? 'rgba(245,54,92,.2)' : 'var(--border-2)'}`,
            color: aColor,
          }}>{action}</span>
        </div>

        <Row label="Entry Price" value={entry} gold />
        <Row label="Stop Loss"   value={sl} />
        <Row label="Take Profit" value={tp} />
        <Row label="Lot Size"    value={lot} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500 }}>Risk / Reward</span>
          <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold)' }}>1 : {rr}</span>
        </div>
      </div>

      {/* Open PnL */}
      {activeSignal && (
        <div className="card" style={{ padding: '12px 16px' }}>
          <div className="label" style={{ marginBottom: 5 }}>Open PnL</div>
          <div className="mono" style={{ fontSize: 22, fontWeight: 800, color: Number(activeSignal.openPnl) >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {Number(activeSignal.openPnl) >= 0 ? '+' : ''}${Number(activeSignal.openPnl).toFixed(2)}
          </div>
        </div>
      )}

      {/* MT5 Steps */}
      <div className="card" style={{ padding: '14px 16px' }}>
        <div className="label" style={{ marginBottom: 12 }}>Cara Entry di MT5</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {MT5_STEPS.map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{
                width: 19, height: 19, borderRadius: 5, flexShrink: 0,
                background: 'var(--gold-glow)', border: '1px solid rgba(201,168,76,.18)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 700, color: 'var(--gold)',
              }}>{i + 1}</div>
              <span style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, paddingTop: 1 }}>{step}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
