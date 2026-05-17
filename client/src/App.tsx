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

export default function App() {
  const { status: wsStatus, lastMessage } = useWebSocket(getWsUrl());

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

    if (type === 'trade_update') {
      setIsThinking(false);
      refetchTrades();
      refetchSignal();
    }

    if (type === 'market_status') {
      const ms = data as DerivMarketStatus;
      setDerivStatus(ms);
    }
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

  return (
    <div className="grid-layout" style={{ minHeight: '100vh' }}>
      <Header
        wsStatus={wsStatus}
        isThinking={isThinking}
        marketStatus={derivStatus.status as MarketStatus}
        derivConnected={derivStatus.isConnected}
        currentPrice={derivStatus.currentPrice}
      />

      <aside className="flex flex-col gap-3 overflow-y-auto" style={{ gridColumn: '1', gridRow: '2' }}>
        <PortfolioPanel stats={portfolio} />
      </aside>

      <main className="flex flex-col min-h-0 overflow-hidden" style={{ gridColumn: '2', gridRow: '2' }}>
        <AIThinkingFeed
          decisions={decisions}
          isThinking={isThinking}
          marketStatus={derivStatus.status as MarketStatus}
        />
      </main>

      <aside className="flex flex-col gap-3 overflow-y-auto" style={{ gridColumn: '3', gridRow: '2' }}>
        <CopyTradePanel signal={signal} />
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
          <TradeHistoryTable
            trades={trades}
            page={tradePage}
            totalPages={totalPages}
            onPageChange={setTradePage}
          />
        </div>
      </aside>
    </div>
  );
}
