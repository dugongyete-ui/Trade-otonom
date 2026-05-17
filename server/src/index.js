import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { initSchema } from './schema.js';
import routes from './routes.js';
import { startTradingLoop, setBroadcast } from './tradingLoop.js';
import { connectDeriv } from './derivService.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type'] }));
app.use(express.json());
app.use('/api', routes);
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`[WS] Client connected (total: ${clients.size})`);
  ws.send(JSON.stringify({ type: 'connected', data: { message: 'DzeckAI Trader connected', time: new Date().toISOString() } }));
  ws.on('close', () => { clients.delete(ws); console.log(`[WS] Client disconnected (total: ${clients.size})`); });
  ws.on('error', () => clients.delete(ws));
});

function broadcast(message) {
  const payload = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === 1) {
      try { client.send(payload); } catch { clients.delete(client); }
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

    setTimeout(() => {
      startTradingLoop();
    }, 5000);
  } catch (err) {
    console.error('[Server] Fatal startup error:', err);
    process.exit(1);
  }
}

main();
