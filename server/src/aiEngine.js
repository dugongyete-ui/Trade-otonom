import { CohereClient } from 'cohere-ai';
import { query } from './db.js';
import { getDerivMarketData, getMarketStatus } from './derivService.js';
import { generateM5Candles, generateM15Candles } from './marketData.js';
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
  if (!candles || candles.length === 0) return '(Tidak ada data candle)';
  const header = 'Time   | Open   | High   | Low    | Close  |';
  const divider = '------------------------------------------------';
  const rows = candles.map(c => {
    const time = c.time
      ? new Date(c.time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
      : '00:00';
    const fmt = (n) => parseFloat(n).toFixed(2).padStart(7);
    return `${time}  | ${fmt(c.open)}| ${fmt(c.high)}| ${fmt(c.low)}| ${fmt(c.close)}|`;
  });
  return [header, divider, ...rows].join('\n');
}

function buildTechnicalSummary(candles, label) {
  if (!candles || candles.length === 0) return `${label}: No data available.`;
  const closes = candles.map(c => parseFloat(c.close));
  const highs = candles.map(c => parseFloat(c.high));
  const lows = candles.map(c => parseFloat(c.low));
  const support = Math.min(...lows).toFixed(2);
  const resistance = Math.max(...highs).toFixed(2);
  const current = closes[closes.length - 1].toFixed(3);
  const trend = closes[closes.length - 1] > closes[0] ? 'BULLISH' : 'BEARISH';
  const rangePips = ((Math.max(...highs) - Math.min(...lows)) * 10).toFixed(1);

  return `- Support Level: ${support}
- Resistance Level: ${resistance}
- Current Close: ${current}
- Short-term Trend: ${trend}
- Range: ${rangePips} pips`;
}

function buildPrompt(m5Candles, m15Candles, macro, lastTrade, marketStatus) {
  const currentClose = m5Candles.length > 0
    ? parseFloat(m5Candles[m5Candles.length - 1].close).toFixed(3)
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
    : '🧠 LAST TRADE RESULT: No previous trade on record.';

  const marketStatusNote = marketStatus === 'closed'
    ? '\n⚠️ CATATAN: Market XAUUSD sedang TUTUP (akhir pekan/libur). Analisis berdasarkan data historis terakhir.'
    : '';

  const events = getUpcomingEvents();
  const headlines = getRecentHeadlines();

  return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 MARKET INTELLIGENCE (MACRO & NEWS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${marketStatusNote}

${formatMacroSection(macro)}

🗓 UPCOMING ECONOMIC EVENTS:
${formatEventsSection(events)}

📰 RECENT HEADLINES:
${headlines.map(h => `- ${h}`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📂 ASSET MENU (CHOOSE 1 TO TRADE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔥 OPTION: XAUUSD | Current Price: ${currentClose}

📉 M5 TECHNICAL SUMMARY:
${buildTechnicalSummary(m5Candles, 'M5')}

📊 XAUUSD M5 (Last 10 candles):

${formatCandleTable(m5Candles)}

📊 XAUUSD M15 (Last 10 candles):

${formatCandleTable(m15Candles)}

${lastTradeSection}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INSTRUKSI OUTPUT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Respond with ONLY valid JSON — no markdown, no code fences, no prose:

{"reflection":null,"symbol":"XAUUSD","strategy":"string","reasoning":"string (professional Indonesian per DzeckAi style)","action":"BUY|SELL|HOLD","entry":number,"sl":number,"tp":number,"lot":0.01,"confidence":number}

Rules:
- reflection: null if no loss on last trade, or 2-3 sentence factual Indonesian analysis if SL_HIT
- action HOLD: still fill entry/sl/tp with monitored levels
- confidence: 0.0-1.0 per the CONFIDENCE MAPPING above
- If market is closed, action MUST be HOLD with confidence < 0.5
- lot: always 0.01 (fixed for risk management)`;
}

export async function runAIDecision(broadcast) {
  console.log('[AI] Starting decision cycle...');

  try {
    const derivData = getDerivMarketData();
    const marketStatusNow = getMarketStatus();

    let m5, m15;

    if (derivData.m5Candles.length >= 5) {
      m5 = derivData.m5Candles;
      m15 = derivData.m15Candles.length >= 3 ? derivData.m15Candles : generateM15Candles(10);
    } else {
      console.log('[AI] Using simulated candles (Deriv data unavailable)');
      m5 = generateM5Candles(10);
      m15 = generateM15Candles(10);
    }

    const currentGoldPrice = derivData.currentPrice || parseFloat(m5[m5.length - 1]?.close || 0);
    const macro = getMacroData(currentGoldPrice);

    await query(
      `INSERT INTO market_snapshots (symbol, timeframe, candle_data, macro_data) VALUES ($1, $2, $3, $4)`,
      ['XAUUSD', 'M5+M15', JSON.stringify({ m5, m15 }), JSON.stringify(macro)]
    );

    const recentTradesRes = await query(
      `SELECT * FROM trades ORDER BY open_time DESC LIMIT 5`
    );
    const recentTrades = recentTradesRes.rows;
    const lastTrade = recentTrades[0] || null;

    const prompt = buildPrompt(m5, m15, macro, lastTrade, marketStatusNow);

    if (broadcast) {
      broadcast({
        type: 'ai_thinking',
        data: { status: 'thinking', marketStatus: marketStatusNow, timestamp: new Date().toISOString() }
      });
    }

    let responseText = '';
    let attempt = 0;
    let parsed = null;

    while (attempt < 3 && !parsed) {
      attempt++;
      try {
        const response = await cohere.chat({
          model: 'command-r-plus-08-2024',
          message: prompt,
          preamble: SYSTEM_PROMPT,
          temperature: 0.25,
          maxTokens: 900
        });

        responseText = response.text.trim();

        parsed = JSON.parse(responseText);

        const required = ['symbol', 'strategy', 'reasoning', 'action', 'entry', 'sl', 'tp', 'confidence'];
        for (const field of required) {
          if (parsed[field] === undefined) throw new Error(`Missing field: ${field}`);
        }
        if (!['BUY', 'SELL', 'HOLD'].includes(parsed.action)) {
          throw new Error(`Invalid action: ${parsed.action}`);
        }
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
      `INSERT INTO ai_decisions
         (trade_id, symbol, action, entry, sl, tp, confidence, reasoning_text, reflection, strategy)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [tradeId, parsed.symbol, parsed.action, parsed.entry, parsed.sl, parsed.tp,
       parsed.confidence, parsed.reasoning, parsed.reflection || null, parsed.strategy]
    );

    return {
      ...parsed,
      lot,
      tradeId,
      marketStatus: marketStatusNow,
      dataSource: derivData.m5Candles.length >= 5 ? 'deriv' : 'simulated'
    };
  } catch (err) {
    console.error('[AI] Decision cycle error:', err.message);
    throw err;
  }
}
