import { useState, useEffect } from 'react';
import type { ActiveSymbol } from '../types';

interface HeaderProps {
  wsStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  isThinking: boolean;
  marketStatus?: 'open' | 'closed' | 'unknown';
  derivConnected?: boolean;
  currentPrice?: number | null;
  activeSymbol?: ActiveSymbol;
  xauusdStatus?: 'open' | 'closed' | 'unknown';
}

export function Header({ wsStatus, isThinking, marketStatus = 'unknown', currentPrice, activeSymbol = 'XAUUSD', xauusdStatus }: HeaderProps) {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const iv = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  const fmt = (d: Date) =>
    d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Jakarta' });

  const isV75      = activeSymbol === 'V75';
  const isOpen     = marketStatus === 'open';
  const wsOk       = wsStatus === 'connected';

  const priceDecimals = isV75 ? 3 : 2;

  return (
    <header className="header">
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
            Autonomous · XAUUSD
          </div>
        </div>
      </div>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>

        {/* Thinking */}
        {isThinking && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', borderRadius: 20,
            background: 'var(--gold-glow)', border: '1px solid rgba(201,168,76,.25)',
            fontSize: 10, color: 'var(--gold)', fontWeight: 600,
          }}>
            <span className="pulse-gold" style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--gold)', display: 'inline-block', flexShrink: 0 }} />
            Menganalisis
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
        }}>
          <span style={{
            width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
            background: isOpen ? 'var(--green)' : marketStatus === 'closed' ? 'var(--red)' : 'var(--text-3)',
          }} />
          {currentPrice ? (
            <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', letterSpacing: '.01em' }}>
              {Number(currentPrice).toFixed(priceDecimals)}
            </span>
          ) : (
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-3)' }}>
              {xauusdStatus === 'closed' && !isV75 ? 'Tutup' : 'Connecting'}
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
        }} className={wsOk ? 'glow-dot' : ''} title={`WS: ${wsStatus}`} />
      </div>
    </header>
  );
}
