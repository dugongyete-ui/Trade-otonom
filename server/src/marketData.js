import { getDerivMarketData, getCurrentDerivPrice } from './derivService.js';

let simPrice = 3320.50;

function randomWalk(base, volatility) {
  return parseFloat((base + (Math.random() - 0.5) * volatility).toFixed(2));
}

function generateCandle(open, volatility = 8) {
  const move = (Math.random() - 0.48) * volatility;
  const close = parseFloat((open + move).toFixed(2));
  const high = parseFloat((Math.max(open, close) + Math.random() * volatility * 0.4).toFixed(2));
  const low = parseFloat((Math.min(open, close) - Math.random() * volatility * 0.4).toFixed(2));
  return { open: parseFloat(open.toFixed(2)), high, low, close, volume: Math.floor(Math.random() * 500 + 100) };
}

export function generateM5Candles(count = 10) {
  const candles = [];
  let price = simPrice - (Math.random() * 20);
  for (let i = 0; i < count; i++) {
    const c = generateCandle(price, 6);
    candles.push({ ...c, time: new Date(Date.now() - (count - i) * 5 * 60 * 1000).toISOString() });
    price = c.close;
  }
  simPrice = price;
  return candles;
}

export function generateM15Candles(count = 10) {
  const candles = [];
  let price = simPrice - (Math.random() * 30);
  for (let i = 0; i < count; i++) {
    const c = generateCandle(price, 12);
    candles.push({ ...c, time: new Date(Date.now() - (count - i) * 15 * 60 * 1000).toISOString() });
    price = c.close;
  }
  return candles;
}

export function getCurrentPrice() {
  const derivPrice = getCurrentDerivPrice();
  if (derivPrice) return parseFloat(derivPrice.toFixed(2));
  simPrice = randomWalk(simPrice, 3);
  return parseFloat(simPrice.toFixed(2));
}

export function simulatePriceMovement(entry, action, sl, tp, currentPx) {
  if (!currentPx) currentPx = entry;
  const step = (Math.random() - 0.45) * 4;
  const newPrice = parseFloat((currentPx + step).toFixed(2));

  let status = 'OPEN';
  let closePrice = null;

  if (action === 'BUY') {
    if (newPrice >= tp) { status = 'TP_HIT'; closePrice = tp; }
    else if (newPrice <= sl) { status = 'SL_HIT'; closePrice = sl; }
  } else if (action === 'SELL') {
    if (newPrice <= tp) { status = 'TP_HIT'; closePrice = tp; }
    else if (newPrice >= sl) { status = 'SL_HIT'; closePrice = sl; }
  }

  return { currentPrice: newPrice, status, closePrice };
}
