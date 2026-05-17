import { useState, useEffect, useCallback } from 'react';
import { useSSE } from './hooks/useSSE';
import { useApi } from './hooks/useApi';
import { useTradeNotifications } from './hooks/useTradeNotifications';
import { Header } from './components/Header';
import { PortfolioPanel } from './components/PortfolioPanel';
import { AIThinkingFeed } from './components/AIThinkingFeed';
import { CopyTradePanel } from './components/CopyTradePanel';
import { TradeHistoryTable } from './components/TradeHistoryTable';
import { PriceChart } from './components/PriceChart';
import { StatisticsPanel } from './components/StatisticsPanel';
import { ToastContainer, type ToastItem } from './components/ToastNotification';
import { L } from './lib/labels';
import type { AIDecision, PortfolioStats, Signal, Trade, MarketStatus, DerivMarketStatus } from './types';

const DEFAULT_PORTFOLIO: PortfolioStats = {
  balance: 1000000, equity: 1000000, openPnl: 0, winRate: 0,
  maxDrawdown: 0, totalTrades: 0, openTrades: 0,
  equityHistory: [{ time: 'Start', value: 1000000 }],
};
const DEFAULT_SIGNAL: Signal = { hasSignal: false, lastDecision: null };
const PAGE_SIZE = 15;

type Tab = 'portfolio' | 'feed' | 'signal' | 'history';

function NavIcon({ tab, active }: { tab: Tab; active: boolean }) {
  const c = active ? 'var(--gold)' : 'currentColor';
  const s = 20;
  const p = { width: s, height: s, viewBox: '0 0 24 24', fill: 'none', stroke: c, strokeWidth: '1.7', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (tab === 'portfolio') return (
    <svg {...p}>
      <rect x="2" y="7" width="20" height="14" rx="2"/>
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
      <line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/>
    </svg>
  );
  if (tab === 'feed') return (
    <svg {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
  );
  if (tab === 'signal') return (
    <svg {...p}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
  );
  return (
    <svg {...p}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  );
}

const TABS: { tab: Tab; label: string }[] = [
  { tab: 'portfolio', label: L.portfolio },
  { tab: 'feed',      label: L.aiFeed   },
  { tab: 'signal',    label: L.signal   },
  { tab: 'history',   label: L.history  },
];

export default function App() {
  const { status: wsStatus, lastMessage } = useSSE('/api/stream');
  const [activeTab, setActiveTab]   = useState<Tab>('feed');
  const [tradePage, setTradePage]   = useState(1);
  const [tradeTotal, setTradeTotal] = useState(0);
  const [aiPaused, setAiPaused]     = useState(false);
  const [toasts, setToasts]         = useState<ToastItem[]>([]);
  const [derivStatus, setDerivStatus] = useState<DerivMarketStatus>({
    status: 'unknown', isConnected: false, currentPrice: null,
    activeSymbol: 'XAUUSD', xauusdStatus: 'unknown',
  });

  const { data: initPortfolio, refetch: refetchPortfolio } = useApi<PortfolioStats>('/api/portfolio', DEFAULT_PORTFOLIO);
  const { data: initTrades,    refetch: refetchTrades    } = useApi<{ trades: Trade[]; total: number }>(
    `/api/trades?page=${tradePage}&limit=${PAGE_SIZE}`, { trades: [], total: 0 }
  );
  const { data: initSignal,    refetch: refetchSignal    } = useApi<Signal>('/api/current-signal', DEFAULT_SIGNAL);
  const { data: initAiLog }                                = useApi<AIDecision[]>('/api/ai-log', []);

  const [portfolio,  setPortfolio ] = useState<PortfolioStats>(DEFAULT_PORTFOLIO);
  const [trades,     setTrades    ] = useState<Trade[]>([]);
  const [signal,     setSignal    ] = useState<Signal>(DEFAULT_SIGNAL);
  const [decisions,  setDecisions ] = useState<AIDecision[]>([]);
  const [isThinking, setIsThinking] = useState(false);

  useEffect(() => { if (initPortfolio?.balance)   setPortfolio(initPortfolio); }, [initPortfolio]);
  useEffect(() => { if (initTrades?.trades)        { setTrades(initTrades.trades); setTradeTotal(initTrades.total ?? 0); } }, [initTrades]);
  useEffect(() => { if (initSignal)                setSignal(initSignal);  }, [initSignal]);
  useEffect(() => { if (initAiLog?.length > 0)     setDecisions(initAiLog); }, [initAiLog]);

  // Sync AI pause state on init
  useEffect(() => {
    fetch('/api/ai/status')
      .then(r => r.json())
      .then(d => setAiPaused(Boolean(d.aiPaused)))
      .catch(() => {});
  }, []);

  const refetchAll = useCallback(() => {
    refetchPortfolio(); refetchTrades(); refetchSignal();
  }, [refetchPortfolio, refetchTrades, refetchSignal]);

  const addToast = useCallback((toast: ToastItem) => {
    setToasts(prev => [...prev, toast]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useTradeNotifications(lastMessage, addToast);

  useEffect(() => {
    if (!lastMessage) return;
    const { type, data } = lastMessage;
    if (type === 'ai_thinking')     setIsThinking(true);
    if (type === 'ai_decision') {
      setIsThinking(false);
      setDecisions(prev => [data as AIDecision, ...prev].slice(0, 50));
      refetchSignal();
    }
    if (type === 'portfolio_update') setPortfolio(data as PortfolioStats);
    if (type === 'trade_update')    { setIsThinking(false); refetchTrades(); refetchSignal(); }
    if (type === 'market_status') {
      const d = data as { status: string; isConnected: boolean; currentPrice: number | null; activeSymbol?: string; xauusdStatus?: string; aiPaused?: boolean };
      setDerivStatus({
        status: d.status as DerivMarketStatus['status'],
        isConnected: d.isConnected,
        currentPrice: d.currentPrice,
        activeSymbol: (d.activeSymbol as DerivMarketStatus['activeSymbol']) || 'XAUUSD',
        xauusdStatus: (d.xauusdStatus as DerivMarketStatus['xauusdStatus']) || 'unknown',
      });
      if (d.aiPaused !== undefined) setAiPaused(d.aiPaused);
    }
  }, [lastMessage, refetchSignal, refetchTrades]);

  useEffect(() => {
    const iv = setInterval(refetchAll, 15000);
    return () => clearInterval(iv);
  }, [refetchAll]);

  useEffect(() => {
    function fetchStatus() {
      fetch('/api/market-status')
        .then(r => r.json())
        .then(d => {
          setDerivStatus({
            status:        d.status        as DerivMarketStatus['status'],
            isConnected:   d.isConnected,
            currentPrice:  d.currentPrice,
            activeSymbol:  (d.activeSymbol  as DerivMarketStatus['activeSymbol'])  || 'XAUUSD',
            xauusdStatus:  (d.xauusdStatus  as DerivMarketStatus['xauusdStatus'])  || 'unknown',
          });
          if (d.aiPaused !== undefined) setAiPaused(d.aiPaused);
        })
        .catch(() => {});
    }
    fetchStatus();
    const iv = setInterval(fetchStatus, 3000);
    return () => clearInterval(iv);
  }, []);

  function handlePauseToggle() {
    const endpoint = aiPaused ? '/api/ai/resume' : '/api/ai/pause';
    const optimistic = !aiPaused;
    setAiPaused(optimistic);
    fetch(endpoint, { method: 'POST' })
      .then(r => r.json())
      .then(d => { if (d.aiPaused !== undefined) setAiPaused(d.aiPaused); })
      .catch(() => setAiPaused(!optimistic));
  }

  const totalPages   = Math.max(1, Math.ceil(tradeTotal / PAGE_SIZE));
  const mktStatus    = derivStatus.status as MarketStatus;
  const activeSymbol = derivStatus.activeSymbol;
  const xauusdStatus = derivStatus.xauusdStatus;

  return (
    <div className="shell">
      <Header
        wsStatus={wsStatus}
        isThinking={isThinking}
        marketStatus={mktStatus}
        derivConnected={derivStatus.isConnected}
        currentPrice={derivStatus.currentPrice}
        activeSymbol={activeSymbol}
        xauusdStatus={xauusdStatus}
        aiPaused={aiPaused}
        onPauseToggle={handlePauseToggle}
      />

      {/* ── Mobile: tab panels ── */}
      <div className="content">
        {TABS.map(({ tab }) => (
          <div key={tab} className={`panel${activeTab === tab ? ' on' : ''}`}>
            {tab === 'portfolio' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ height: 220, minHeight: 180 }}>
                  <PriceChart currentPrice={derivStatus.currentPrice} activeSymbol={activeSymbol} signal={signal} />
                </div>
                <PortfolioPanel stats={portfolio} />
                <StatisticsPanel />
              </div>
            )}
            {tab === 'feed'      && <AIThinkingFeed decisions={decisions} isThinking={isThinking} marketStatus={mktStatus} activeSymbol={activeSymbol} xauusdStatus={xauusdStatus} />}
            {tab === 'signal'    && <CopyTradePanel signal={signal} />}
            {tab === 'history'   && <TradeHistoryTable trades={trades} page={tradePage} totalPages={totalPages} onPageChange={setTradePage} />}
          </div>
        ))}
      </div>

      {/* ── Mobile: bottom nav ── */}
      <nav className="bnav">
        {TABS.map(({ tab, label }) => (
          <button
            key={tab}
            data-testid={`btn-nav-${tab}`}
            className={`bnav-btn${activeTab === tab ? ' on' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            <div className="bnav-icon"><NavIcon tab={tab} active={activeTab === tab} /></div>
            <span className="bnav-lbl">{label}</span>
          </button>
        ))}
      </nav>

      {/* ── Desktop: 3-col grid ── */}
      <div className="dgrid">
        <div className="dcol">
          <div style={{ height: 240, flexShrink: 0 }}>
            <PriceChart currentPrice={derivStatus.currentPrice} activeSymbol={activeSymbol} signal={signal} />
          </div>
          <PortfolioPanel stats={portfolio} />
          <StatisticsPanel />
        </div>
        <div className="dmain">
          <AIThinkingFeed decisions={decisions} isThinking={isThinking} marketStatus={mktStatus} activeSymbol={activeSymbol} xauusdStatus={xauusdStatus} />
        </div>
        <div className="dcol">
          <CopyTradePanel signal={signal} />
          <TradeHistoryTable trades={trades} page={tradePage} totalPages={totalPages} onPageChange={setTradePage} />
        </div>
      </div>

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
