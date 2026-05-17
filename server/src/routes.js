import express from 'express';
import { query } from './db.js';
import { getPortfolioStats } from './portfolio.js';
import { getActiveMarketData, getActiveSymbol, getXAUUSDStatus } from './derivService.js';

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

  // Send initial market status immediately
  try {
    const data         = getActiveMarketData();
    const activeSymbol = getActiveSymbol();
    const xauusdStatus = getXAUUSDStatus();
    res.write(`event: market_status\ndata: ${JSON.stringify({
      status: data.marketStatus, isConnected: data.isConnected,
      currentPrice: data.currentPrice, activeSymbol, xauusdStatus,
    })}\n\n`);
  } catch {}

  // Keepalive ping every 15s to prevent proxy timeouts
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
    const result = await query(
      `SELECT t.*, d.reasoning_text AS reasoning, d.confidence
       FROM trades t
       LEFT JOIN ai_decisions d ON d.trade_id = t.id
       ORDER BY t.open_time DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const countRes = await query(`SELECT COUNT(*) FROM trades`);
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
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/equity-history', async (req, res) => {
  try {
    const result = await query(`SELECT balance, equity, open_pnl, timestamp FROM portfolio_snapshots ORDER BY timestamp DESC LIMIT 50`);
    res.json(result.rows.reverse());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
