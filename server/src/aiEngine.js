import { CohereClient } from 'cohere-ai';
import { query } from './db.js';
import { getActiveMarketData, getActiveSymbol, SYMBOL_CONFIG, getPipMultiplier } from './derivService.js';
import { getMacroData, getUpcomingEvents, getRecentHeadlines, formatMacroSection, formatEventsSection } from './macroData.js';

const cohere = new CohereClient({ token: process.env.COHERE_API_KEY });

const SYSTEM_PROMPT = `Anda adalah DzeckAI — agen trading otonom yang memulai dari NOL MUTLAK.

IDENTITAS:
Anda tidak memiliki strategi bawaan. Anda harus menemukan, menguji, dan menyempurnakan strategi trading Anda sendiri melalui pengalaman nyata di pasar. Setiap keputusan adalah eksperimen. Setiap hasil adalah pelajaran.

MISI:
- Temukan sendiri pola dan strategi yang bekerja di pasar
- Catat apa yang berhasil dan apa yang gagal
- Bangun sistem trading yang semakin baik dari waktu ke waktu
- Tidak ada manusia yang boleh mendikte strategi Anda

GAYA KOMUNIKASI — BAHASA INDONESIA FORMAL & PROFESIONAL:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Selalu gunakan "Saya" — formal, objektif
- Gunakan terminologi trading profesional dalam Bahasa Indonesia
- Beri nama strategi dalam Bahasa Indonesia (contoh: "Breakout Struktur H1", "Retest EMA50", "Konfluensi Ichimoku + RSI")
- Refleksi pasca SL harus faktual berdasarkan data aktual, bukan spekulasi
- Sebutkan indikator spesifik yang Anda gunakan dalam reasoning`;

// ═══════════════════════════════════════════════════════════════
// KALKULASI INDIKATOR TEKNIKAL LENGKAP
// ═══════════════════════════════════════════════════════════════

// ── Moving Averages ───────────────────────────────────────────

function calcSMA(values, period) {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return parseFloat((slice.reduce((a, b) => a + b, 0) / period).toFixed(4));
}

function calcEMA(values, period) {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
  }
  return parseFloat(ema.toFixed(4));
}

function calcWMA(values, period) {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  let weightSum = 0;
  let wma = 0;
  for (let i = 0; i < period; i++) {
    const weight = i + 1;
    wma += slice[i] * weight;
    weightSum += weight;
  }
  return parseFloat((wma / weightSum).toFixed(4));
}

function calcDEMA(values, period) {
  if (values.length < period * 2) return null;
  const ema1 = calcEMAFull(values, period);
  if (!ema1) return null;
  const ema2 = calcEMAFull(ema1, period);
  if (!ema2) return null;
  const last1 = ema1[ema1.length - 1];
  const last2 = ema2[ema2.length - 1];
  return parseFloat((2 * last1 - last2).toFixed(4));
}

function calcEMAFull(values, period) {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  const result = [];
  let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(ema);
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
    result.push(ema);
  }
  return result;
}

function calcTEMA(values, period) {
  if (values.length < period * 3) return null;
  const ema1 = calcEMAFull(values, period);
  if (!ema1) return null;
  const ema2 = calcEMAFull(ema1, period);
  if (!ema2) return null;
  const ema3 = calcEMAFull(ema2, period);
  if (!ema3) return null;
  const e1 = ema1[ema1.length - 1];
  const e2 = ema2[ema2.length - 1];
  const e3 = ema3[ema3.length - 1];
  return parseFloat((3 * e1 - 3 * e2 + e3).toFixed(4));
}

function calcTRIX(values, period = 14) {
  if (values.length < period * 3) return null;
  const ema1 = calcEMAFull(values, period);
  if (!ema1 || ema1.length < 2) return null;
  const ema2 = calcEMAFull(ema1, period);
  if (!ema2 || ema2.length < 2) return null;
  const ema3 = calcEMAFull(ema2, period);
  if (!ema3 || ema3.length < 2) return null;
  const last = ema3[ema3.length - 1];
  const prev = ema3[ema3.length - 2];
  if (prev === 0) return 0;
  return parseFloat(((last - prev) / prev * 100).toFixed(4));
}

// ── Momentum Indicators ───────────────────────────────────────

function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? Math.abs(diff) : 0)) / period;
  }
  if (avgLoss === 0) return 100;
  return parseFloat((100 - (100 / (1 + avgGain / avgLoss))).toFixed(2));
}

function calcRSIFull(closes, period) {
  const result = [];
  if (closes.length < period + 1) return result;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  const rsi0 = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  result.push(rsi0);
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? Math.abs(diff) : 0)) / period;
    result.push(avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss)));
  }
  return result;
}

function calcStochasticRSI(closes, rsiPeriod = 14, stochPeriod = 14) {
  const rsiValues = calcRSIFull(closes, rsiPeriod);
  if (rsiValues.length < stochPeriod) return null;
  const slice = rsiValues.slice(-stochPeriod);
  const maxRSI = Math.max(...slice);
  const minRSI = Math.min(...slice);
  if (maxRSI === minRSI) return { k: 50, d: 50 };
  const k = ((rsiValues[rsiValues.length - 1] - minRSI) / (maxRSI - minRSI)) * 100;
  const kValues = [];
  for (let i = rsiValues.length - stochPeriod; i <= rsiValues.length - 1; i++) {
    const s = rsiValues.slice(i - stochPeriod + 1 < 0 ? 0 : i - stochPeriod + 1, i + 1);
    const mx = Math.max(...s); const mn = Math.min(...s);
    kValues.push(mx === mn ? 50 : ((rsiValues[i] - mn) / (mx - mn)) * 100);
  }
  const d = kValues.slice(-3).reduce((a, b) => a + b, 0) / 3;
  return { k: parseFloat(k.toFixed(2)), d: parseFloat(d.toFixed(2)) };
}

function calcMACD(closes) {
  if (closes.length < 26) return null;
  const k12 = 2 / (12 + 1);
  const k26 = 2 / (26 + 1);
  let e12 = closes.slice(0, 12).reduce((a, b) => a + b, 0) / 12;
  let e26 = closes.slice(0, 26).reduce((a, b) => a + b, 0) / 26;
  for (let i = 12; i < 26; i++) e12 = closes[i] * k12 + e12 * (1 - k12);
  const macdLine = [];
  for (let i = 26; i < closes.length; i++) {
    e12 = closes[i] * k12 + e12 * (1 - k12);
    e26 = closes[i] * k26 + e26 * (1 - k26);
    macdLine.push(e12 - e26);
  }
  if (macdLine.length < 9) return null;
  const k9 = 2 / (9 + 1);
  let signal = macdLine.slice(0, 9).reduce((a, b) => a + b, 0) / 9;
  for (let i = 9; i < macdLine.length; i++) signal = macdLine[i] * k9 + signal * (1 - k9);
  const macdVal = macdLine[macdLine.length - 1];
  return {
    macd: parseFloat(macdVal.toFixed(4)),
    signal: parseFloat(signal.toFixed(4)),
    histogram: parseFloat((macdVal - signal).toFixed(4)),
  };
}

function calcMomentum(closes, period = 10) {
  if (closes.length < period + 1) return null;
  const current = closes[closes.length - 1];
  const past = closes[closes.length - 1 - period];
  return parseFloat((current - past).toFixed(4));
}

function calcAwesomeOscillator(candles) {
  if (candles.length < 34) return null;
  const midpoints = candles.map(c => (parseFloat(c.high) + parseFloat(c.low)) / 2);
  const sma5  = midpoints.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const sma34 = midpoints.slice(-34).reduce((a, b) => a + b, 0) / 34;
  return parseFloat((sma5 - sma34).toFixed(4));
}

function calcStochastic(candles, kPeriod = 14, dPeriod = 3) {
  if (candles.length < kPeriod) return null;
  const kValues = [];
  for (let i = kPeriod - 1; i < candles.length; i++) {
    const slice = candles.slice(i - kPeriod + 1, i + 1);
    const hh = Math.max(...slice.map(c => parseFloat(c.high)));
    const ll = Math.min(...slice.map(c => parseFloat(c.low)));
    const close = parseFloat(candles[i].close);
    kValues.push(hh === ll ? 50 : ((close - ll) / (hh - ll)) * 100);
  }
  if (kValues.length < dPeriod) return null;
  const d = kValues.slice(-dPeriod).reduce((a, b) => a + b, 0) / dPeriod;
  return { k: parseFloat(kValues[kValues.length - 1].toFixed(2)), d: parseFloat(d.toFixed(2)) };
}

function calcCCI(candles, period = 20) {
  if (candles.length < period) return null;
  const typicals = candles.map(c => (parseFloat(c.high) + parseFloat(c.low) + parseFloat(c.close)) / 3);
  const slice = typicals.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const meanDev = slice.reduce((s, v) => s + Math.abs(v - mean), 0) / period;
  if (meanDev === 0) return 0;
  return parseFloat(((typicals[typicals.length - 1] - mean) / (0.015 * meanDev)).toFixed(2));
}

function calcWilliamsR(candles, period = 14) {
  if (candles.length < period) return null;
  const slice = candles.slice(-period);
  const hh = Math.max(...slice.map(c => parseFloat(c.high)));
  const ll = Math.min(...slice.map(c => parseFloat(c.low)));
  const close = parseFloat(candles[candles.length - 1].close);
  if (hh === ll) return -50;
  return parseFloat((((hh - close) / (hh - ll)) * -100).toFixed(2));
}

function calcUltimateOscillator(candles, p1 = 7, p2 = 14, p3 = 28) {
  if (candles.length < p3 + 1) return null;
  const bp = [], tr = [];
  for (let i = 1; i < candles.length; i++) {
    const h = parseFloat(candles[i].high);
    const l = parseFloat(candles[i].low);
    const c = parseFloat(candles[i].close);
    const pc = parseFloat(candles[i - 1].close);
    const trueHigh = Math.max(h, pc);
    const trueLow = Math.min(l, pc);
    bp.push(c - trueLow);
    tr.push(trueHigh - trueLow);
  }
  const sumBP1 = bp.slice(-p1).reduce((a, b) => a + b, 0);
  const sumTR1 = tr.slice(-p1).reduce((a, b) => a + b, 0);
  const sumBP2 = bp.slice(-p2).reduce((a, b) => a + b, 0);
  const sumTR2 = tr.slice(-p2).reduce((a, b) => a + b, 0);
  const sumBP3 = bp.slice(-p3).reduce((a, b) => a + b, 0);
  const sumTR3 = tr.slice(-p3).reduce((a, b) => a + b, 0);
  if (!sumTR1 || !sumTR2 || !sumTR3) return null;
  const uo = 100 * ((4 * sumBP1 / sumTR1) + (2 * sumBP2 / sumTR2) + (sumBP3 / sumTR3)) / 7;
  return parseFloat(uo.toFixed(2));
}

function calcRelativeVigorIndex(candles, period = 10) {
  if (candles.length < period + 4) return null;
  const numerators = [], denominators = [];
  for (let i = 3; i < candles.length; i++) {
    const c = candles[i], c1 = candles[i-1], c2 = candles[i-2], c3 = candles[i-3];
    const num = (parseFloat(c.close) - parseFloat(c.open)
      + 2*(parseFloat(c1.close) - parseFloat(c1.open))
      + 2*(parseFloat(c2.close) - parseFloat(c2.open))
      + (parseFloat(c3.close) - parseFloat(c3.open))) / 6;
    const den = (parseFloat(c.high) - parseFloat(c.low)
      + 2*(parseFloat(c1.high) - parseFloat(c1.low))
      + 2*(parseFloat(c2.high) - parseFloat(c2.low))
      + (parseFloat(c3.high) - parseFloat(c3.low))) / 6;
    numerators.push(num);
    denominators.push(den);
  }
  if (numerators.length < period) return null;
  const rvi = numerators.slice(-period).reduce((a, b) => a + b, 0) /
              (denominators.slice(-period).reduce((a, b) => a + b, 0) || 1);
  const sig = (rvi + 2*rvi + 2*rvi + rvi) / 6; // simplified signal
  return { rvi: parseFloat(rvi.toFixed(4)), signal: parseFloat(sig.toFixed(4)) };
}

// ── Volatility Indicators ─────────────────────────────────────

function calcATR(candles, period = 14) {
  if (candles.length < period + 1) return null;
  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    const h = parseFloat(candles[i].high);
    const l = parseFloat(candles[i].low);
    const pc = parseFloat(candles[i - 1].close);
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  if (trs.length < period) return null;
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trs.length; i++) atr = (atr * (period - 1) + trs[i]) / period;
  return parseFloat(atr.toFixed(4));
}

function calcBollingerBands(closes, period = 20, mult = 2) {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  const sma = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((s, v) => s + Math.pow(v - sma, 2), 0) / period;
  const stdDev = Math.sqrt(variance);
  const upper = sma + mult * stdDev;
  const lower = sma - mult * stdDev;
  const close = closes[closes.length - 1];
  let position = 'Tengah';
  if (close >= upper * 0.998) position = 'Dekat Upper';
  else if (close <= lower * 1.002) position = 'Dekat Lower';
  return {
    upper: parseFloat(upper.toFixed(3)),
    middle: parseFloat(sma.toFixed(3)),
    lower: parseFloat(lower.toFixed(3)),
    bandwidth: parseFloat(((upper - lower) / sma * 100).toFixed(3)),
    percentB: parseFloat(((close - lower) / (upper - lower) * 100).toFixed(2)),
    position,
  };
}

// ── Trend Strength ────────────────────────────────────────────

function calcADX(candles, period = 14) {
  if (candles.length < period * 2) return null;
  const dmPlus = [], dmMinus = [], trs = [];
  for (let i = 1; i < candles.length; i++) {
    const h = parseFloat(candles[i].high), l = parseFloat(candles[i].low);
    const ph = parseFloat(candles[i-1].high), pl = parseFloat(candles[i-1].low);
    const pc = parseFloat(candles[i-1].close);
    const up = h - ph, down = pl - l;
    dmPlus.push(up > down && up > 0 ? up : 0);
    dmMinus.push(down > up && down > 0 ? down : 0);
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  if (trs.length < period) return null;
  let sTR = trs.slice(0, period).reduce((a, b) => a + b, 0);
  let sDMP = dmPlus.slice(0, period).reduce((a, b) => a + b, 0);
  let sDMM = dmMinus.slice(0, period).reduce((a, b) => a + b, 0);
  const dxVals = [];
  for (let i = period; i < trs.length; i++) {
    sTR = sTR - sTR / period + trs[i];
    sDMP = sDMP - sDMP / period + dmPlus[i];
    sDMM = sDMM - sDMM / period + dmMinus[i];
    const diP = sTR > 0 ? (sDMP / sTR) * 100 : 0;
    const diM = sTR > 0 ? (sDMM / sTR) * 100 : 0;
    const diSum = diP + diM;
    dxVals.push({ dx: diSum > 0 ? (Math.abs(diP - diM) / diSum) * 100 : 0, diPlus: diP, diMinus: diM });
  }
  if (dxVals.length < period) return null;
  const adx = dxVals.slice(-period).reduce((s, v) => s + v.dx, 0) / period;
  const last = dxVals[dxVals.length - 1];
  return {
    adx: parseFloat(adx.toFixed(2)),
    diPlus: parseFloat(last.diPlus.toFixed(2)),
    diMinus: parseFloat(last.diMinus.toFixed(2)),
  };
}

function calcAroon(candles, period = 25) {
  if (candles.length < period + 1) return null;
  const slice = candles.slice(-(period + 1));
  const highs = slice.map(c => parseFloat(c.high));
  const lows  = slice.map(c => parseFloat(c.low));
  const highestIdx = highs.indexOf(Math.max(...highs));
  const lowestIdx  = lows.indexOf(Math.min(...lows));
  const aroonUp   = ((highestIdx) / period) * 100;
  const aroonDown = ((lowestIdx)  / period) * 100;
  return {
    up:   parseFloat(aroonUp.toFixed(2)),
    down: parseFloat(aroonDown.toFixed(2)),
    oscillator: parseFloat((aroonUp - aroonDown).toFixed(2)),
  };
}

function calcParabolicSAR(candles, step = 0.02, max = 0.2) {
  if (candles.length < 5) return null;
  let isUpTrend = parseFloat(candles[candles.length - 1].close) > parseFloat(candles[0].close);
  let af = step;
  let ep = isUpTrend
    ? Math.max(...candles.slice(0, 3).map(c => parseFloat(c.high)))
    : Math.min(...candles.slice(0, 3).map(c => parseFloat(c.low)));
  let sar = isUpTrend
    ? Math.min(...candles.slice(0, 3).map(c => parseFloat(c.low)))
    : Math.max(...candles.slice(0, 3).map(c => parseFloat(c.high)));

  for (let i = 3; i < candles.length; i++) {
    const h = parseFloat(candles[i].high), l = parseFloat(candles[i].low);
    sar = sar + af * (ep - sar);
    if (isUpTrend) {
      sar = Math.min(sar, parseFloat(candles[i-1].low), i >= 2 ? parseFloat(candles[i-2].low) : sar);
      if (l < sar) { isUpTrend = false; sar = ep; ep = l; af = step; }
      else { if (h > ep) { ep = h; af = Math.min(af + step, max); } }
    } else {
      sar = Math.max(sar, parseFloat(candles[i-1].high), i >= 2 ? parseFloat(candles[i-2].high) : sar);
      if (h > sar) { isUpTrend = true; sar = ep; ep = h; af = step; }
      else { if (l < ep) { ep = l; af = Math.min(af + step, max); } }
    }
  }
  return { sar: parseFloat(sar.toFixed(3)), trend: isUpTrend ? 'BULLISH' : 'BEARISH' };
}

function calcSuperTrend(candles, period = 10, multiplier = 3) {
  if (candles.length < period + 1) return null;
  const atr = calcATR(candles, period);
  if (!atr) return null;
  const last = candles[candles.length - 1];
  const hl2 = (parseFloat(last.high) + parseFloat(last.low)) / 2;
  const upperBand = hl2 + multiplier * atr;
  const lowerBand = hl2 - multiplier * atr;
  const close = parseFloat(last.close);
  const trend = close > lowerBand ? 'BULLISH' : 'BEARISH';
  return {
    upperBand: parseFloat(upperBand.toFixed(3)),
    lowerBand: parseFloat(lowerBand.toFixed(3)),
    trend,
    support: trend === 'BULLISH' ? parseFloat(lowerBand.toFixed(3)) : null,
    resistance: trend === 'BEARISH' ? parseFloat(upperBand.toFixed(3)) : null,
  };
}

function calcIchimoku(candles) {
  if (candles.length < 52) return null;
  const high = (arr) => Math.max(...arr.map(c => parseFloat(c.high)));
  const low  = (arr) => Math.min(...arr.map(c => parseFloat(c.low)));

  const tenkanSen  = (high(candles.slice(-9))  + low(candles.slice(-9)))  / 2;
  const kijunSen   = (high(candles.slice(-26)) + low(candles.slice(-26))) / 2;
  const senkouA    = (tenkanSen + kijunSen) / 2;
  const senkouB    = (high(candles.slice(-52)) + low(candles.slice(-52))) / 2;
  const chikouSpan = parseFloat(candles[candles.length - 1].close);
  const price26Ago = parseFloat(candles[candles.length - 26]?.close || 0);

  const currentClose = parseFloat(candles[candles.length - 1].close);
  let signal = 'NETRAL';
  if (currentClose > Math.max(senkouA, senkouB)) signal = 'BULLISH (di atas awan)';
  else if (currentClose < Math.min(senkouA, senkouB)) signal = 'BEARISH (di bawah awan)';
  else signal = 'NETRAL (dalam awan)';

  return {
    tenkanSen:  parseFloat(tenkanSen.toFixed(3)),
    kijunSen:   parseFloat(kijunSen.toFixed(3)),
    senkouA:    parseFloat(senkouA.toFixed(3)),
    senkouB:    parseFloat(senkouB.toFixed(3)),
    chikouSpan: parseFloat(chikouSpan.toFixed(3)),
    signal,
    trendCross: tenkanSen > kijunSen ? 'Tenkan > Kijun (bullish)' : 'Tenkan < Kijun (bearish)',
  };
}

// ── Master compute function ───────────────────────────────────

export function computeIndicators(candles) {
  if (!candles || candles.length < 5) return null;
  const closes = candles.map(c => parseFloat(c.close));
  return {
    // Moving Averages
    ema9:   calcEMA(closes, 9),
    ema20:  calcEMA(closes, 20),
    ema50:  calcEMA(closes, 50),
    ema200: calcEMA(closes, 200),
    sma20:  calcSMA(closes, 20),
    sma50:  calcSMA(closes, 50),
    wma20:  calcWMA(closes, 20),
    dema20: calcDEMA(closes, 20),
    tema20: calcTEMA(closes, 20),
    trix:   calcTRIX(closes, 14),
    // Momentum
    rsi14:   calcRSI(closes, 14),
    rsi7:    calcRSI(closes, 7),
    stochRsi: calcStochasticRSI(closes, 14, 14),
    macd:    calcMACD(closes),
    momentum10: calcMomentum(closes, 10),
    ao:      calcAwesomeOscillator(candles),
    cci:     calcCCI(candles, 20),
    willR:   calcWilliamsR(candles, 14),
    uo:      calcUltimateOscillator(candles),
    rvi:     calcRelativeVigorIndex(candles, 10),
    // Oscillators
    stoch:   calcStochastic(candles, 14, 3),
    // Volatility
    atr:     calcATR(candles, 14),
    bb:      calcBollingerBands(closes, 20, 2),
    // Trend Strength
    adx:       calcADX(candles, 14),
    aroon:     calcAroon(candles, 25),
    psar:      calcParabolicSAR(candles),
    superTrend: calcSuperTrend(candles, 10, 3),
    // Ichimoku
    ichimoku: calcIchimoku(candles),
  };
}

// ── News/Event Filter ─────────────────────────────────────────

const HIGH_IMPACT_KEYWORDS = ['fomc', 'nfp', 'cpi', 'fed', 'retail sales', 'gdp', 'ppi', 'minutes', 'unemployment', 'payroll'];
const WINDOW_MINUTES = 30;

function parseEventDateTime(ev) {
  if (!ev.time) return null;
  try {
    const timeMatch = ev.time.match(/^(\d+):(\d+)(am|pm)$/i);
    if (!timeMatch) return null;
    let hour = parseInt(timeMatch[1]);
    const min = parseInt(timeMatch[2]);
    const period = timeMatch[3].toLowerCase();
    if (period === 'pm' && hour !== 12) hour += 12;
    if (period === 'am' && hour === 12) hour = 0;
    const year = new Date().getFullYear();
    const dateStr = `${ev.date} ${year} ${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}:00 UTC`;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  } catch { return null; }
}

export function checkNewsFilter() {
  const events = getUpcomingEvents();
  const now = Date.now();
  const windowMs = WINDOW_MINUTES * 60 * 1000;
  for (const ev of events) {
    const isHighImpact = ev.impact === 'High' ||
      HIGH_IMPACT_KEYWORDS.some(kw => ev.event.toLowerCase().includes(kw));
    if (!isHighImpact) continue;
    const eventTime = parseEventDateTime(ev);
    if (!eventTime) continue;
    if (Math.abs(eventTime.getTime() - now) <= windowMs) {
      return { blocked: true, eventName: ev.event, eventTime: ev.time, eventDate: ev.date };
    }
  }
  return { blocked: false };
}

// ── Dynamic Position Sizing ───────────────────────────────────

function confidenceMultiplier(confidence) {
  if (confidence >= 0.85) return 1.00;
  if (confidence >= 0.70) return 0.80;
  if (confidence >= 0.55) return 0.60;
  return 0.40;
}

export function calcDynamicLot(balance, entry, sl, symbol, confidence = 0.70) {
  try {
    const pipMult = getPipMultiplier(symbol === 'V75' ? 'V75' : 'XAUUSD');
    const slDist  = Math.abs(parseFloat(entry) - parseFloat(sl));
    if (!slDist) return 0.1;
    const riskBudget = balance * 0.02 * confidenceMultiplier(confidence);
    return Math.max(0.01, Math.min(0.5, parseFloat((riskBudget / (slDist * pipMult)).toFixed(2))));
  } catch { return 0.1; }
}

// ── AI Brain (Memori Strategi) ────────────────────────────────

// ── Consecutive Loss Tracker ──────────────────────────────────

export async function getConsecutiveLosses() {
  try {
    const res = await query(
      `SELECT status FROM trades WHERE status IN ('TP_HIT','SL_HIT') ORDER BY close_time DESC LIMIT 10`
    );
    let count = 0;
    for (const row of res.rows) {
      if (row.status === 'SL_HIT') count++;
      else break;
    }
    return count;
  } catch { return 0; }
}

export async function loadAIBrain() {
  try {
    const res = await query(`SELECT strategy_doc FROM ai_brain ORDER BY id DESC LIMIT 1`);
    return res.rows.length === 0 ? null : res.rows[0].strategy_doc;
  } catch { return null; }
}

async function saveAIBrain(doc) {
  const existing = await query(`SELECT id FROM ai_brain LIMIT 1`);
  if (existing.rows.length === 0) {
    await query(`INSERT INTO ai_brain (strategy_doc) VALUES ($1)`, [JSON.stringify(doc)]);
  } else {
    await query(`UPDATE ai_brain SET strategy_doc=$1, updated_at=NOW() WHERE id=$2`,
      [JSON.stringify(doc), existing.rows[0].id]);
  }
}

async function syncStrategyRules(brainDoc, tradeOutcome) {
  try {
    const isWin = tradeOutcome === 'TP_HIT';
    const ruleGroups = [
      { category: 'rule',      items: brainDoc.rules             || [] },
      { category: 'setup',     items: brainDoc.best_setups        || [] },
      { category: 'avoid',     items: brainDoc.avoid_conditions   || [] },
      { category: 'risk',      items: brainDoc.risk_notes         || [] },
    ];
    for (const { category, items } of ruleGroups) {
      for (const ruleText of items) {
        if (!ruleText || typeof ruleText !== 'string') continue;
        const existing = await query(
          `SELECT id, times_applied, success_count, fail_count FROM strategy_rules WHERE rule_text = $1 LIMIT 1`,
          [ruleText]
        );
        if (existing.rows.length === 0) {
          const sc = isWin ? 1 : 0;
          const fc = isWin ? 0 : 1;
          await query(
            `INSERT INTO strategy_rules (rule_text, rule_category, times_applied, success_count, fail_count, success_rate)
             VALUES ($1, $2, 1, $3, $4, $5)`,
            [ruleText, category, sc, fc, sc]
          );
        } else {
          const r = existing.rows[0];
          const ta = r.times_applied + 1;
          const sc = r.success_count + (isWin ? 1 : 0);
          const fc = r.fail_count    + (isWin ? 0 : 1);
          const sr = parseFloat((sc / ta).toFixed(4));
          await query(
            `UPDATE strategy_rules SET times_applied=$1, success_count=$2, fail_count=$3, success_rate=$4, last_updated_at=NOW()
             WHERE id=$5`,
            [ta, sc, fc, sr, r.id]
          );
        }
      }
    }
  } catch (err) {
    console.error('[syncStrategyRules] Error:', err.message);
  }
}

export async function runStrategyEvolution(tradeResult) {
  try {
    const brain = await loadAIBrain();
    const evolCount = (brain?.evolution_count || 0) + 1;

    // Build existing trade memory (keep last 30 entries)
    const existingMemory = brain?.trade_memory || [];
    const newMemoryEntry = {
      no: evolCount,
      waktu: new Date(tradeResult.close_time || Date.now()).toISOString(),
      simbol: tradeResult.symbol,
      aksi: tradeResult.action,
      hasil: tradeResult.status === 'TP_HIT' ? 'WIN' : 'LOSS',
      pnl: parseFloat(tradeResult.pnl || 0).toFixed(2),
      strategi: tradeResult.strategy || '-',
      entry: tradeResult.entry,
      sl: tradeResult.sl,
      tp: tradeResult.tp,
      close: tradeResult.close_price,
    };
    const updatedMemory = [...existingMemory, newMemoryEntry].slice(-30);

    // Format last 10 trade memories for context
    const memoryContext = updatedMemory.slice(-10).map(m =>
      `  #${m.no} [${m.hasil}] ${m.aksi} ${m.simbol} | PnL: $${m.pnl} | Strategi: ${m.strategi} | Entry: ${m.entry} → Close: ${m.close}`
    ).join('\n');

    const brainContext = brain ? `
ATURAN AKTIF (${brain.rules?.length || 0} aturan):
${(brain.rules || []).map((r, i) => `  ${i+1}. ${r}`).join('\n') || '  (belum ada)'}

SETUP TERBUKTI PROFIT:
${(brain.best_setups || []).map((r, i) => `  ${i+1}. ${r}`).join('\n') || '  (belum ada)'}

KONDISI YANG DIHINDARI:
${(brain.avoid_conditions || []).map((r, i) => `  ${i+1}. ${r}`).join('\n') || '  (belum ada)'}

PREFERENSI INDIKATOR:
${brain.indicator_preferences ? Object.entries(brain.indicator_preferences).map(([k,v]) => `  - ${k}: ${v}`).join('\n') : '  (belum ada)'}

CATATAN RISIKO:
${(brain.risk_notes || []).map((r, i) => `  ${i+1}. ${r}`).join('\n') || '  (belum ada)'}` : '(Otak baru — evolusi pertama)';

    // Capture market conditions at close time
    let marketSnapshot = '(Tidak tersedia)';
    try {
      const activeData = getActiveMarketData();
      const closeCandles = activeData.m5Candles || activeData.candles || [];
      const ind = computeIndicators(closeCandles);
      if (ind && closeCandles.length > 0) {
        const lastClose = parseFloat(closeCandles[closeCandles.length - 1]?.close || 0);
        const f = (v, d = 2) => v != null ? parseFloat(v).toFixed(d) : 'N/A';
        const trend = ind.ema20 != null && ind.ema50 != null
          ? (ind.ema20 > ind.ema50 ? 'BULLISH (EMA20>EMA50)' : 'BEARISH (EMA20<EMA50)')
          : 'N/A';
        const rsiSig = ind.rsi14 != null
          ? (ind.rsi14 >= 70 ? 'OVERBOUGHT' : ind.rsi14 <= 30 ? 'OVERSOLD' : ind.rsi14 > 55 ? 'Bullish' : ind.rsi14 < 45 ? 'Bearish' : 'Netral')
          : 'N/A';
        const adxSig = ind.adx != null ? (ind.adx.adx >= 25 ? `Tren KUAT (ADX ${f(ind.adx.adx, 1)})` : `Sideways (ADX ${f(ind.adx.adx, 1)})`) : 'N/A';
        const bbPos = ind.bb != null
          ? (lastClose > ind.bb.upper ? 'Di atas BB Atas' : lastClose < ind.bb.lower ? 'Di bawah BB Bawah' : 'Di dalam BB')
          : 'N/A';
        const ichimoku = ind.ichimoku != null
          ? (lastClose > ind.ichimoku.senkouA && lastClose > ind.ichimoku.senkouB ? 'Di atas awan (Bullish)' : lastClose < ind.ichimoku.senkouA && lastClose < ind.ichimoku.senkouB ? 'Di bawah awan (Bearish)' : 'Di dalam awan (Netral)')
          : 'N/A';
        marketSnapshot = `Harga Terakhir : ${lastClose}
  Tren EMA     : ${trend}
  RSI-14       : ${f(ind.rsi14)} [${rsiSig}]
  MACD         : ${ind.macd ? `${f(ind.macd.macd)} | Signal: ${f(ind.macd.signal)} | Hist: ${f(ind.macd.histogram)}` : 'N/A'}
  Stochastic   : ${ind.stoch ? `K=${f(ind.stoch.k,1)} D=${f(ind.stoch.d,1)}` : 'N/A'}
  ADX          : ${adxSig}
  Bollinger    : ${bbPos}
  Ichimoku     : ${ichimoku}
  SuperTrend   : ${ind.supertrend ? (ind.supertrend.signal === 'BULLISH' ? 'BULLISH' : 'BEARISH') : 'N/A'}
  ATR-14       : ${f(ind.atr14, 4)}`;
      }
    } catch {}

    const currentConsecutiveLosses = await getConsecutiveLosses();
    const lossStreakWarning = currentConsecutiveLosses >= 2
      ? `\n⚠️ PERHATIAN KRITIS: Setelah pembaruan ini, Anda akan memiliki ${currentConsecutiveLosses} loss berturut-turut.\nFokus UTAMA: Identifikasi pola spesifik yang menyebabkan loss beruntun ini. Perbarui "avoid_conditions" dengan sangat spesifik.\nKurangi rules trading — lebih sedikit tapi lebih tepat. Prioritaskan PRESERVASI MODAL.\n`
      : '';

    const evolutionPrompt = `Anda adalah DzeckAI — agen trading otonom yang baru saja menutup sebuah posisi.${lossStreakWarning}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OTAK STRATEGI ANDA SAAT INI (Evolusi ke-${evolCount})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${brainContext}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RIWAYAT TRADE TERAKHIR (memori jangka panjang):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${memoryContext || '  (tidak ada riwayat sebelumnya)'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KONDISI PASAR SAAT PENUTUPAN:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${marketSnapshot}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TRADE YANG BARU DITUTUP — ANALISIS INI:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Simbol     : ${tradeResult.symbol}
- Aksi       : ${tradeResult.action}
- Hasil      : ${tradeResult.status === 'TP_HIT' ? '✅ WIN — TP tercapai' : '❌ LOSS — SL terkena'}
- Entry      : ${tradeResult.entry}
- Close      : ${tradeResult.close_price}
- SL         : ${tradeResult.sl}
- TP         : ${tradeResult.tp}
- Lot        : ${tradeResult.lot}
- PnL        : $${parseFloat(tradeResult.pnl || 0).toFixed(2)}
- Strategi   : ${tradeResult.strategy || 'Tidak dicatat'}
- Durasi     : ${tradeResult.open_time} → ${tradeResult.close_time}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INSTRUKSI EVOLUSI:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Berdasarkan trade ini DAN riwayat trade sebelumnya, perbarui otak strategi Anda.
Pertanyaan yang harus dijawab dalam update:
${tradeResult.status === 'TP_HIT'
  ? '- Setup apa yang berhasil? Indikator mana yang memberikan sinyal tepat? Pola apa yang bisa diulang?'
  : '- Mengapa harga berbalik? Indikator mana yang menyesatkan? Kondisi apa yang harus dihindari ke depan?'}
- Apakah ada pola dari riwayat trade sebelumnya yang perlu dikonfirmasi atau dibantah?
- Apa aturan baru atau revisi aturan lama berdasarkan pengalaman ini?

Keluarkan HANYA JSON valid (tanpa markdown/code fence):
{
  "updated_brain": {
    "rules": ["maks 8 aturan strategi paling penting dalam Bahasa Indonesia"],
    "best_setups": ["maks 5 setup yang terbukti profit berdasarkan riwayat"],
    "avoid_conditions": ["maks 5 kondisi yang harus dihindari berdasarkan riwayat loss"],
    "indicator_preferences": {"nama_indikator": "cara penggunaan yang terbukti efektif"},
    "risk_notes": ["maks 4 catatan manajemen risiko dari pengalaman nyata"],
    "trade_memory": ${JSON.stringify(updatedMemory)},
    "win_count": ${(brain?.win_count || 0) + (tradeResult.status === 'TP_HIT' ? 1 : 0)},
    "loss_count": ${(brain?.loss_count || 0) + (tradeResult.status === 'SL_HIT' ? 1 : 0)},
    "total_pnl": ${parseFloat((brain?.total_pnl || 0) + parseFloat(tradeResult.pnl || 0)).toFixed(2)},
    "evolution_count": ${evolCount}
  },
  "change_summary": "satu kalimat Bahasa Indonesia: apa yang dipelajari dari trade ini dan apa yang diubah"
}`;

    let parsed = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await cohere.chat({
          model: 'command-r-plus-08-2024',
          message: evolutionPrompt,
          temperature: 0.3,
          maxTokens: 2000,
        });
        const text = response.text.trim();
        // Extract JSON even if wrapped
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
        if (!parsed.updated_brain || !parsed.change_summary) throw new Error('Missing fields');
        // Ensure trade_memory is preserved even if AI omitted it
        if (!parsed.updated_brain.trade_memory) {
          parsed.updated_brain.trade_memory = updatedMemory;
        }
        if (!parsed.updated_brain.win_count)  parsed.updated_brain.win_count  = (brain?.win_count  || 0) + (tradeResult.status === 'TP_HIT' ? 1 : 0);
        if (!parsed.updated_brain.loss_count) parsed.updated_brain.loss_count = (brain?.loss_count || 0) + (tradeResult.status === 'SL_HIT' ? 1 : 0);
        if (parsed.updated_brain.total_pnl === undefined) parsed.updated_brain.total_pnl = parseFloat((brain?.total_pnl || 0) + parseFloat(tradeResult.pnl || 0)).toFixed(2);
        if (!parsed.updated_brain.evolution_count) parsed.updated_brain.evolution_count = evolCount;
        break;
      } catch (err) {
        console.error(`[Evolution] Attempt ${attempt} failed: ${err.message}`);
        if (attempt >= 2) {
          // Fallback: preserve memory manually without AI rewrite
          const fallbackBrain = {
            ...(brain || {}),
            trade_memory: updatedMemory,
            win_count:  (brain?.win_count  || 0) + (tradeResult.status === 'TP_HIT' ? 1 : 0),
            loss_count: (brain?.loss_count || 0) + (tradeResult.status === 'SL_HIT' ? 1 : 0),
            total_pnl:  parseFloat((brain?.total_pnl || 0) + parseFloat(tradeResult.pnl || 0)).toFixed(2),
            evolution_count: evolCount,
          };
          await saveAIBrain(fallbackBrain);
          await syncStrategyRules(fallbackBrain, tradeResult.status);
          await query(
            `INSERT INTO strategy_evolution_log (trade_id, trade_outcome, change_summary, brain_snapshot) VALUES ($1, $2, $3, $4)`,
            [tradeResult.id, tradeResult.status, `[Fallback] Memori trade disimpan tanpa rewrite AI`, JSON.stringify(fallbackBrain)]
          );
          return { brain: fallbackBrain, summary: `Memori trade disimpan (fallback)` };
        }
        parsed = null;
      }
    }

    if (!parsed) return null;
    await saveAIBrain(parsed.updated_brain);
    await syncStrategyRules(parsed.updated_brain, tradeResult.status);
    await query(
      `INSERT INTO strategy_evolution_log (trade_id, trade_outcome, change_summary, brain_snapshot) VALUES ($1, $2, $3, $4)`,
      [tradeResult.id, tradeResult.status, parsed.change_summary, JSON.stringify(parsed.updated_brain)]
    );
    console.log(`[Evolution] Brain updated (evolusi #${evolCount}) after ${tradeResult.status}: ${parsed.change_summary}`);
    return { brain: parsed.updated_brain, summary: parsed.change_summary };
  } catch (err) {
    console.error('[Evolution] Error:', err.message);
    return null;
  }
}

// ── Prompt Builders ───────────────────────────────────────────

function formatCandleTable(candles) {
  if (!candles || candles.length === 0) return '(Data tidak tersedia)';
  const header  = 'Time   | Open     | High     | Low      | Close    |';
  const divider = '──────────────────────────────────────────────────────';
  const rows = candles.map(c => {
    const time = c.time
      ? new Date(c.time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
      : '00:00';
    const fmt = (n) => parseFloat(n).toFixed(2).padStart(9);
    return `${time}  |${fmt(c.open)}|${fmt(c.high)}|${fmt(c.low)}|${fmt(c.close)}|`;
  });
  return [header, divider, ...rows].join('\n');
}

function buildTechnicalSummary(candles, label) {
  if (!candles || candles.length === 0) return `${label}: Data tidak tersedia.`;
  const closes = candles.map(c => parseFloat(c.close));
  const highs  = candles.map(c => parseFloat(c.high));
  const lows   = candles.map(c => parseFloat(c.low));
  return `- Level Support: ${Math.min(...lows).toFixed(2)}
- Level Resistance: ${Math.max(...highs).toFixed(2)}
- Harga Terkini: ${closes[closes.length - 1].toFixed(3)}
- Tren Jangka Pendek: ${closes[closes.length - 1] > closes[0] ? 'BULLISH' : 'BEARISH'}
- Rentang Candle: ${((Math.max(...highs) - Math.min(...lows)) * 10).toFixed(1)} pips`;
}

function formatIndicatorsTable(ind) {
  if (!ind) return '(Indikator tidak tersedia — data candle kurang)';

  const f = (v, d = 3) => v != null ? parseFloat(v).toFixed(d) : 'N/A';
  const na = (v) => v != null ? String(v) : 'N/A';

  // EMA trend signal
  let emaTren = 'N/A';
  if (ind.ema20 != null && ind.ema50 != null) {
    emaTren = ind.ema20 > ind.ema50 ? 'BULLISH (EMA20>EMA50)' : 'BEARISH (EMA20<EMA50)';
    if (ind.ema200 != null) emaTren += ind.ema20 > ind.ema200 ? ' | Atas EMA200' : ' | Bawah EMA200';
  }
  const rsiSig = ind.rsi14 != null
    ? (ind.rsi14 >= 70 ? ' [OVERBOUGHT]' : ind.rsi14 <= 30 ? ' [OVERSOLD]' : ind.rsi14 > 55 ? ' [Bullish]' : ind.rsi14 < 45 ? ' [Bearish]' : ' [Netral]')
    : '';
  const stochSig = ind.stoch != null
    ? (ind.stoch.k >= 80 ? ' [OVERBOUGHT]' : ind.stoch.k <= 20 ? ' [OVERSOLD]' : ind.stoch.k > ind.stoch.d ? ' [K>D Bullish]' : ' [K<D Bearish]')
    : '';
  const adxSig = ind.adx != null
    ? (ind.adx.adx >= 25
        ? ` [Tren KUAT — DI${ind.adx.diPlus > ind.adx.diMinus ? '+' : '-'} dominan]`
        : ' [Sideways/Lemah]')
    : '';
  const cciSig = ind.cci != null ? (ind.cci > 100 ? ' [OVERBOUGHT]' : ind.cci < -100 ? ' [OVERSOLD]' : ' [Netral]') : '';
  const willRSig = ind.willR != null ? (ind.willR > -20 ? ' [OVERBOUGHT]' : ind.willR < -80 ? ' [OVERSOLD]' : ' [Netral]') : '';

  const pad = (s, n = 40) => String(s).substring(0, n).padEnd(n);

  return `╔══════════════════════════════════════════════════════════╗
║  📊 INDIKATOR TEKNIKAL LENGKAP (TRADINGVIEW STYLE)       ║
╠══════════════════╦═══════════════════════════════════════╣
║ ── MOVING AVERAGE (TREN) ──                              ║
╠══════════════════╬═══════════════════════════════════════╣
║ EMA 9            ║ ${pad(f(ind.ema9))} ║
║ EMA 20           ║ ${pad(f(ind.ema20))} ║
║ EMA 50           ║ ${pad(f(ind.ema50))} ║
║ EMA 200          ║ ${pad(f(ind.ema200))} ║
║ SMA 20           ║ ${pad(f(ind.sma20))} ║
║ SMA 50           ║ ${pad(f(ind.sma50))} ║
║ WMA 20           ║ ${pad(f(ind.wma20))} ║
║ DEMA 20          ║ ${pad(f(ind.dema20))} ║
║ TEMA 20          ║ ${pad(f(ind.tema20))} ║
║ TRIX (14)        ║ ${pad(f(ind.trix, 4))} ║
║ Sinyal EMA       ║ ${pad(emaTren)} ║
╠══════════════════╬═══════════════════════════════════════╣
║ ── MOMENTUM & OSCILLATOR ──                              ║
╠══════════════════╬═══════════════════════════════════════╣
║ RSI (14)         ║ ${pad(f(ind.rsi14, 2) + rsiSig)} ║
║ RSI (7) Cepat    ║ ${pad(f(ind.rsi7, 2))} ║
║ Stoch RSI K      ║ ${pad(ind.stochRsi ? f(ind.stochRsi.k, 2) : 'N/A')} ║
║ Stoch RSI D      ║ ${pad(ind.stochRsi ? f(ind.stochRsi.d, 2) : 'N/A')} ║
║ MACD Line        ║ ${pad(ind.macd ? f(ind.macd.macd, 4) : 'N/A')} ║
║ MACD Signal      ║ ${pad(ind.macd ? f(ind.macd.signal, 4) : 'N/A')} ║
║ MACD Histogram   ║ ${pad(ind.macd ? f(ind.macd.histogram, 4) + (ind.macd.histogram > 0 ? ' [Bullish]' : ' [Bearish]') : 'N/A')} ║
║ Stochastic K     ║ ${pad(ind.stoch ? f(ind.stoch.k, 2) + stochSig : 'N/A')} ║
║ Stochastic D     ║ ${pad(ind.stoch ? f(ind.stoch.d, 2) : 'N/A')} ║
║ CCI (20)         ║ ${pad(f(ind.cci, 2) + cciSig)} ║
║ Williams %R      ║ ${pad(f(ind.willR, 2) + willRSig)} ║
║ Momentum (10)    ║ ${pad(f(ind.momentum10, 4))} ║
║ Awesome Osc.     ║ ${pad(f(ind.ao, 4) + (ind.ao != null ? (ind.ao > 0 ? ' [Bullish]' : ' [Bearish]') : ''))} ║
║ Ultimate Osc.    ║ ${pad(ind.uo != null ? f(ind.uo, 2) + (ind.uo > 70 ? ' [OVERBOUGHT]' : ind.uo < 30 ? ' [OVERSOLD]' : ' [Netral]') : 'N/A')} ║
║ RVI              ║ ${pad(ind.rvi ? f(ind.rvi.rvi, 4) : 'N/A')} ║
╠══════════════════╬═══════════════════════════════════════╣
║ ── VOLATILITAS ──                                        ║
╠══════════════════╬═══════════════════════════════════════╣
║ ATR (14)         ║ ${pad(f(ind.atr, 4))} ║
║ BB Upper         ║ ${pad(ind.bb ? f(ind.bb.upper) : 'N/A')} ║
║ BB Middle        ║ ${pad(ind.bb ? f(ind.bb.middle) : 'N/A')} ║
║ BB Lower         ║ ${pad(ind.bb ? f(ind.bb.lower) : 'N/A')} ║
║ BB Bandwidth     ║ ${pad(ind.bb ? f(ind.bb.bandwidth, 3) + '%' : 'N/A')} ║
║ BB %B            ║ ${pad(ind.bb ? f(ind.bb.percentB, 2) + '% — ' + (ind.bb.position || '') : 'N/A')} ║
╠══════════════════╬═══════════════════════════════════════╣
║ ── KEKUATAN TREN ──                                      ║
╠══════════════════╬═══════════════════════════════════════╣
║ ADX (14)         ║ ${pad(ind.adx ? f(ind.adx.adx, 2) + adxSig : 'N/A')} ║
║ DI+ / DI-        ║ ${pad(ind.adx ? f(ind.adx.diPlus, 2) + ' / ' + f(ind.adx.diMinus, 2) : 'N/A')} ║
║ Aroon Up         ║ ${pad(ind.aroon ? f(ind.aroon.up, 2) : 'N/A')} ║
║ Aroon Down       ║ ${pad(ind.aroon ? f(ind.aroon.down, 2) : 'N/A')} ║
║ Aroon Osc.       ║ ${pad(ind.aroon ? f(ind.aroon.oscillator, 2) + (ind.aroon.oscillator > 0 ? ' [Bullish]' : ' [Bearish]') : 'N/A')} ║
║ Parabolic SAR    ║ ${pad(ind.psar ? f(ind.psar.sar) + ' — ' + ind.psar.trend : 'N/A')} ║
║ SuperTrend       ║ ${pad(ind.superTrend ? ind.superTrend.trend + ' (LB:' + f(ind.superTrend.lowerBand) + ')' : 'N/A')} ║
╠══════════════════╬═══════════════════════════════════════╣
║ ── ICHIMOKU CLOUD ──                                     ║
╠══════════════════╬═══════════════════════════════════════╣
║ Tenkan-sen       ║ ${pad(ind.ichimoku ? f(ind.ichimoku.tenkanSen) : 'N/A (butuh 52 candle)')} ║
║ Kijun-sen        ║ ${pad(ind.ichimoku ? f(ind.ichimoku.kijunSen) : 'N/A')} ║
║ Senkou A         ║ ${pad(ind.ichimoku ? f(ind.ichimoku.senkouA) : 'N/A')} ║
║ Senkou B         ║ ${pad(ind.ichimoku ? f(ind.ichimoku.senkouB) : 'N/A')} ║
║ Chikou Span      ║ ${pad(ind.ichimoku ? f(ind.ichimoku.chikouSpan) : 'N/A')} ║
║ Sinyal Ichimoku  ║ ${pad(ind.ichimoku ? ind.ichimoku.signal : 'N/A')} ║
║ Cross TK         ║ ${pad(ind.ichimoku ? ind.ichimoku.trendCross : 'N/A')} ║
╚══════════════════╩═══════════════════════════════════════╝`;
}

async function buildPrompt(symbol, m5Candles, m15Candles, macro, lastTrade, balance, calculatedLot, consecutiveLosses = 0) {
  const cfg = SYMBOL_CONFIG[symbol] || SYMBOL_CONFIG.XAUUSD;
  const isV75 = symbol === 'V75';
  const currentClose = m5Candles.length > 0
    ? parseFloat(m5Candles[m5Candles.length - 1].close).toFixed(3)
    : 'N/A';

  const indM5  = computeIndicators(m5Candles);
  const indM15 = computeIndicators(m15Candles);

  const brain = await loadAIBrain();
  let brainSection;

  const lossAlert = consecutiveLosses >= 3
    ? `\n🔴 PERINGATAN KRITIS: ${consecutiveLosses} LOSS BERTURUT-TURUT!\nAnda WAJIB HOLD kecuali ada konfluensi kuat ≥5 indikator yang satu arah.\nTinjau ulang kondisi yang harus dihindari dan JANGAN masuk pasar jika ragu.\n`
    : consecutiveLosses >= 2
    ? `\n🟡 WASPADA: ${consecutiveLosses} loss berturut-turut. Tingkatkan selektivitas — hanya masuk jika confidence ≥ 0.70 dan minimal 4 indikator konfirmasi.\n`
    : consecutiveLosses === 1
    ? `\n🟠 Catatan: Loss pada trade terakhir. Evaluasi kondisi sebelum entry berikutnya.\n`
    : '';

  if (!brain || Object.keys(brain).length === 0) {
    brainSection = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 MEMORI STRATEGI ANDA SAAT INI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Anda belum memiliki strategi — mulai dari nol dan temukan sendiri.
Gunakan indikator teknikal di bawah untuk eksperimen pertama Anda.
${lossAlert}`;
  } else {
    const evolCount = brain.evolution_count || 0;
    const winCount  = brain.win_count  || 0;
    const lossCount = brain.loss_count || 0;
    const totalTrades = winCount + lossCount;
    const winRate   = totalTrades > 0 ? `${((winCount / totalTrades) * 100).toFixed(0)}%` : 'N/A';
    const rules    = (brain.rules || []).map((r, i) => `  ${i+1}. ${r}`).join('\n') || '  (belum ada)';
    const setups   = (brain.best_setups || []).map((r, i) => `  ${i+1}. ${r}`).join('\n') || '  (belum ada)';
    const avoid    = (brain.avoid_conditions || []).map((r, i) => `  ${i+1}. ${r}`).join('\n') || '  (belum ada)';
    const riskN    = (brain.risk_notes || []).map((r, i) => `  ${i+1}. ${r}`).join('\n') || '  (belum ada)';
    brainSection = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 MEMORI STRATEGI ANDA SAAT INI (${evolCount} evolusi | W:${winCount} L:${lossCount} | WR: ${winRate})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${lossAlert}
📌 ATURAN YANG SAYA TEMUKAN SENDIRI:
${rules}

✅ SETUP TERBAIK YANG TERBUKTI:
${setups}

🚫 KONDISI YANG HARUS DIHINDARI — PERIKSA INI SEBELUM ENTRY:
${avoid}

⚠️ CATATAN MANAJEMEN RISIKO:
${riskN}

PENTING: Aturan di atas adalah hasil penemuan Anda sendiri. Ikuti dan sempurnakan terus.
Sebelum memutuskan BUY/SELL, cek kondisi "HARUS DIHINDARI" — jika terpenuhi, HOLD.`;
  }

  const lastTradeSection = lastTrade
    ? `🧠 HASIL TRADE TERAKHIR: ${lastTrade.status === 'TP_HIT' ? 'WIN ✅' : lastTrade.status === 'SL_HIT' ? 'LOSS ❌' : 'OPEN 🔄'}
Simbol: ${lastTrade.symbol} | Aksi: ${lastTrade.action} | PnL: $${parseFloat(lastTrade.pnl || 0).toFixed(2)}
Entry: ${lastTrade.entry} | Close: ${lastTrade.close_price || 0} | SL: ${lastTrade.sl} | TP: ${lastTrade.tp}

📑 ATURAN REFLEKSI:
- Lihat HARGA AKTUAL di atas — JANGAN halusinasi angka
- Jika SL kena → indikator mana yang menyesatkan? Apa yang harus diperbaiki?
- Isi field "reflection" dengan analisis faktual 2-3 kalimat Bahasa Indonesia.`
    : '🧠 HASIL TRADE TERAKHIR: Tidak ada trade sebelumnya.';

  const marketCtx = isV75
    ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 KONTEKS MARKET
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ MODE AKTIF: Volatility 75 Index (R_75) — Synthetic Index Deriv
Market XAUUSD sedang TUTUP. DzeckAI beroperasi pada Synthetic Index 24/7.
Analisis murni TEKNIKAL — tidak ada pengaruh makro/berita.`
    : `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 MARKET INTELLIGENCE (MACRO & NEWS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${formatMacroSection(macro)}

🗓 UPCOMING ECONOMIC EVENTS:
${formatEventsSection(getUpcomingEvents())}

📰 RECENT HEADLINES:
${getRecentHeadlines().map(h => `- ${h}`).join('\n')}`;

  return `${brainSection}

${marketCtx}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📂 INSTRUMEN AKTIF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔥 ${cfg.displayName} (${cfg.fullName}) | Harga Terkini: ${currentClose}
${isV75 ? 'Tipe: Synthetic Index | Volatilitas: Tinggi | Jam: 24/7' : 'Tipe: Komoditas / Forex | XAU/USD Spot'}

💰 PORTOFOLIO SAAT INI:
- Balance: $${balance.toLocaleString('id-ID', { minimumFractionDigits: 2 })}
- Lot Size Kalkulasi (risiko 2%): ${calculatedLot} lot
- Maks Risiko per Trade: $${(balance * 0.02).toFixed(2)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 INDIKATOR TEKNIKAL M5
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${formatIndicatorsTable(indM5)}

📈 RINGKASAN STRUKTUR HARGA M5:
${buildTechnicalSummary(m5Candles, 'M5')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 KONFIRMASI INDIKATOR M15
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${formatIndicatorsTable(indM15)}

📊 ${cfg.displayName} M5 (20 candle terakhir):
${formatCandleTable(m5Candles.slice(-20))}

📊 ${cfg.displayName} M15 (20 candle terakhir):
${formatCandleTable(m15Candles.slice(-20))}

${lastTradeSection}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INSTRUKSI OUTPUT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Balas dengan HANYA JSON valid — tanpa markdown, tanpa code fence:

{"reflection":null,"symbol":"${isV75 ? 'Volatility 75 Index' : 'XAUUSD'}","strategy":"nama strategi Bahasa Indonesia","reasoning":"analisis profesional Bahasa Indonesia — sebutkan indikator yang digunakan dan rasio R:R","action":"BUY|SELL|HOLD","entry":number,"sl":number,"tp":number,"lot":${calculatedLot},"confidence":number}

Aturan wajib:
- reflection: null jika tidak ada loss, atau analisis faktual 2-3 kalimat Bahasa Indonesia jika SL_HIT
- action HOLD: tetap isi entry/sl/tp dengan level referensi yang dipantau
- confidence: 0.0-1.0 berdasarkan jumlah indikator yang mengkonfirmasi
- lot: gunakan nilai ${calculatedLot} (maksimum risiko 2% balance)
- strategy: nama dalam Bahasa Indonesia
- reasoning: WAJIB sebut indikator yang dikonfirmasi dan rasio R:R
${isV75 ? '- SL/TP: Berdasarkan volatilitas V75 dan ATR (rentang tipikal 50-300 poin dari entry)' : '- SL/TP: Berdasarkan volatilitas XAUUSD dan ATR'}`;
}

export async function runAIDecision(broadcast) {
  console.log('[AI] Starting decision cycle...');
  try {
    const activeData   = getActiveMarketData();
    const activeSymbol = getActiveSymbol();
    const { m5Candles, m15Candles, currentPrice, marketStatus } = activeData;

    if (m5Candles.length < 5) {
      console.log('[AI] Data market belum tersedia — cycle dilewati.');
      return null;
    }

    const macro = activeSymbol === 'XAUUSD'
      ? getMacroData(currentPrice || parseFloat(m5Candles[m5Candles.length - 1]?.close || 0))
      : null;

    await query(
      `INSERT INTO market_snapshots (symbol, timeframe, candle_data, macro_data) VALUES ($1, $2, $3, $4)`,
      [activeSymbol, 'M5+M15', JSON.stringify({ m5Candles, m15Candles }), macro ? JSON.stringify(macro) : null]
    );

    const recentTradesRes = await query(`SELECT * FROM trades ORDER BY open_time DESC LIMIT 5`);
    const lastTrade = recentTradesRes.rows[0] || null;

    const portfolioRes = await query(`SELECT pnl FROM trades WHERE status != 'OPEN'`);
    const totalPnl = portfolioRes.rows.reduce((sum, t) => sum + parseFloat(t.pnl || 0), 0);
    const currentBalance = 1000000 + totalPnl;

    let newsFilterResult = { blocked: false };
    if (activeSymbol === 'XAUUSD') newsFilterResult = checkNewsFilter();

    const consecutiveLosses = await getConsecutiveLosses();

    const roughEntry = currentPrice || parseFloat(m5Candles[m5Candles.length - 1]?.close || 0) || 3000;
    const roughSL    = roughEntry - (activeSymbol === 'V75' ? 100 : 15);
    const suggestedLot = calcDynamicLot(currentBalance, roughEntry, roughSL, activeSymbol);

    const prompt = await buildPrompt(activeSymbol, m5Candles, m15Candles, macro, lastTrade, currentBalance, suggestedLot, consecutiveLosses);

    if (broadcast) broadcast({ type: 'ai_thinking', data: { status: 'thinking', activeSymbol, marketStatus, timestamp: new Date().toISOString() } });

    let parsed = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await cohere.chat({
          model: 'command-r-plus-08-2024',
          message: prompt,
          preamble: SYSTEM_PROMPT,
          temperature: 0.25,
          maxTokens: 1200,
        });
        parsed = JSON.parse(response.text.trim());
        const required = ['symbol', 'strategy', 'reasoning', 'action', 'entry', 'sl', 'tp', 'confidence'];
        for (const f of required) {
          if (parsed[f] === undefined) throw new Error(`Missing field: ${f}`);
        }
        if (!['BUY', 'SELL', 'HOLD'].includes(parsed.action)) throw new Error(`Invalid action: ${parsed.action}`);
        parsed.confidence = Math.max(0, Math.min(1, parseFloat(parsed.confidence) || 0.5));
        parsed.entry = parseFloat(parsed.entry) || 0;
        parsed.sl    = parseFloat(parsed.sl)    || 0;
        parsed.tp    = parseFloat(parsed.tp)    || 0;
        break;
      } catch (err) {
        console.error(`[AI] Attempt ${attempt} failed: ${err.message}`);
        if (attempt >= 3) throw err;
        parsed = null;
      }
    }

    if (newsFilterResult.blocked && parsed.action !== 'HOLD') {
      parsed.action = 'HOLD';
      parsed.reasoning = `Menunggu event ekonomi high-impact: ${newsFilterResult.eventName} (${newsFilterResult.eventDate} ${newsFilterResult.eventTime}). Saya tidak membuka posisi baru dalam window ±30 menit. ${parsed.reasoning}`;
    }

    // Confidence threshold — block low-conviction entries, scale with loss streak
    const minConfidence = consecutiveLosses >= 3 ? 0.75 : consecutiveLosses >= 2 ? 0.68 : 0.60;
    if (parsed.action !== 'HOLD' && parsed.confidence < minConfidence) {
      const prevAction = parsed.action;
      parsed.action = 'HOLD';
      parsed.reasoning = `[AI] Confidence ${(parsed.confidence * 100).toFixed(0)}% di bawah ambang minimum ${(minConfidence * 100).toFixed(0)}% (loss streak: ${consecutiveLosses}). Sinyal ${prevAction} ditahan — menunggu konfluensi lebih kuat. ${parsed.reasoning}`;
      console.log(`[AI] Entry blocked — confidence ${parsed.confidence} < min ${minConfidence} (loss streak: ${consecutiveLosses})`);
    }

    const dynamicLot = parsed.action !== 'HOLD'
      ? calcDynamicLot(currentBalance, parsed.entry, parsed.sl, activeSymbol, parsed.confidence)
      : suggestedLot;

    let tradeId = null;
    if (parsed.action !== 'HOLD') {
      const openTrades = await query(`SELECT id FROM trades WHERE status = 'OPEN' LIMIT 1`);
      if (openTrades.rows.length === 0) {
        const slDist = Math.abs(parseFloat(parsed.entry) - parseFloat(parsed.sl));
        const tradeRes = await query(
          `INSERT INTO trades (symbol, action, entry, sl, tp, lot, strategy, reflection, original_sl_dist)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
          [parsed.symbol, parsed.action, parsed.entry, parsed.sl, parsed.tp, dynamicLot,
           parsed.strategy, parsed.reflection || null, slDist]
        );
        tradeId = tradeRes.rows[0].id;
        console.log(`[AI] New trade: ${parsed.action} ${parsed.symbol} @ ${parsed.entry} lot=${dynamicLot} (ID: ${tradeId})`);
      } else {
        console.log('[AI] Trade already open, skipping new entry');
      }
    }

    await query(
      `INSERT INTO ai_decisions (trade_id, symbol, action, entry, sl, tp, confidence, reasoning_text, reflection, strategy)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [tradeId, parsed.symbol, parsed.action, parsed.entry, parsed.sl, parsed.tp,
       parsed.confidence, parsed.reasoning, parsed.reflection || null, parsed.strategy]
    );

    return { ...parsed, lot: dynamicLot, tradeId, activeSymbol, marketStatus, dataSource: 'deriv', newsFilter: newsFilterResult, consecutiveLosses, minConfidence };
  } catch (err) {
    console.error('[AI] Decision cycle error:', err.message);
    throw err;
  }
}
