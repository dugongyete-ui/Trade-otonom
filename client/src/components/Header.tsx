import { useState, useEffect } from 'react';

interface HeaderProps {
  wsStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  isThinking: boolean;
  marketStatus?: 'open' | 'closed' | 'unknown';
  derivConnected?: boolean;
  currentPrice?: number | null;
}

export function Header({ wsStatus, isThinking, marketStatus = 'unknown', derivConnected = false, currentPrice }: HeaderProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const iv = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  const formatTime = (d: Date) =>
    d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Jakarta' });

  const marketOpen = marketStatus === 'open';
  const marketClosed = marketStatus === 'closed';

  return (
    <header style={{
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border-bright)',
      padding: '0 16px',
      height: '56px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexShrink: 0,
      position: 'sticky',
      top: 0,
      zIndex: 50,
    }}>
      {/* Left: Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
          background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-dim) 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: '14px', color: '#000', letterSpacing: '-0.5px'
        }}>
          DZ
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--gold)', letterSpacing: '0.02em', lineHeight: 1.2 }}>
            DzeckAI Trader
          </div>
          <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Paper Trading
          </div>
        </div>
      </div>

      {/* Right: Status pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {isThinking && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '3px 8px', borderRadius: '20px',
            background: 'var(--gold-glow)', border: '1px solid rgba(201,168,76,0.3)',
            fontSize: '10px', color: 'var(--gold)', fontWeight: 600,
          }}>
            <span className="animate-pulse-gold" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gold)', display: 'inline-block' }} />
            Analisis...
          </div>
        )}

        {/* Market & Price */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          padding: '3px 8px', borderRadius: '20px',
          background: marketOpen ? 'rgba(0,214,143,0.08)' : 'rgba(255,71,87,0.08)',
          border: `1px solid ${marketOpen ? 'rgba(0,214,143,0.2)' : 'rgba(255,71,87,0.2)'}`,
          fontSize: '10px',
        }}>
          <span style={{
            width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
            background: marketOpen ? 'var(--green)' : marketClosed ? 'var(--red)' : 'var(--text-muted)',
          }} />
          {currentPrice ? (
            <span className="font-mono" style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '11px' }}>
              {Number(currentPrice).toFixed(2)}
            </span>
          ) : (
            <span style={{ color: marketClosed ? 'var(--red)' : 'var(--text-muted)', fontWeight: 500 }}>
              {marketClosed ? 'Tutup' : 'Connecting'}
            </span>
          )}
        </div>

        {/* Clock */}
        <div className="font-mono" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.02em' }}>
          {formatTime(time)}
        </div>

        {/* WS dot */}
        <div style={{
          width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
          background: wsStatus === 'connected' ? 'var(--green)' : wsStatus === 'connecting' ? 'var(--gold)' : 'var(--red)',
        }} className={wsStatus === 'connected' ? 'glow-green' : ''} title={`WebSocket: ${wsStatus}`} />
      </div>
    </header>
  );
}
