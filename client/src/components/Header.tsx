import { useState, useEffect } from 'react';
import { IconActivity, IconWifi, IconWifiOff, IconLoader, IconSignal, IconDatabase } from './Icons';

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
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (date: Date) =>
    date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Jakarta' });

  const formatDate = (date: Date) =>
    date.toLocaleDateString('id-ID', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Jakarta' });

  const marketColor = marketStatus === 'open' ? 'var(--green)' : marketStatus === 'closed' ? 'var(--red)' : 'var(--text-muted)';
  const marketLabel = marketStatus === 'open' ? 'Market Buka' : marketStatus === 'closed' ? 'Market Tutup' : 'Menghubungkan...';

  return (
    <header
      className="col-span-full flex items-center justify-between px-4 py-3 rounded-lg"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      data-testid="header"
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm"
            style={{ background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-dim) 100%)', color: '#000' }}
          >
            D
          </div>
          <div>
            <div className="font-bold text-base tracking-wide" style={{ color: 'var(--gold)' }}>
              DzeckAI Trader
            </div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Autonomous AI Trading System
            </div>
          </div>
        </div>

        <div
          className="ml-4 px-3 py-1 rounded text-xs font-medium"
          style={{ background: 'rgba(212, 175, 55, 0.1)', border: '1px solid var(--gold-dim)', color: 'var(--gold)' }}
        >
          LIVE PAPER TRADING
        </div>
      </div>

      <div className="flex items-center gap-3">
        {isThinking && (
          <div
            className="flex items-center gap-2 px-3 py-1 rounded text-xs animate-fade-in"
            style={{ background: 'rgba(212, 175, 55, 0.1)', border: '1px solid var(--gold-dim)', color: 'var(--gold)' }}
            data-testid="thinking-indicator"
          >
            <IconLoader size={12} className="animate-spin" />
            <span>AI Sedang Berpikir...</span>
          </div>
        )}

        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded text-xs"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          data-testid="deriv-status"
          title={`Deriv WS: ${derivConnected ? 'Connected' : 'Disconnected'}`}
        >
          <IconDatabase size={11} style={{ color: derivConnected ? 'var(--green)' : 'var(--text-muted)' }} />
          <span style={{ color: marketColor }}>{marketLabel}</span>
          {currentPrice && (
            <span className="font-mono font-semibold" style={{ color: 'var(--gold)', marginLeft: 4 }}>
              {Number(currentPrice).toFixed(2)}
            </span>
          )}
        </div>

        <div className="text-right">
          <div
            className="font-mono text-lg font-semibold"
            style={{ color: 'var(--text-primary)' }}
            data-testid="live-clock"
          >
            {formatTime(time)}
          </div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {formatDate(time)} WIB
          </div>
        </div>

        <div
          className="flex items-center gap-2 px-2 py-1 rounded text-xs"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          data-testid="ws-status"
        >
          {wsStatus === 'connected' ? (
            <>
              <IconWifi size={12} style={{ color: 'var(--green)' }} />
              <span style={{ color: 'var(--green)' }}>Live</span>
            </>
          ) : wsStatus === 'connecting' ? (
            <>
              <IconActivity size={12} className="animate-pulse-gold" style={{ color: 'var(--gold)' }} />
              <span style={{ color: 'var(--gold)' }}>Connecting</span>
            </>
          ) : (
            <>
              <IconWifiOff size={12} style={{ color: 'var(--red)' }} />
              <span style={{ color: 'var(--red)' }}>Offline</span>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
