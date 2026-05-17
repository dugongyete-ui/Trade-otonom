import { useState } from 'react';
import { IconCopy, IconCheck, IconInfo, IconTrendUp, IconTrendDown } from './Icons';
import type { Signal } from '../types';

interface CopyTradePanelProps {
  signal: Signal;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-all duration-200"
      style={{
        background: copied ? 'rgba(0,200,83,0.1)' : 'var(--bg-secondary)',
        border: `1px solid ${copied ? 'rgba(0,200,83,0.3)' : 'var(--border)'}`,
        color: copied ? 'var(--green)' : 'var(--text-secondary)',
        cursor: 'pointer'
      }}
      data-testid={`copy-btn-${label}`}
    >
      {copied ? <IconCheck size={10} /> : <IconCopy size={10} />}
      {copied ? 'Copied!' : label}
    </button>
  );
}

function SignalRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--border)' }}>
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <div className="flex items-center gap-2">
        <span
          className="font-mono text-sm font-semibold"
          style={{ color: highlight ? 'var(--gold)' : 'var(--text-primary)' }}
        >
          {value}
        </span>
        <CopyButton text={value} label="copy" />
      </div>
    </div>
  );
}

const MT5_STEPS = [
  'Buka MetaTrader 5 di PC/HP kamu',
  'Klik kanan pada chart XAUUSD',
  'Pilih "Trading" → "New Order"',
  'Isi semua field sesuai signal di atas',
  'Klik "Sell by Market" atau "Buy by Market"',
  'Pasang SL & TP setelah order terisi'
];

export function CopyTradePanel({ signal }: CopyTradePanelProps) {
  const activeSignal = signal.hasSignal ? signal.signal : null;
  const lastDecision = signal.lastDecision;
  const displayData = activeSignal || lastDecision;
  const hasActive = !!activeSignal;

  if (!displayData) {
    return (
      <div className="flex flex-col gap-3">
        <div className="px-1">
          <div className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--gold)', letterSpacing: '0.12em' }}>
            Copy Trade MT5
          </div>
        </div>
        <div className="card p-4 text-center">
          <IconInfo size={20} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Menunggu signal AI...</div>
        </div>
      </div>
    );
  }

  const action = displayData.action;
  const entry = Number(displayData.entry).toFixed(2);
  const sl = Number(displayData.sl).toFixed(2);
  const tp = Number(displayData.tp).toFixed(2);
  const lot = activeSignal ? Number(activeSignal.lot).toFixed(2) : '0.01';
  const rr = Math.abs((Number(tp) - Number(entry)) / (Number(entry) - Number(sl))).toFixed(2);

  const actionColor = action === 'BUY' ? 'var(--green)' : action === 'SELL' ? 'var(--red)' : 'var(--text-muted)';
  const ActionIcon = action === 'BUY' ? IconTrendUp : IconTrendDown;

  return (
    <div className="flex flex-col gap-3">
      <div className="px-1">
        <div className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--gold)', letterSpacing: '0.12em' }}>
          Copy Trade MT5
        </div>
      </div>

      {hasActive ? (
        <div
          className="px-3 py-2 rounded-md flex items-center gap-2 text-xs font-semibold"
          style={{ background: 'rgba(0,200,83,0.1)', border: '1px solid rgba(0,200,83,0.3)', color: 'var(--green)' }}
          data-testid="signal-active-badge"
        >
          <div className="w-2 h-2 rounded-full glow-green" style={{ background: 'var(--green)' }} />
          Signal Aktif — Posisi Terbuka
        </div>
      ) : (
        <div
          className="px-3 py-2 rounded-md flex items-center gap-2 text-xs"
          style={{ background: 'rgba(100,120,150,0.1)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
          data-testid="signal-last-badge"
        >
          <IconInfo size={12} />
          Signal Terakhir — Tidak Ada Posisi Open
        </div>
      )}

      <div className="card p-3" data-testid="signal-details">
        <div className="flex items-center justify-between mb-3">
          <span className="font-mono text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            XAUUSD
          </span>
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-bold"
            style={{
              background: `${actionColor}1A`,
              border: `1px solid ${actionColor}4D`,
              color: actionColor
            }}
            data-testid="signal-action-badge"
          >
            <ActionIcon size={11} />
            {action}
          </div>
        </div>

        <SignalRow label="Entry Price" value={entry} highlight />
        <SignalRow label="Stop Loss" value={sl} />
        <SignalRow label="Take Profit" value={tp} />
        <SignalRow label="Lot Size" value={lot} />

        <div className="flex items-center justify-between py-2">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Risk/Reward</span>
          <span className="font-mono text-sm font-semibold" style={{ color: 'var(--gold)' }}>1:{rr}</span>
        </div>
      </div>

      {activeSignal && (
        <div className="card p-3" data-testid="open-pnl-card">
          <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Open PnL saat ini</div>
          <div
            className="font-mono text-lg font-bold"
            style={{ color: Number(activeSignal.openPnl) >= 0 ? 'var(--green)' : 'var(--red)' }}
          >
            {Number(activeSignal.openPnl) >= 0 ? '+' : ''}${Number(activeSignal.openPnl).toFixed(2)}
          </div>
        </div>
      )}

      <div className="card p-3" data-testid="mt5-instructions">
        <div className="text-xs font-semibold mb-3" style={{ color: 'var(--gold)' }}>
          Cara Entry di MT5
        </div>
        <div className="flex flex-col gap-2">
          {MT5_STEPS.map((step, i) => (
            <div key={i} className="flex items-start gap-2">
              <div
                className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5"
                style={{ background: 'rgba(212,175,55,0.15)', color: 'var(--gold)', fontSize: '9px' }}
              >
                {i + 1}
              </div>
              <span className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {step}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
