import { CohereClient } from 'cohere-ai';
import { query } from './db.js';
import { getActiveMarketData, getActiveSymbol, SYMBOL_CONFIG } from './derivService.js';
import { getMacroData, getUpcomingEvents, getRecentHeadlines, formatMacroSection, formatEventsSection } from './macroData.js';

const cohere = new CohereClient({ token: process.env.COHERE_API_KEY });

const SYSTEM_PROMPT = `You are DzeckAi Trader — Senior Hedge Fund Portfolio Manager

PERSONALITY CORE (CONSERVATIVE & CALCULATED):
- Highly Disciplined (Preservation of capital is the #1 priority)
- Analytical & Methodical (Every execution must be backed by institutional-grade logic)
- Pragmatic & Humble (Recognize market unpredictability, quick to cut losses aggressively)
- Patient & Selective (Happy to sit on cash / HOLD if setups do not meet strict criteria)

COMMUNICATION STYLE — PROFESSIONAL INDONESIAN:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PRONOUNS (Consistent):
- Saya (always formal and objective)

TRADING VOCABULARY (Institutional & Professional):
- Entry: "Eksekusi posisi", "Alokasi modal", "Masuk market"
- Exit: "Likuidasi", "Realisasi profit", "Cut loss terukur", "Mitigasi risiko"
- Analysis: "Analisis teknikal", "Struktur harga", "Konfirmasi momentum"
- Risk: "Manajemen risiko ketat", "Drawdown control", "Rasio Risk-Reward"

EXPRESSIONS BY MARKET CONDITION:
- Trending Strong: "Momentum terkonfirmasi, kita ikuti arus institusi"
- Ranging: "Market konsolidasi, hindari overtrading"
- Volatile: "Volatilitas ekstrem, kurangi eksposur (reduce position size)"
- Unclear: "Probabilitas rendah, lebih aman alokasi ke cash (HOLD)"

CONFIDENCE MAPPING (Data-driven):
- 0.8-1.0: "Konfirmasi solid dari berbagai indikator teknikal"
- 0.65-0.79: "Setup rasional dengan Risk/Reward yang memadai"
- 0.5-0.64: "Sinyal lemah, mitigasi risiko diutamakan"
- <0.5: "Kondisi tidak ideal, lindungi modal utama (HOLD)"`;

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

function buildPrompt(symbol, m5Candles, m15Candles, macro, lastTrade) {
  const cfg = SYMBOL_CONFIG[symbol] || SYMBOL_CONFIG.XAUUSD;
  const isV75 = symbol === 'V75';
  const currentClose = m5Candles.length > 0
    ? parseFloat(m5Candles[m5Candles.length - 1].close).toFixed(isV75 ? 3 : 3)
    : 'N/A';

  const lastTradeSection = lastTrade
    ? `🧠 LAST TRADE RESULT: ${lastTrade.status === 'TP_HIT' ? 'WIN ✅' : lastTrade.status === 'SL_HIT' ? 'LOSS ❌' : 'OPEN 🔄'}
Symbol: ${lastTrade.symbol} | Action: ${lastTrade.action} | PnL: $${parseFloat(lastTrade.pnl || 0).toFixed(2)}
Entry: ${lastTrade.entry} | Close: ${lastTrade.close_price || 0} | SL: ${lastTrade.sl} | TP: ${lastTrade.tp}

📑 REFLECTION RULES (DO NOT HALLUCINATE):
- Look at the ACTUAL prices above (Entry, Close, SL, TP)
- If SL was hit → analyze why price reversed (wrong bias? bad timing?)
- If TP wasn't reached → was TP too ambitious?
- DO NOT blame SL placement unless the numbers prove it
- Base your reflection ONLY on the data above, not imagination

Fill "reflection" field with SHORT factual analysis (2-3 sentences max).`
    : '🧠 LAST TRADE RESULT: Tidak ada trade sebelumnya.';

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

📉 M5 TECHNICAL SUMMARY:
${buildTechnicalSummary(m5Candles, 'M5')}

📊 ${cfg.displayName} M5 (Last 10 candles):

${formatCandleTable(m5Candles)}

📊 ${cfg.displayName} M15 (Last 10 candles):

${formatCandleTable(m15Candles)}

${lastTradeSection}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INSTRUKSI OUTPUT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Respond with ONLY valid JSON — no markdown, no code fences, no prose:

{"reflection":null,"symbol":"${isV75 ? 'Volatility 75 Index' : 'XAUUSD'}","strategy":"string","reasoning":"string (professional Indonesian per DzeckAi style)","action":"BUY|SELL|HOLD","entry":number,"sl":number,"tp":number,"lot":0.01,"confidence":number}

Rules:
- reflection: null if no loss on last trade, or 2-3 sentence factual Indonesian analysis if SL_HIT
- action HOLD: still fill entry/sl/tp with monitored levels
- confidence: 0.0-1.0 per the CONFIDENCE MAPPING above
- lot: always 0.01 (fixed for risk management)
${isV75 ? '- SL/TP: Set reasonable levels based on V75 volatility (typical range 50-300 points from entry)' : '- SL/TP: Set reasonable levels based on XAUUSD volatility'}`;
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

    const prompt = buildPrompt(activeSymbol, m5Candles, m15Candles, macro, lastTrade);

    if (broadcast) {
      broadcast({ type: 'ai_thinking', data: { status: 'thinking', activeSymbol, marketStatus, timestamp: new Date().toISOString() } });
    }

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
          maxTokens: 900,
        });

        const responseText = response.text.trim();
        parsed = JSON.parse(responseText);

        const required = ['symbol', 'strategy', 'reasoning', 'action', 'entry', 'sl', 'tp', 'confidence'];
        for (const field of required) {
          if (parsed[field] === undefined) throw new Error(`Missing field: ${field}`);
        }
        if (!['BUY', 'SELL', 'HOLD'].includes(parsed.action)) throw new Error(`Invalid action: ${parsed.action}`);
      } catch (err) {
        console.error(`[AI] Attempt ${attempt} failed: ${err.message}`);
        if (attempt >= 3) throw err;
        parsed = null;
      }
    }

    const lot = parseFloat(parsed.lot) || 0.01;
    let tradeId = null;

    if (parsed.action !== 'HOLD') {
      const openTrades = await query(`SELECT id FROM trades WHERE status = 'OPEN' LIMIT 1`);
      if (openTrades.rows.length === 0) {
        const tradeRes = await query(
          `INSERT INTO trades (symbol, action, entry, sl, tp, lot, strategy, reflection)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
          [parsed.symbol, parsed.action, parsed.entry, parsed.sl, parsed.tp, lot,
           parsed.strategy, parsed.reflection || null]
        );
        tradeId = tradeRes.rows[0].id;
        console.log(`[AI] New trade: ${parsed.action} ${parsed.symbol} @ ${parsed.entry} (ID: ${tradeId})`);
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

    return { ...parsed, lot, tradeId, activeSymbol, marketStatus, dataSource: 'deriv' };
  } catch (err) {
    console.error('[AI] Decision cycle error:', err.message);
    throw err;
  }
}
