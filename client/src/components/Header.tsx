import { useState, useEffect, useRef } from 'react';
import type { ActiveSymbol } from '../types';
import { L } from '../lib/labels';

interface HeaderProps {
  wsStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  isThinking: boolean;
  marketStatus?: 'open' | 'closed' | 'unknown';
  derivConnected?: boolean;
  currentPrice?: number | null;
  activeSymbol?: ActiveSymbol;
  xauusdStatus?: 'open' | 'closed' | 'unknown';
  aiPaused: boolean;
  onPauseToggle: () => void;
}

export function Header({
  wsStatus, isThinking, marketStatus = 'unknown', currentPrice,
  activeSymbol = 'XAUUSD', xauusdStatus, aiPaused, onPauseToggle,
}: HeaderProps) {
  const [time, setTime] = useState(new Date());
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const prevPriceRef = useRef<number | null>(null);
  const [confirmingPause, setConfirmingPause] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (currentPrice == null) return;
    const prev = prevPriceRef.current;
    if (prev !== null && prev !== currentPrice) {
      setFlash(currentPrice > prev ? 'up' : 'down');
      const t = setTimeout(() => setFlash(null), 600);
      return () => clearTimeout(t);
    }
    prevPriceRef.current = currentPrice;
  }, [currentPrice]);

  useEffect(() => {
    if (currentPrice != null) prevPriceRef.current = currentPrice;
  }, [currentPrice]);

  const fmt = (d: Date) =>
    d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Jakarta' });

  const isV75  = activeSymbol === 'V75';
  const isOpen = marketStatus === 'open';
  const wsOk   = wsStatus === 'connected';
  const priceDecimals = isV75 ? 3 : 2;

  const flashColor = flash === 'up' ? 'var(--green)' : flash === 'down' ? 'var(--red)' : 'var(--text)';

  function handlePauseClick() {
    if (!aiPaused && !confirmingPause) {
      setConfirmingPause(true);
      return;
    }
    setConfirmingPause(false);
    onPauseToggle();
  }

  function handleCancelConfirm() {
    setConfirmingPause(false);
  }

  return (
    <header className="header" style={{ gap: 8 }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9, flexShrink: 0,
          background: 'linear-gradient(135deg, #C9A84C 0%, #7a5c1e 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: 13, color: '#000', letterSpacing: '-0.5px',
          boxShadow: '0 0 0 1px rgba(201,168,76,0.2)',
        }}>DZ</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--gold)', letterSpacing: '.01em', lineHeight: 1.25 }}>
            DzeckAI Trader
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-3)', fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase' }}>
            Otonom · XAUUSD
          </div>
        </div>
      </div>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>

        {/* Confirm pause dialog */}
        {confirmingPause && (
          <div style={{
            position: 'absolute', top: 56, right: 14, zIndex: 200,
            background: 'var(--bg-card)', border: '1px solid rgba(245,54,92,.25)',
            borderRadius: 12, padding: '14px 16px', minWidth: 240, boxShadow: '0 8px 32px rgba(0,0,0,.5)',
          }}>
            <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 12, lineHeight: 1.6 }}>
              {L.confirmPause}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handlePauseClick} style={{
                flex: 1, padding: '7px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                background: 'var(--red-d)', border: '1px solid rgba(245,54,92,.25)', color: 'var(--red)',
              }}>Jeda</button>
              <button onClick={handleCancelConfirm} style={{
                flex: 1, padding: '7px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                background: 'var(--bg)', border: '1px solid var(--border-2)', color: 'var(--text-2)',
              }}>Batal</button>
            </div>
          </div>
        )}

        {/* AI Pause/Resume toggle */}
        <button
          data-testid="btn-ai-pause-resume"
          onClick={handlePauseClick}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 10px', borderRadius: 20, cursor: 'pointer',
            background: aiPaused ? 'rgba(245,54,92,.12)' : 'rgba(0,214,143,.08)',
            border: `1px solid ${aiPaused ? 'rgba(245,54,92,.3)' : 'rgba(0,214,143,.2)'}`,
            fontSize: 10, color: aiPaused ? 'var(--red)' : 'var(--green)',
            fontWeight: 700, letterSpacing: '.03em', transition: 'all .2s',
          }}
        >
          <span style={{
            width: 5, height: 5, borderRadius: '50%',
            background: aiPaused ? 'var(--red)' : 'var(--green)',
            display: 'inline-block', flexShrink: 0,
          }} className={aiPaused ? 'pulse-gold' : 'glow-dot'} />
          {aiPaused ? L.aiPaused : L.aiActive}
        </button>

        {/* Thinking */}
        {isThinking && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', borderRadius: 20,
            background: 'var(--gold-glow)', border: '1px solid rgba(201,168,76,.25)',
            fontSize: 10, color: 'var(--gold)', fontWeight: 600,
          }}>
            <span className="pulse-gold" style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--gold)', display: 'inline-block', flexShrink: 0 }} />
            {L.aiThinking}
          </div>
        )}

        {/* V75 active indicator */}
        {isV75 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '4px 9px', borderRadius: 20,
            background: 'rgba(139,92,246,.1)', border: '1px solid rgba(139,92,246,.25)',
            fontSize: 10, color: '#a78bfa', fontWeight: 700, letterSpacing: '.03em',
          }}>
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#a78bfa', display: 'inline-block' }} className="pulse-gold" />
            V75 · 24/7
          </div>
        )}

        {/* Price + market */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 20,
          background: isOpen ? 'rgba(0,214,143,.07)' : 'rgba(245,54,92,.07)',
          border: `1px solid ${isOpen ? 'rgba(0,214,143,.18)' : 'rgba(245,54,92,.18)'}`,
          transition: 'background .3s',
        }}>
          <span style={{
            width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
            background: isOpen ? 'var(--green)' : marketStatus === 'closed' ? 'var(--red)' : 'var(--text-3)',
          }} />
          {currentPrice ? (
            <span
              data-testid="text-current-price"
              className="mono"
              style={{
                fontSize: 12, fontWeight: 700, letterSpacing: '.01em',
                color: flash ? flashColor : 'var(--text)',
                transition: 'color .3s',
              }}
            >
              {Number(currentPrice).toFixed(priceDecimals)}
            </span>
          ) : (
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-3)' }}>
              {xauusdStatus === 'closed' && !isV75 ? 'Tutup' : L.connecting}
            </span>
          )}
        </div>

        {/* Clock */}
        <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', letterSpacing: '.02em' }}>
          {fmt(time)}
        </span>

        {/* WS dot */}
        <span style={{
          width: 6, height: 6, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
          background: wsOk ? 'var(--green)' : wsStatus === 'connecting' ? 'var(--gold)' : 'var(--red)',
        }} className={wsOk ? 'glow-dot' : ''} title={`SSE: ${wsStatus}`} />
      </div>
    </header>
  );
}
