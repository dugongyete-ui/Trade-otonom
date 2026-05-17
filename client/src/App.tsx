import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { useApi } from './hooks/useApi';
import { Header } from './components/Header';
import { PortfolioPanel } from './components/PortfolioPanel';
import { AIThinkingFeed } from './components/AIThinkingFeed';
import { CopyTradePanel } from './components/CopyTradePanel';
import { TradeHistoryTable } from './components/TradeHistoryTable';
import type { AIDecision, PortfolioStats, Signal, Trade, MarketStatus, DerivMarketStatus } from './types';

const DEFAULT_PORTFOLIO: PortfolioStats = {
  balance: 10000, equity: 10000, openPnl: 0, winRate: 0,
  maxDrawdown: 0, totalTrades: 0, openTrades: 0,
  equityHistory: [{ time: 'Start', value: 10000 }]
};
const DEFAULT_SIGNAL: Signal = { hasSignal: false, lastDecision: null };
const PAGE_SIZE = 15;

function getWsUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

type Tab = 'portfolio' | 'feed' | 'signal' | 'history';

function NavIcon({ tab, active }: { tab: Tab; active: boolean }) {
  const color = active ? 'var(--gold)' : 'var(--text-muted)';
  const s = 20;
  if (tab === 'portfolio') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
      <line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/>
    </svg>
  );
  if (tab === 'feed') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  );
  if (tab === 'signal') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  );
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  );
}

const NAV_ITEMS: { tab: Tab; label: string }[] = [
  { tab: 'portfolio', label: 'Portfolio' },
  { tab: 'feed', label: 'AI Feed' },
  { tab: 'signal', label: 'Signal' },
  { tab: 'history', label: 'Riwayat' },
];

export default function App() {
  const { status: wsStatus, lastMessage } = useWebSocket(getWsUrl());
  const [activeTab, setActiveTab] = useState<Tab>('feed');
  const [tradePage, setTradePage] = useState(1);
  const [tradeTotal, setTradeTotal] = useState(0);
  const [derivStatus, setDerivStatus] = useState<DerivMarketStatus>({
    status: 'unknown', isConnected: false, currentPrice: null
  });

  const { data: initialPortfolio, refetch: refetchPortfolio } = useApi<PortfolioStats>('/api/portfolio', DEFAULT_PORTFOLIO);
  const { data: initialTrades, refetch: refetchTrades } = useApi<{ trades: Trade[]; total: number }>(
    `/api/trades?page=${tradePage}&limit=${PAGE_SIZE}`, { trades: [], total: 0 }
  );
  const { data: initialSignal, refetch: refetchSignal } = useApi<Signal>('/api/current-signal', DEFAULT_SIGNAL);
  const { data: initialAiLog } = useApi<AIDecision[]>('/api/ai-log', []);

  const [portfolio, setPortfolio] = useState<PortfolioStats>(DEFAULT_PORTFOLIO);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [signal, setSignal] = useState<Signal>(DEFAULT_SIGNAL);
  const [decisions, setDecisions] = useState<AIDecision[]>([]);
  const [isThinking, setIsThinking] = useState(false);

  useEffect(() => { if (initialPortfolio?.balance) setPortfolio(initialPortfolio); }, [initialPortfolio]);
  useEffect(() => { if (initialTrades?.trades) { setTrades(initialTrades.trades); setTradeTotal(initialTrades.total ?? 0); } }, [initialTrades]);
  useEffect(() => { if (initialSignal) setSignal(initialSignal); }, [initialSignal]);
  useEffect(() => { if (initialAiLog?.length > 0) setDecisions(initialAiLog); }, [initialAiLog]);

  const refetchAll = useCallback(() => {
    refetchPortfolio(); refetchTrades(); refetchSignal();
  }, [refetchPortfolio, refetchTrades, refetchSignal]);

  useEffect(() => {
    if (!lastMessage) return;
    const { type, data } = lastMessage;
    if (type === 'ai_thinking') setIsThinking(true);
    if (type === 'ai_decision') {
      setIsThinking(false);
      setDecisions(prev => [data as AIDecision, ...prev].slice(0, 50));
      refetchSignal();
    }
    if (type === 'portfolio_update') setPortfolio(data as PortfolioStats);
    if (type === 'trade_update') { setIsThinking(false); refetchTrades(); refetchSignal(); }
    if (type === 'market_status') setDerivStatus(data as DerivMarketStatus);
  }, [lastMessage, refetchSignal, refetchTrades]);

  useEffect(() => {
    const interval = setInterval(refetchAll, 15000);
    return () => clearInterval(interval);
  }, [refetchAll]);

  useEffect(() => {
    fetch('/api/market-status')
      .then(r => r.json())
      .then(d => setDerivStatus({ status: d.status, isConnected: d.isConnected, currentPrice: d.currentPrice }))
      .catch(() => {});
  }, []);

  const totalPages = Math.max(1, Math.ceil(tradeTotal / PAGE_SIZE));
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 900;

  return (
    <div className="app-shell">
      <Header
        wsStatus={wsStatus}
        isThinking={isThinking}
        marketStatus={derivStatus.status as MarketStatus}
        derivConnected={derivStatus.isConnected}
        currentPrice={derivStatus.currentPrice}
      />

      {/* Mobile layout */}
      <div className="app-content" style={{ display: 'block' }}>
        <div className={`tab-panel ${activeTab === 'portfolio' ? 'active' : ''}`} id="tab-portfolio">
          <PortfolioPanel stats={portfolio} />
        </div>
        <div className={`tab-panel ${activeTab === 'feed' ? 'active' : ''}`} id="tab-feed">
          <AIThinkingFeed decisions={decisions} isThinking={isThinking} marketStatus={derivStatus.status as MarketStatus} />
        </div>
        <div className={`tab-panel ${activeTab === 'signal' ? 'active' : ''}`} id="tab-signal">
          <CopyTradePanel signal={signal} />
        </div>
        <div className={`tab-panel ${activeTab === 'history' ? 'active' : ''}`} id="tab-history">
          <TradeHistoryTable trades={trades} page={tradePage} totalPages={totalPages} onPageChange={setTradePage} />
        </div>
      </div>

      {/* Bottom nav (mobile) */}
      <nav className="bottom-nav">
        {NAV_ITEMS.map(({ tab, label }) => (
          <button
            key={tab}
            className={`nav-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            <div className="nav-btn-icon">
              <NavIcon tab={tab} active={activeTab === tab} />
            </div>
            <span className="nav-btn-label">{label}</span>
          </button>
        ))}
      </nav>

      {/* Desktop layout */}
      <div className="desktop-grid">
        <div className="desktop-col">
          <PortfolioPanel stats={portfolio} />
        </div>
        <div className="desktop-main">
          <AIThinkingFeed decisions={decisions} isThinking={isThinking} marketStatus={derivStatus.status as MarketStatus} />
        </div>
        <div className="desktop-col">
          <CopyTradePanel signal={signal} />
          <TradeHistoryTable trades={trades} page={tradePage} totalPages={totalPages} onPageChange={setTradePage} />
        </div>
      </div>
    </div>
  );
}
