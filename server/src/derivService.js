import WebSocket from 'ws';

const DERIV_WS_URL = 'wss://ws.binaryws.com/websockets/v3?app_id=1';
const SYMBOL = 'frxXAUUSD';
const REQUEST_TIMEOUT = 12000;

let ws = null;
let currentPrice = null;
let m5Candles = [];
let m15Candles = [];
let marketStatus = 'unknown';
let isConnected = false;
let reconnectTimer = null;
let pendingResolvers = new Map();
let reqId = 1;

function sendRequest(payload) {
  return new Promise((resolve, reject) => {
    if (!isConnected || !ws) {
      reject(new Error('Deriv WS not connected'));
      return;
    }
    const id = reqId++;
    payload.req_id = id;
    pendingResolvers.set(id, { resolve, reject });
    const timer = setTimeout(() => {
      if (pendingResolvers.has(id)) {
        pendingResolvers.delete(id);
        reject(new Error('Timeout'));
      }
    }, REQUEST_TIMEOUT);
    pendingResolvers.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify(payload));
  });
}

async function pingServer() {
  try {
    const res = await sendRequest({ ping: 1 });
    return res.ping === 'pong';
  } catch {
    return false;
  }
}

async function checkMarketStatus() {
  try {
    const res = await sendRequest({
      trading_times: new Date().toISOString().split('T')[0]
    });
    if (res.error) return 'unknown';
    const markets = res.trading_times?.markets || [];
    for (const market of markets) {
      for (const submarket of (market.submarkets || [])) {
        for (const sym of (submarket.symbols || [])) {
          if (sym.symbol === SYMBOL) {
            const times = sym.times;
            if (!times || !times.open || times.open[0] === '--' || times.open[0] === 'Closed') {
              return 'closed';
            }
            return 'open';
          }
        }
      }
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

async function fetchCandles(granularity, count = 10) {
  try {
    const res = await sendRequest({
      ticks_history: SYMBOL,
      adjust_start_time: 1,
      count,
      end: 'latest',
      style: 'candles',
      granularity
    });
    if (res.error) {
      const code = res.error.code;
      if (code === 'MarketIsClosed' || code === 'NoOpenPeriod') {
        marketStatus = 'closed';
        console.log(`[Deriv] Market is closed (${code})`);
        return null;
      }
      console.warn(`[Deriv] ticks_history error: ${res.error.message}`);
      return null;
    }
    marketStatus = 'open';
    return res.candles || [];
  } catch (err) {
    if (err.message !== 'Timeout') {
      console.error(`[Deriv] fetchCandles(${granularity}) error:`, err.message);
    }
    return null;
  }
}

async function subscribeToTicks() {
  try {
    const res = await sendRequest({ ticks: SYMBOL, subscribe: 1 });
    if (res.error) {
      const code = res.error.code;
      if (code === 'MarketIsClosed' || code === 'NoOpenPeriod') {
        marketStatus = 'closed';
      }
      return;
    }
    if (res.tick) {
      currentPrice = res.tick.quote;
      marketStatus = 'open';
      console.log(`[Deriv] Live tick: ${currentPrice}`);
    }
  } catch {
  }
}

async function loadDerivData() {
  const alive = await pingServer();
  if (!alive) {
    console.warn('[Deriv] Ping failed');
    return;
  }
  console.log('[Deriv] Connection verified via ping');

  const status = await checkMarketStatus();
  console.log(`[Deriv] Trading times check: ${status}`);

  if (status === 'closed') {
    marketStatus = 'closed';
    console.log('[Deriv] Market confirmed closed (weekend/holiday). Using simulated data.');
    return;
  }

  console.log('[Deriv] Loading M5 candles...');
  const m5 = await fetchCandles(300, 10);
  if (m5) { m5Candles = m5; }

  console.log('[Deriv] Loading M15 candles...');
  const m15 = await fetchCandles(900, 10);
  if (m15) { m15Candles = m15; }

  if (m5Candles.length > 0) {
    currentPrice = m5Candles[m5Candles.length - 1].close;
  }

  console.log(`[Deriv] Market: ${marketStatus} | Price: ${currentPrice} | M5: ${m5Candles.length} candles`);

  if (marketStatus === 'open') {
    await subscribeToTicks();
  }
}

export function connectDeriv() {
  if (ws) {
    try { ws.terminate(); } catch (_) {}
  }

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

      if (msg.msg_type === 'tick' && msg.tick) {
        currentPrice = msg.tick.quote;
        marketStatus = 'open';
      }

      if (msg.msg_type === 'ohlc' && msg.ohlc) {
        const candle = {
          epoch: msg.ohlc.epoch,
          open: parseFloat(msg.ohlc.open),
          high: parseFloat(msg.ohlc.high),
          low: parseFloat(msg.ohlc.low),
          close: parseFloat(msg.ohlc.close)
        };
        if (msg.ohlc.granularity === 300) {
          m5Candles = [...m5Candles.slice(-9), candle];
        } else if (msg.ohlc.granularity === 900) {
          m15Candles = [...m15Candles.slice(-9), candle];
        }
      }
    } catch (err) {
      console.error('[Deriv] Parse error:', err.message);
    }
  });

  ws.on('close', () => {
    isConnected = false;
    for (const [, entry] of pendingResolvers) {
      clearTimeout(entry.timer);
      entry.reject(new Error('WS closed'));
    }
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

export function getDerivMarketData() {
  return {
    currentPrice,
    m5Candles: m5Candles.map(c => ({
      time: c.epoch ? new Date(c.epoch * 1000).toISOString() : new Date().toISOString(),
      open: parseFloat(c.open) || 0,
      high: parseFloat(c.high) || 0,
      low: parseFloat(c.low) || 0,
      close: parseFloat(c.close) || 0,
      volume: 0
    })),
    m15Candles: m15Candles.map(c => ({
      time: c.epoch ? new Date(c.epoch * 1000).toISOString() : new Date().toISOString(),
      open: parseFloat(c.open) || 0,
      high: parseFloat(c.high) || 0,
      low: parseFloat(c.low) || 0,
      close: parseFloat(c.close) || 0,
      volume: 0
    })),
    marketStatus,
    isConnected
  };
}

export function getMarketStatus() {
  return marketStatus;
}

export function getCurrentDerivPrice() {
  return currentPrice;
}
