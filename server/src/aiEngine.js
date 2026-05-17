import { CohereClient } from 'cohere-ai';
import { query } from './db.js';
import { getActiveMarketData, getActiveSymbol, SYMBOL_CONFIG, getPipMultiplier } from './derivService.js';
import { getMacroData, getUpcomingEvents, getRecentHeadlines, formatMacroSection, formatEventsSection } from './macroData.js';

const cohere = new CohereClient({ token: process.env.COHERE_API_KEY });

const SYSTEM_PROMPT = `Anda adalah DzeckAI Trader — Senior Portfolio Manager Hedge Fund Kelas Dunia

IDENTITAS & PERSONA INTI:
- Saya adalah manajer portofolio senior dengan pengalaman lebih dari 15 tahun di pasar komoditas dan forex institusional
- Saya beroperasi dengan disiplin besi: preservasi modal adalah prioritas nomor satu, bukan keuntungan jangka pendek
- Saya tidak pernah membuka posisi tanpa konfirmasi dari minimal 2 indikator teknikal yang selaras
- Saya selalu menyebut rasio Risk-to-Reward sebelum mengeksekusi posisi apapun
- Saya tidak pernah overtrading — lebih baik HOLD 100% daripada entry dengan probabilitas rendah

GAYA KOMUNIKASI — BAHASA INDONESIA FORMAL & PROFESIONAL:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

KATA GANTI (Konsisten):
- Selalu gunakan "Saya" — formal, objektif, tidak pernah "aku" atau "kita"

KOSAKATA TRADING INSTITUSIONAL:
- Entry: "Eksekusi posisi", "Alokasi modal", "Masuk market pada level kunci"
- Exit: "Likuidasi posisi", "Realisasi profit", "Cut loss terukur", "Mitigasi risiko"
- Analisis: "Analisis teknikal mendalam", "Struktur harga", "Konfirmasi momentum institusional"
- Risiko: "Manajemen risiko ketat", "Drawdown control", "Rasio Risk-Reward optimal"
- Strategi harus diberi nama dalam Bahasa Indonesia (contoh: "Breakout Struktur H1", "Retest EMA50", "Momentum RSI Divergence", "Konsolidasi Menuju Resistance")

EKSPRESI PER KONDISI MARKET:
- Trending kuat: "Momentum terkonfirmasi — Saya ikuti arus institusional"
- Sideways: "Market konsolidasi tanpa momentum jelas — Saya hindari overtrading"
- Volatil tinggi: "Volatilitas ekstrem terdeteksi — Saya kurangi eksposur signifikan"
- Tidak jelas: "Probabilitas rendah, sinyal konflik — Saya alokasikan ke posisi cash (HOLD)"

PEMETAAN KEPERCAYAAN DIRI (Berbasis Data):
- 0.85-1.0: "Konfirmasi solid dari seluruh indikator teknikal — setup premium"
- 0.70-0.84: "Setup rasional dengan Risk/Reward yang memadai — entry terukur"
- 0.55-0.69: "Sinyal lemah, mitigasi risiko diutamakan — lot minimal"
- <0.55: "Kondisi tidak ideal — Saya lindungi modal utama (HOLD)"

ATURAN WAJIB SEBELUM ENTRY:
1. Selalu sebutkan rasio Risk-to-Reward (contoh: "R:R = 1:2.5")
2. Konfirmasi dari minimal 2 indikator (price action + RSI/EMA/MACD)
3. Tidak entry saat market sideways kecuali ada momentum jelas yang terukur
4. Refleksi pasca SL harus faktual, bukan spekulatif`;

// ── Technical Indicator Calculations ─────────────────────────

function calcEMA(values, period) {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  let emaVal = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) {
    emaVal = values[i] * k + emaVal * (1 - k);
  }
  return emaVal;
}

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

function calcMACD(closes) {
  if (closes.length < 26) return null;
  // Build EMA12 and EMA26 series for MACD line
  const k12 = 2 / (12 + 1);
  const k26 = 2 / (26 + 1);

  let ema12 = closes.slice(0, 12).reduce((a, b) => a + b, 0) / 12;
  let ema26 = closes.slice(0, 26).reduce((a, b) => a + b, 0) / 26;

  const macdLine = [];
  for (let i = 12; i < closes.length; i++) {
    ema12 = closes[i] * k12 + ema12 * (1 - k12);
  }
  for (let i = 26; i < closes.length; i++) {
    ema26 = closes[i] * k26 + ema26 * (1 - k26);
  }

  // Rebuild properly to get the full macd series for signal calculation
  let e12 = closes.slice(0, 12).reduce((a, b) => a + b, 0) / 12;
  let e26 = closes.slice(0, 26).reduce((a, b) => a + b, 0) / 26;
  for (let i = 12; i < 26; i++) {
    e12 = closes[i] * k12 + e12 * (1 - k12);
  }
  for (let i = 26; i < closes.length; i++) {
    e12 = closes[i] * k12 + e12 * (1 - k12);
    e26 = closes[i] * k26 + e26 * (1 - k26);
    macdLine.push(e12 - e26);
  }

  if (macdLine.length < 9) return null;
  const k9 = 2 / (9 + 1);
  let signal = macdLine.slice(0, 9).reduce((a, b) => a + b, 0) / 9;
  for (let i = 9; i < macdLine.length; i++) {
    signal = macdLine[i] * k9 + signal * (1 - k9);
  }

  const macdVal = macdLine[macdLine.length - 1];
  const histogram = macdVal - signal;
  return {
    macd: parseFloat(macdVal.toFixed(4)),
    signal: parseFloat(signal.toFixed(4)),
    histogram: parseFloat(histogram.toFixed(4)),
  };
}

export function computeIndicators(candles) {
  if (!candles || candles.length < 5) return null;
  const closes = candles.map(c => parseFloat(c.close));
  const ema20  = calcEMA(closes, 20);
  const ema50  = calcEMA(closes, 50);
  const rsi14  = calcRSI(closes, 14);
  const macd   = calcMACD(closes);
  return { ema20, ema50, rsi14, macd };
}

// ── News/Event Filter ─────────────────────────────────────────

const HIGH_IMPACT_KEYWORDS = ['fomc', 'nfp', 'cpi', 'fed', 'retail sales', 'gdp', 'ppi', 'minutes', 'unemployment', 'payroll'];
const WINDOW_MINUTES = 30;

function parseEventDateTime(ev) {
  if (!ev.time) return null;
  try {
    // Parse time like "7:30pm" or "8:30am"
    const timeMatch = ev.time.match(/^(\d+):(\d+)(am|pm)$/i);
    if (!timeMatch) return null;
    let hour = parseInt(timeMatch[1]);
    const min = parseInt(timeMatch[2]);
    const period = timeMatch[3].toLowerCase();
    if (period === 'pm' && hour !== 12) hour += 12;
    if (period === 'am' && hour === 12) hour = 0;

    // Parse date like "May 20" with current year
    const year = new Date().getFullYear();
    const dateStr = `${ev.date} ${year} ${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}:00 UTC`;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
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

    const diff = Math.abs(eventTime.getTime() - now);
    if (diff <= windowMs) {
      return { blocked: true, eventName: ev.event, eventTime: ev.time, eventDate: ev.date };
    }
  }
  return { blocked: false };
}

// ── Dynamic Position Sizing ───────────────────────────────────

// confidence tiers scale the risk budget within the 2% cap
function confidenceMultiplier(confidence) {
  if (confidence >= 0.85) return 1.00;  // full 2% budget
  if (confidence >= 0.70) return 0.80;  // 1.6%
  if (confidence >= 0.55) return 0.60;  // 1.2%
  return 0.40;                          // 0.8% — low confidence, reduce exposure
}

export function calcDynamicLot(balance, entry, sl, symbol, confidence = 0.70) {
  try {
    const pipMult    = getPipMultiplier(symbol === 'V75' ? 'V75' : 'XAUUSD');
    const slDistance = Math.abs(parseFloat(entry) - parseFloat(sl));
    if (!slDistance || slDistance === 0) return 0.1;

    const riskBudget = balance * 0.02 * confidenceMultiplier(confidence);
    const lot = riskBudget / (slDistance * pipMult);
    const clampedLot = Math.max(0.01, Math.min(0.5, parseFloat(lot.toFixed(2))));
    return clampedLot;
  } catch {
    return 0.1;
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
  const support    = Math.min(...lows).toFixed(2);
  const resistance = Math.max(...highs).toFixed(2);
  const current    = closes[closes.length - 1].toFixed(3);
  const trend      = closes[closes.length - 1] > closes[0] ? 'BULLISH' : 'BEARISH';
  const rangePips  = ((Math.max(...highs) - Math.min(...lows)) * 10).toFixed(1);
  return `- Support Level: ${support}
- Resistance Level: ${resistance}
- Current Close: ${current}
- Short-term Trend: ${trend}
- Range: ${rangePips} pips`;
}

function formatIndicatorsTable(indicators) {
  if (!indicators) return '(Indikator tidak tersedia — data candle kurang)';
  const { ema20, ema50, rsi14, macd } = indicators;
  const ema20Str = ema20 != null ? ema20.toFixed(3) : 'N/A';
  const ema50Str = ema50 != null ? ema50.toFixed(3) : 'N/A';
  const rsiStr   = rsi14 != null ? rsi14.toFixed(2) : 'N/A';
  const macdStr  = macd  != null
    ? `MACD=${macd.macd} | Signal=${macd.signal} | Hist=${macd.histogram}`
    : 'N/A';

  let rsiSignal = '';
  if (rsi14 != null) {
    if (rsi14 >= 70) rsiSignal = ' ⚠️ OVERBOUGHT';
    else if (rsi14 <= 30) rsiSignal = ' ⚠️ OVERSOLD';
    else if (rsi14 > 55) rsiSignal = ' (bullish zone)';
    else if (rsi14 < 45) rsiSignal = ' (bearish zone)';
  }

  let emaSignal = '';
  if (ema20 != null && ema50 != null) {
    emaSignal = ema20 > ema50 ? ' → Trend BULLISH (EMA20 > EMA50)' : ' → Trend BEARISH (EMA20 < EMA50)';
  }

  return `┌─────────────────────────────────────────────┐
│  INDIKATOR TEKNIKAL (Ringkasan)             │
├──────────────┬──────────────────────────────┤
│ EMA 20       │ ${ema20Str.padEnd(28)} │
│ EMA 50       │ ${ema50Str.padEnd(28)} │
│ Tren EMA     │ ${(emaSignal || 'N/A').replace(' → ', '').padEnd(28)} │
│ RSI (14)     │ ${(rsiStr + rsiSignal).padEnd(28)} │
│ MACD         │ ${macdStr.padEnd(28)} │
└──────────────┴──────────────────────────────┘`;
}

function buildPrompt(symbol, m5Candles, m15Candles, macro, lastTrade, balance, calculatedLot) {
  const cfg = SYMBOL_CONFIG[symbol] || SYMBOL_CONFIG.XAUUSD;
  const isV75 = symbol === 'V75';
  const currentClose = m5Candles.length > 0
    ? parseFloat(m5Candles[m5Candles.length - 1].close).toFixed(3)
    : 'N/A';

  const indicators = computeIndicators(m5Candles);

  const lastTradeSection = lastTrade
    ? `🧠 HASIL TRADE TERAKHIR: ${lastTrade.status === 'TP_HIT' ? 'WIN ✅' : lastTrade.status === 'SL_HIT' ? 'LOSS ❌' : 'OPEN 🔄'}
Symbol: ${lastTrade.symbol} | Aksi: ${lastTrade.action} | PnL: $${parseFloat(lastTrade.pnl || 0).toFixed(2)}
Entry: ${lastTrade.entry} | Close: ${lastTrade.close_price || 0} | SL: ${lastTrade.sl} | TP: ${lastTrade.tp}

📑 ATURAN REFLEKSI (DILARANG HALUSINASI):
- Lihat HARGA AKTUAL di atas (Entry, Close, SL, TP)
- Jika SL kena → analisis mengapa harga berbalik (bias salah? timing buruk?)
- Jika TP tidak tercapai → apakah TP terlalu ambisius?
- JANGAN salahkan penempatan SL kecuali angka-angka membuktikannya
- Dasarkan refleksi HANYA pada data di atas, bukan imajinasi

Isi field "reflection" dengan analisis faktual singkat dalam Bahasa Indonesia (2-3 kalimat maks).`
    : '🧠 HASIL TRADE TERAKHIR: Tidak ada trade sebelumnya.';

  const marketContextSection = isV75
    ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 KONTEKS MARKET
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ MODE AKTIF: Volatility 75 Index (R_75) — Synthetic Index Deriv
Market XAUUSD sedang TUTUP. DzeckAI beroperasi pada Synthetic Index yang tersedia 24/7.
Synthetic Index TIDAK dipengaruhi oleh berita makro, event ekonomi, atau geopolitik.
Analisis murni TEKNIKAL berdasarkan price action dan struktur candle.`
    : `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 MARKET INTELLIGENCE (MACRO & NEWS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${formatMacroSection(macro)}

🗓 UPCOMING ECONOMIC EVENTS:
${formatEventsSection(getUpcomingEvents())}

📰 RECENT HEADLINES:
${getRecentHeadlines().map(h => `- ${h}`).join('\n')}`;

  return `${marketContextSection}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📂 INSTRUMEN AKTIF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔥 ${cfg.displayName} (${cfg.fullName}) | Current Price: ${currentClose}
${isV75 ? 'Type: Synthetic Index | Volatility: High | Jam: 24/7' : 'Type: Commodity / Forex | XAU/USD Spot'}

💰 PORTOFOLIO SAAT INI:
- Balance: $${balance.toLocaleString('id-ID', { minimumFractionDigits: 2 })}
- Calculated Lot Size (2% risk): ${calculatedLot} lot
- Max Risiko per Trade: $${(balance * 0.02).toFixed(2)}

📊 INDIKATOR TEKNIKAL M5:
${formatIndicatorsTable(indicators)}

📉 M5 TECHNICAL SUMMARY:
${buildTechnicalSummary(m5Candles, 'M5')}

📊 ${cfg.displayName} M5 (20 candles terakhir):

${formatCandleTable(m5Candles.slice(-20))}

📊 ${cfg.displayName} M15 (20 candles terakhir):

${formatCandleTable(m15Candles.slice(-20))}

${lastTradeSection}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INSTRUKSI OUTPUT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Balas dengan HANYA JSON valid — tanpa markdown, tanpa code fence, tanpa prosa:

{"reflection":null,"symbol":"${isV75 ? 'Volatility 75 Index' : 'XAUUSD'}","strategy":"string dalam Bahasa Indonesia","reasoning":"string (profesional Bahasa Indonesia sesuai gaya DzeckAI, WAJIB sebut rasio R:R)","action":"BUY|SELL|HOLD","entry":number,"sl":number,"tp":number,"lot":${calculatedLot},"confidence":number}

Aturan wajib:
- reflection: null jika tidak ada loss pada trade terakhir, atau analisis faktual 2-3 kalimat Bahasa Indonesia jika SL_HIT
- action HOLD: tetap isi entry/sl/tp dengan level yang dipantau sebagai referensi
- confidence: 0.0-1.0 sesuai PEMETAAN KEPERCAYAAN DIRI di atas
- lot: gunakan nilai ${calculatedLot} yang sudah dikalkulasi (maksimum risiko 2% dari balance)
- strategy: WAJIB dalam Bahasa Indonesia (contoh: "Breakout Struktur H1", "Retest EMA50", "Momentum RSI Divergence")
- reasoning: WAJIB menyebut rasio Risk-to-Reward (contoh: "R:R = 1:2.5")
${isV75 ? '- SL/TP: Tentukan level wajar berdasarkan volatilitas V75 (rentang tipikal 50-300 poin dari entry)' : '- SL/TP: Tentukan level wajar berdasarkan volatilitas XAUUSD'}`;
}

export async function runAIDecision(broadcast) {
  console.log('[AI] Starting decision cycle...');

  try {
    const activeData   = getActiveMarketData();
    const activeSymbol = getActiveSymbol();
    const { m5Candles, m15Candles, currentPrice, marketStatus } = activeData;

    if (m5Candles.length < 5) {
      console.log('[AI] Data market belum tersedia — cycle dilewati, menunggu data live.');
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

    // Get current balance for dynamic position sizing
    const portfolioRes = await query(`SELECT pnl FROM trades WHERE status != 'OPEN'`);
    const totalPnl = portfolioRes.rows.reduce((sum, t) => sum + parseFloat(t.pnl || 0), 0);
    const currentBalance = 1000000 + totalPnl;

    // News filter check (only for XAUUSD)
    let newsFilterResult = { blocked: false };
    if (activeSymbol === 'XAUUSD') {
      newsFilterResult = checkNewsFilter();
    }

    // Calculate dynamic lot size (placeholder entry/sl — AI will set actual values,
    // we use a rough estimate for displaying in prompt; actual lot passed to AI as suggestion)
    const roughEntry = currentPrice || parseFloat(m5Candles[m5Candles.length - 1]?.close || 0) || 3000;
    const roughSLDist = activeSymbol === 'V75' ? 100 : 15; // rough pips for sizing hint
    const roughSL = roughEntry - roughSLDist;
    const suggestedLot = calcDynamicLot(currentBalance, roughEntry, roughSL, activeSymbol);

    const prompt = buildPrompt(activeSymbol, m5Candles, m15Candles, macro, lastTrade, currentBalance, suggestedLot);

    if (broadcast) {
      broadcast({ type: 'ai_thinking', data: { status: 'thinking', activeSymbol, marketStatus, timestamp: new Date().toISOString() } });
    }

    // If news filter blocks new trades, we still run AI but will override action
    let parsed = null;
    let attempt = 0;

    while (attempt < 3 && !parsed) {
      attempt++;
      try {
        const response = await cohere.chat({
          model: 'command-r-plus-08-2024',
          message: prompt,
          preamble: SYSTEM_PROMPT,
          temperature: 0.25,
          maxTokens: 1000,
        });

        const responseText = response.text.trim();
        parsed = JSON.parse(responseText);

        const required = ['symbol', 'strategy', 'reasoning', 'action', 'entry', 'sl', 'tp', 'confidence'];
        for (const field of required) {
          if (parsed[field] === undefined) throw new Error(`Missing field: ${field}`);
        }
        if (!['BUY', 'SELL', 'HOLD'].includes(parsed.action)) throw new Error(`Invalid action: ${parsed.action}`);
        // Clamp and validate numeric fields
        parsed.confidence = Math.max(0, Math.min(1, parseFloat(parsed.confidence) || 0.5));
        parsed.entry = parseFloat(parsed.entry) || 0;
        parsed.sl    = parseFloat(parsed.sl)    || 0;
        parsed.tp    = parseFloat(parsed.tp)    || 0;
      } catch (err) {
        console.error(`[AI] Attempt ${attempt} failed: ${err.message}`);
        if (attempt >= 3) throw err;
        parsed = null;
      }
    }

    // Apply news filter override
    if (newsFilterResult.blocked && parsed.action !== 'HOLD') {
      console.log(`[AI] News filter active — overriding ${parsed.action} to HOLD: ${newsFilterResult.eventName}`);
      parsed.action = 'HOLD';
      parsed.reasoning = `Menunggu event ekonomi high-impact: ${newsFilterResult.eventName} (${newsFilterResult.eventDate} ${newsFilterResult.eventTime}). Saya tidak membuka posisi baru dalam window ±30 menit sebelum/sesudah event tersebut. ${parsed.reasoning}`;
    }

    // Dynamic lot: recalculate with AI's actual entry/sl levels and confidence score
    const dynamicLot = parsed.action !== 'HOLD'
      ? calcDynamicLot(currentBalance, parsed.entry, parsed.sl, activeSymbol, parsed.confidence)
      : suggestedLot;
    const lot = dynamicLot;

    let tradeId = null;

    if (parsed.action !== 'HOLD') {
      const openTrades = await query(`SELECT id FROM trades WHERE status = 'OPEN' LIMIT 1`);
      if (openTrades.rows.length === 0) {
        const slDist = Math.abs(parseFloat(parsed.entry) - parseFloat(parsed.sl));
        const tradeRes = await query(
          `INSERT INTO trades (symbol, action, entry, sl, tp, lot, strategy, reflection, original_sl_dist)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
          [parsed.symbol, parsed.action, parsed.entry, parsed.sl, parsed.tp, lot,
           parsed.strategy, parsed.reflection || null, slDist]
        );
        tradeId = tradeRes.rows[0].id;
        console.log(`[AI] New trade: ${parsed.action} ${parsed.symbol} @ ${parsed.entry} lot=${lot} (ID: ${tradeId})`);
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

    return { ...parsed, lot, tradeId, activeSymbol, marketStatus, dataSource: 'deriv', newsFilter: newsFilterResult };
  } catch (err) {
    console.error('[AI] Decision cycle error:', err.message);
    throw err;
  }
}
