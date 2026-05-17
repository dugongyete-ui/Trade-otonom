import WebSocket from 'ws';

const DERIV_WS_URL = 'wss://ws.binaryws.com/websockets/v3?app_id=1';
const REQUEST_TIMEOUT = 12000;

const XAUUSD_SYM = 'frxXAUUSD';
const V75_SYM    = 'R_75';

export const SYMBOL_CONFIG = {
  XAUUSD: {
    derivSymbol: XAUUSD_SYM,
    displayName: 'XAUUSD',
    fullName: 'Gold vs USD',
    pipMultiplier: 10000,   // IDR scale: 1pt * 0.01lot = Rp 100
    type: 'forex',
  },
  V75: {
    derivSymbol: V75_SYM,
    displayName: 'Volatility 75',
    fullName: 'Volatility 75 Index',
    pipMultiplier: 1000,    // IDR scale: 1pt * 0.01lot = Rp 10
    type: 'synthetic',
  },
};

// ── Shared WS state ──────────────────────────────────────────
let ws               = null;
let isConnected      = false;
let reconnectTimer   = null;
let xauusdCheckTimer = null;
let pendingResolvers = new Map();
let reqId            = 1;

// ── Active market ─────────────────────────────────────────────
let activeSymbol = 'XAUUSD'; // 'XAUUSD' | 'V75'

// ── XAUUSD state ─────────────────────────────────────────────
let xauusdPrice  = null;
let xauusdM5     = [];
let xauusdM15    = [];
let xauusdStatus = 'unknown';

// ── V75 state ─────────────────────────────────────────────────
let v75Price = null;
let v75M5    = [];
let v75M15   = [];

// ─────────────────────────────────────────────────────────────

function sendRequest(payload) {
  return new Promise((resolve, reject) => {
    if (!isConnected || !ws) { reject(new Error('Deriv WS not connected')); return; }
    const id = reqId++;
    const timer = setTimeout(() => {
      if (pendingResolvers.has(id)) { pendingResolvers.delete(id); reject(new Error('Timeout')); }
    }, REQUEST_TIMEOUT);
    pendingResolvers.set(id, { resolve, reject, timer });
    payload.req_id = id;
    ws.send(JSON.stringify(payload));
  });
}

async function ping() {
  try { const r = await sendRequest({ ping: 1 }); return r.ping === 'pong'; }
  catch { return false; }
}

async function checkXAUUSDStatus() {
  try {
    const res = await sendRequest({ trading_times: new Date().toISOString().split('T')[0] });
    if (res.error) return 'unknown';
    for (const market of (res.trading_times?.markets || [])) {
      for (const sub of (market.submarkets || [])) {
        for (const sym of (sub.symbols || [])) {
          if (sym.symbol === XAUUSD_SYM) {
            const t = sym.times;
            if (!t || !t.open || t.open[0] === '--' || t.open[0] === 'Closed') return 'closed';
            return 'open';
          }
        }
      }
    }
    return 'unknown';
  } catch { return 'unknown'; }
}

async function fetchCandles(derivSymbol, granularity, count = 10) {
  try {
    const res = await sendRequest({ ticks_history: derivSymbol, adjust_start_time: 1, count, end: 'latest', style: 'candles', granularity });
    if (res.error) {
      const code = res.error.code;
      if (code === 'MarketIsClosed' || code === 'NoOpenPeriod') return null;
      console.warn(`[Deriv] ticks_history(${derivSymbol}) error: ${res.error.message}`);
      return null;
    }
    return res.candles || [];
  } catch { return null; }
}

async function subscribeToTicks(derivSymbol) {
  try {
    const res = await sendRequest({ ticks: derivSymbol, subscribe: 1 });
    if (res.error) return;
    if (res.tick) {
      if (derivSymbol === XAUUSD_SYM) { xauusdPrice = res.tick.quote; xauusdStatus = 'open'; }
      else if (derivSymbol === V75_SYM) { v75Price = res.tick.quote; }
    }
  } catch {}
}

async function loadXAUUSDData() {
  console.log('[Deriv] Loading XAUUSD market data...');
  const m5  = await fetchCandles(XAUUSD_SYM, 300, 10);
  const m15 = await fetchCandles(XAUUSD_SYM, 900, 10);
  if (m5)  { xauusdM5  = m5; }
  if (m15) { xauusdM15 = m15; }
  if (xauusdM5.length > 0) xauusdPrice = xauusdM5[xauusdM5.length - 1].close;
  xauusdStatus = 'open';
  await subscribeToTicks(XAUUSD_SYM);
  console.log(`[Deriv] XAUUSD ready | Price: ${xauusdPrice} | M5: ${xauusdM5.length} candles`);
}

async function loadV75Data() {
  console.log('[Deriv] XAUUSD tutup — beralih ke Volatility 75 Index (R_75)...');
  const m5  = await fetchCandles(V75_SYM, 300, 10);
  const m15 = await fetchCandles(V75_SYM, 900, 10);
  if (m5)  { v75M5  = m5; }
  if (m15) { v75M15 = m15; }
  if (v75M5.length > 0) v75Price = v75M5[v75M5.length - 1].close;
  await subscribeToTicks(V75_SYM);
  console.log(`[Deriv] V75 ready | Price: ${v75Price} | M5: ${v75M5.length} candles`);
}

function startXAUUSDCheck() {
  if (xauusdCheckTimer) clearInterval(xauusdCheckTimer);
  // Check every 5 minutes if XAUUSD has opened
  xauusdCheckTimer = setInterval(async () => {
    if (!isConnected) return;
    const status = await checkXAUUSDStatus();
    console.log(`[Deriv] XAUUSD check (background): ${status}`);
    if (status === 'open') {
      console.log('[Deriv] XAUUSD kembali buka — beralih kembali dari V75...');
      clearInterval(xauusdCheckTimer);
      xauusdCheckTimer = null;
      activeSymbol = 'XAUUSD';
      xauusdStatus = 'open';
      // Clear V75 data so AI won't use stale V75 data for XAUUSD trades
      v75M5 = []; v75M15 = []; v75Price = null;
      await loadXAUUSDData();
    }
  }, 5 * 60 * 1000);
}

async function loadDerivData() {
  const alive = await ping();
  if (!alive) { console.warn('[Deriv] Ping failed'); return; }
  console.log('[Deriv] Connection verified via ping');

  const status = await checkXAUUSDStatus();
  console.log(`[Deriv] XAUUSD market status: ${status}`);

  if (status === 'open') {
    activeSymbol = 'XAUUSD';
    xauusdStatus = 'open';
    if (xauusdCheckTimer) { clearInterval(xauusdCheckTimer); xauusdCheckTimer = null; }
    await loadXAUUSDData();
  } else {
    // XAUUSD closed — use V75
    activeSymbol = 'V75';
    xauusdStatus = 'closed';
    await loadV75Data();
    startXAUUSDCheck();
  }
}

export function connectDeriv() {
  if (ws) { try { ws.terminate(); } catch (_) {} }

  console.log('[Deriv] Connecting to Deriv WebSocket...');
  ws = new WebSocket(DERIV_WS_URL);

  ws.on('open', () => {
    isConnected = true;
    console.log('[Deriv] Connected to Deriv WS');
    loadDerivData();
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      const id = msg.req_id;

      if (id !== undefined && pendingResolvers.has(id)) {
        const entry = pendingResolvers.get(id);
        clearTimeout(entry.timer);
        pendingResolvers.delete(id);
        entry.resolve(msg);
        return;
      }

      // Live tick updates
      if (msg.msg_type === 'tick' && msg.tick) {
        const sym = msg.tick.symbol;
        if (sym === XAUUSD_SYM) { xauusdPrice = msg.tick.quote; xauusdStatus = 'open'; }
        else if (sym === V75_SYM) { v75Price = msg.tick.quote; }
      }

      // Live candle updates
      if (msg.msg_type === 'ohlc' && msg.ohlc) {
        const sym = msg.ohlc.symbol;
        const candle = {
          epoch: msg.ohlc.epoch,
          open: parseFloat(msg.ohlc.open),
          high: parseFloat(msg.ohlc.high),
          low: parseFloat(msg.ohlc.low),
          close: parseFloat(msg.ohlc.close),
        };
        const gran = msg.ohlc.granularity;
        if (sym === XAUUSD_SYM) {
          if (gran === 300)  xauusdM5  = [...xauusdM5.slice(-9),  candle];
          if (gran === 900)  xauusdM15 = [...xauusdM15.slice(-9), candle];
        } else if (sym === V75_SYM) {
          if (gran === 300)  v75M5  = [...v75M5.slice(-9),  candle];
          if (gran === 900)  v75M15 = [...v75M15.slice(-9), candle];
        }
      }
    } catch (err) { console.error('[Deriv] Parse error:', err.message); }
  });

  ws.on('close', () => {
    isConnected = false;
    for (const [, entry] of pendingResolvers) { clearTimeout(entry.timer); entry.reject(new Error('WS closed')); }
    pendingResolvers.clear();
    console.log('[Deriv] Disconnected. Reconnecting in 15s...');
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connectDeriv, 15000);
  });

  ws.on('error', (err) => {
    console.error('[Deriv] WS error:', err.message);
    isConnected = false;
  });
}

function normalizeCandles(candles) {
  return candles.map(c => ({
    time: c.epoch ? new Date(c.epoch * 1000).toISOString() : new Date().toISOString(),
    open:  parseFloat(c.open)  || 0,
    high:  parseFloat(c.high)  || 0,
    low:   parseFloat(c.low)   || 0,
    close: parseFloat(c.close) || 0,
    volume: 0,
  }));
}

export function getActiveSymbol() {
  return activeSymbol; // 'XAUUSD' | 'V75'
}

export function getPipMultiplier(symbol) {
  return SYMBOL_CONFIG[symbol]?.pipMultiplier ?? 100;
}

export function getActiveMarketData() {
  if (activeSymbol === 'V75') {
    return {
      symbol: 'V75',
      derivSymbol: V75_SYM,
      currentPrice: v75Price,
      m5Candles: normalizeCandles(v75M5),
      m15Candles: normalizeCandles(v75M15),
      marketStatus: 'open', // V75 is always open
      xauusdStatus,
      isConnected,
    };
  }
  return {
    symbol: 'XAUUSD',
    derivSymbol: XAUUSD_SYM,
    currentPrice: xauusdPrice,
    m5Candles: normalizeCandles(xauusdM5),
    m15Candles: normalizeCandles(xauusdM15),
    marketStatus: xauusdStatus,
    xauusdStatus,
    isConnected,
  };
}

// Legacy compat
export function getDerivMarketData() {
  return getActiveMarketData();
}

export function getMarketStatus() {
  return activeSymbol === 'V75' ? 'open' : xauusdStatus;
}

export function getXAUUSDStatus() {
  return xauusdStatus;
}

export function getCurrentDerivPrice() {
  return activeSymbol === 'V75' ? v75Price : xauusdPrice;
}
