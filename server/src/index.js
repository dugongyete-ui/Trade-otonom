import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { initSchema } from './schema.js';
import routes, { broadcastSSE } from './routes.js';
import { startTradingLoop, setBroadcast } from './tradingLoop.js';
import { connectDeriv, getActiveMarketData, getActiveSymbol, getXAUUSDStatus } from './derivService.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type'] }));
app.use(express.json());
app.use('/api', routes);
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// ── WebSocket (secondary, kept for potential direct-connect scenarios) ──
const server = createServer(app);
const wss    = new WebSocketServer({ server, path: '/appws' });
const wsClients = new Set();

wss.on('connection', (ws) => {
  wsClients.add(ws);
  console.log(`[WS] Client connected (total: ${wsClients.size})`);
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

// ── Unified broadcast: SSE (primary) + WS (secondary) ──
function broadcast(message) {
  // SSE — reliable through Vite/Replit HTTP proxy
  broadcastSSE(message.type, message.data);

  // WS — direct WebSocket (works if proxy properly forwards upgrades)
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
      console.log(`[Server] DzeckAI Trader API on port ${PORT}`);
    });
    connectDeriv();
    setTimeout(() => startTradingLoop(), 5000);
  } catch (err) {
    console.error('[Server] Fatal startup error:', err);
    process.exit(1);
  }
}

main();
