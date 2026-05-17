import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { initSchema } from './schema.js';
import routes, { broadcastSSE } from './routes.js';
import { startTradingLoop, setBroadcast } from './tradingLoop.js';
import { connectDeriv, getActiveMarketData, getActiveSymbol, getXAUUSDStatus } from './derivService.js';

const app  = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type'] }));
app.use(express.json());

// ── API routes ──────────────────────────────────────────────────────
app.use('/api', routes);
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// ── Serve built frontend in production ──────────────────────────────
if (isProd) {
  const distDir = path.join(process.cwd(), 'client', 'dist');
  app.use(express.static(distDir));
  // SPA fallback — all non-API routes serve index.html
  app.get('*', (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

// ── WebSocket ────────────────────────────────────────────────────────
const server    = createServer(app);
const wss       = new WebSocketServer({ server, path: '/appws' });
const wsClients = new Set();

wss.on('connection', (ws) => {
  wsClients.add(ws);
  try {
    const data         = getActiveMarketData();
    const activeSymbol = getActiveSymbol();
    const xauusdStatus = getXAUUSDStatus();
    ws.send(JSON.stringify({ type: 'connected', data: { message: 'DzeckAI Trader connected' } }));
    ws.send(JSON.stringify({ type: 'market_status', data: { status: data.marketStatus, isConnected: data.isConnected, currentPrice: data.currentPrice, activeSymbol, xauusdStatus } }));
  } catch {}
  ws.on('close', () => wsClients.delete(ws));
  ws.on('error', () => wsClients.delete(ws));
});

// ── Unified broadcast ────────────────────────────────────────────────
function broadcast(message) {
  broadcastSSE(message.type, message.data);
  const payload = JSON.stringify(message);
  for (const client of [...wsClients]) {
    if (client.readyState === 1) {
      try { client.send(payload); } catch { wsClients.delete(client); }
    }
  }
}

setBroadcast(broadcast);

async function main() {
  try {
    await initSchema();
    console.log('[Server] Database schema ready');
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`[Server] DzeckAI Trader on port ${PORT} (${isProd ? 'production' : 'development'})`);
    });
    connectDeriv();
    setTimeout(() => startTradingLoop(), 5000);
  } catch (err) {
    console.error('[Server] Fatal startup error:', err);
    process.exit(1);
  }
}

main();
