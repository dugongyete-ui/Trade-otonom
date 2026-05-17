export type TradeAction = 'BUY' | 'SELL' | 'HOLD';
export type TradeStatus = 'OPEN' | 'TP_HIT' | 'SL_HIT' | 'CLOSED';
export type MarketStatus = 'open' | 'closed' | 'unknown';
export type ActiveSymbol = 'XAUUSD' | 'V75';

export interface Trade {
  id: number;
  symbol: string;
  action: TradeAction;
  entry: string | number;
  sl: string | number;
  tp: string | number;
  lot: string | number;
  open_time: string;
  close_time?: string;
  close_price?: string | number;
  pnl?: string | number;
  open_pnl?: string | number;
  status: TradeStatus;
  reflection?: string;
  strategy?: string;
  reasoning_text?: string;
  confidence?: string | number;
}

export interface AIDecision {
  id?: number;
  tradeId?: number;
  symbol: string;
  action: TradeAction;
  entry: number;
  sl: number;
  tp: number;
  lot?: number;
  confidence: number;
  reasoning: string;
  reflection?: string | null;
  strategy: string;
  timestamp?: string;
  trade_status?: TradeStatus;
  trade_pnl?: number;
  marketStatus?: MarketStatus;
  activeSymbol?: ActiveSymbol;
  dataSource?: 'deriv';
}

export interface PortfolioStats {
  balance: number;
  equity: number;
  openPnl: number;
  winRate: number;
  maxDrawdown: number;
  totalTrades: number;
  openTrades: number;
  equityHistory: Array<{ time: string; value: number; rawTime?: string }>;
}

export interface Signal {
  hasSignal: boolean;
  signal?: {
    id: number;
    symbol: string;
    action: TradeAction;
    entry: number;
    sl: number;
    tp: number;
    lot: number;
    openTime: string;
    openPnl: number;
    strategy?: string;
    confidence?: number;
    reasoning?: string;
  };
  lastDecision?: {
    action: TradeAction;
    symbol: string;
    entry: number;
    sl: number;
    tp: number;
    confidence?: number;
    strategy?: string;
  } | null;
}

export interface DerivMarketStatus {
  status: MarketStatus;
  isConnected: boolean;
  currentPrice: number | null;
  activeSymbol: ActiveSymbol;
  xauusdStatus: MarketStatus;
}
