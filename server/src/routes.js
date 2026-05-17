import express from 'express';
import { query } from './db.js';
import { getPortfolioStats } from './portfolio.js';
import { getActiveMarketData, getActiveSymbol, getXAUUSDStatus } from './derivService.js';
import { getIsAIPaused } from './aiState.js';

const router = express.Router();

// ── SSE stream endpoint (/api/stream) ──────────────────────────────
const sseClients = new Set();

export function broadcastSSE(type, data) {
  const line = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of [...sseClients]) {
    try { client.write(line); } catch { sseClients.delete(client); }
  }
}

router.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  sseClients.add(res);
  console.log(`[SSE] Client connected (total: ${sseClients.size})`);

  try {
    const data         = getActiveMarketData();
    const activeSymbol = getActiveSymbol();
    const xauusdStatus = getXAUUSDStatus();
    res.write(`event: market_status\ndata: ${JSON.stringify({
      status: data.marketStatus, isConnected: data.isConnected,
      currentPrice: data.currentPrice, activeSymbol, xauusdStatus,
      aiPaused: getIsAIPaused(),
    })}\n\n`);
  } catch {}

  const ping = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { clearInterval(ping); sseClients.delete(res); }
  }, 15000);

  req.on('close', () => {
    clearInterval(ping);
    sseClients.delete(res);
    console.log(`[SSE] Client disconnected (total: ${sseClients.size})`);
  });
});

router.get('/portfolio', async (req, res) => {
  try { res.json(await getPortfolioStats()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/trades', async (req, res) => {
  try {
    const page   = parseInt(req.query.page)  || 1;
    const limit  = parseInt(req.query.limit) || 15;
    const offset = (page - 1) * limit;
    const symbol = req.query.symbol;

    let symWhere = '';
    if (symbol === 'V75') {
      symWhere = `AND (t.symbol = 'V75' OR t.symbol LIKE '%Volatility%')`;
    } else if (symbol === 'XAUUSD') {
      symWhere = `AND t.symbol = 'XAUUSD'`;
    }

    const result = await query(
      `SELECT t.*, d.reasoning_text AS reasoning, d.confidence
       FROM trades t
       LEFT JOIN ai_decisions d ON d.trade_id = t.id
       WHERE 1=1 ${symWhere}
       ORDER BY t.open_time DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const countRes = await query(`SELECT COUNT(*) FROM trades WHERE 1=1 ${symWhere}`);
    res.json({
      trades: result.rows,
      total: parseInt(countRes.rows[0].count),
      page,
      totalPages: Math.ceil(parseInt(countRes.rows[0].count) / limit),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/current-signal', async (req, res) => {
  try {
    const result = await query(
      `SELECT t.*, d.reasoning_text AS reasoning, d.confidence, d.strategy
       FROM trades t LEFT JOIN ai_decisions d ON d.trade_id = t.id
       WHERE t.status = 'OPEN' ORDER BY t.open_time DESC LIMIT 1`
    );
    if (result.rows.length === 0) {
      const last = await query(`SELECT * FROM ai_decisions ORDER BY timestamp DESC LIMIT 1`);
      if (last.rows.length > 0) {
        const d = last.rows[0];
        return res.json({ hasSignal: false, lastDecision: { action: d.action, symbol: d.symbol, entry: d.entry, sl: d.sl, tp: d.tp, confidence: d.confidence, strategy: d.strategy } });
      }
      return res.json({ hasSignal: false, lastDecision: null });
    }
    const t = result.rows[0];
    res.json({ hasSignal: true, signal: { id: t.id, symbol: t.symbol, action: t.action, entry: t.entry, sl: t.sl, tp: t.tp, lot: t.lot, openTime: t.open_time, openPnl: t.open_pnl, strategy: t.strategy, confidence: t.confidence, reasoning: t.reasoning } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/ai-log', async (req, res) => {
  try {
    const result = await query(
      `SELECT d.id, d.trade_id, d.symbol, d.action, d.entry, d.sl, d.tp,
              d.confidence, d.reasoning_text AS reasoning, d.reflection,
              d.strategy, d.timestamp,
              t.status AS trade_status, t.pnl AS trade_pnl
       FROM ai_decisions d LEFT JOIN trades t ON t.id = d.trade_id
       ORDER BY d.timestamp DESC LIMIT 20`
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/market-status', async (req, res) => {
  try {
    const data         = getActiveMarketData();
    const activeSymbol = getActiveSymbol();
    const xauusdStatus = getXAUUSDStatus();
    res.json({
      status: data.marketStatus,
      isConnected: data.isConnected,
      currentPrice: data.currentPrice,
      activeSymbol,
      xauusdStatus,
      dataSource: 'Deriv WebSocket',
      aiPaused: getIsAIPaused(),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/equity-history', async (req, res) => {
  try {
    const result = await query(`SELECT balance, equity, open_pnl, timestamp FROM portfolio_snapshots ORDER BY timestamp DESC LIMIT 50`);
    res.json(result.rows.reverse());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/ai-stats ─────────────────────────────────────────────
router.get('/ai-stats', async (req, res) => {
  try {
    const symbol = req.query.symbol;
    let symWhere = `WHERE status != 'OPEN'`;
    if (symbol === 'V75') {
      symWhere = `WHERE status != 'OPEN' AND (symbol = 'V75' OR symbol LIKE '%Volatility%')`;
    } else if (symbol === 'XAUUSD') {
      symWhere = `WHERE status != 'OPEN' AND symbol = 'XAUUSD'`;
    }
    const tradesRes = await query(`SELECT * FROM trades ${symWhere} ORDER BY close_time ASC`);
    const trades = tradesRes.rows;

    if (trades.length === 0) {
      return res.json({
        profitFactor: null,
        sharpeRatio: null,
        maxConsecutiveLosses: 0,
        avgTradeDurationMinutes: null,
        totalTrades: 0,
        wins: 0,
        losses: 0,
      });
    }

    const pnls = trades.map(t => parseFloat(t.pnl || 0));
    const wins  = trades.filter(t => t.status === 'TP_HIT');
    const losses = trades.filter(t => t.status === 'SL_HIT');

    const grossProfit = wins.reduce((s, t) => s + parseFloat(t.pnl || 0), 0);
    const grossLoss   = Math.abs(losses.reduce((s, t) => s + parseFloat(t.pnl || 0), 0));
    const profitFactor = grossLoss > 0
      ? parseFloat((grossProfit / grossLoss).toFixed(3))
      : grossProfit > 0 ? 999 : null;

    // Max consecutive losses
    let maxConsecLosses = 0;
    let curConsec = 0;
    for (const t of trades) {
      if (t.status === 'SL_HIT') {
        curConsec++;
        if (curConsec > maxConsecLosses) maxConsecLosses = curConsec;
      } else {
        curConsec = 0;
      }
    }

    // Average trade duration (minutes)
    const durations = trades
      .filter(t => t.open_time && t.close_time)
      .map(t => (new Date(t.close_time) - new Date(t.open_time)) / 60000);
    const avgDuration = durations.length > 0
      ? parseFloat((durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(1))
      : null;

    // Sharpe Ratio approximation: mean(PnL) / std(PnL)
    let sharpeRatio = null;
    if (pnls.length >= 2) {
      const mean = pnls.reduce((a, b) => a + b, 0) / pnls.length;
      const variance = pnls.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / pnls.length;
      const stdDev = Math.sqrt(variance);
      sharpeRatio = stdDev > 0
        ? parseFloat((mean / stdDev).toFixed(3))
        : mean > 0 ? 999 : null;
    }

    res.json({
      profitFactor,
      sharpeRatio,
      maxConsecutiveLosses: maxConsecLosses,
      avgTradeDurationMinutes: avgDuration,
      totalTrades: trades.length,
      wins: wins.length,
      losses: losses.length,
      grossProfit: parseFloat(grossProfit.toFixed(2)),
      grossLoss: parseFloat(grossLoss.toFixed(2)),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/ai-brain ─────────────────────────────────────────────
router.get('/ai-brain', async (req, res) => {
  try {
    const result = await query(`SELECT strategy_doc, updated_at FROM ai_brain ORDER BY id DESC LIMIT 1`);
    if (result.rows.length === 0) {
      return res.json({ brain: null, updatedAt: null });
    }
    res.json({ brain: result.rows[0].strategy_doc, updatedAt: result.rows[0].updated_at });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/strategy-evolution-log ──────────────────────────────
router.get('/strategy-evolution-log', async (req, res) => {
  try {
    const result = await query(
      `SELECT sel.id, sel.trade_id, sel.trade_outcome, sel.change_summary, sel.created_at,
              t.action AS trade_action, t.symbol AS trade_symbol, t.pnl AS trade_pnl
       FROM strategy_evolution_log sel
       LEFT JOIN trades t ON t.id = sel.trade_id
       ORDER BY sel.created_at DESC LIMIT 20`
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/strategy-rules ────────────────────────────────────
router.get('/strategy-rules', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, rule_text, rule_category, times_applied, success_count, fail_count, success_rate,
              first_seen_at, last_updated_at, is_active
       FROM strategy_rules
       ORDER BY times_applied DESC, success_rate DESC
       LIMIT 50`
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
