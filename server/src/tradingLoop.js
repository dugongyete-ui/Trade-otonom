import { query } from './db.js';
import { runAIDecision } from './aiEngine.js';
import { getPortfolioStats, savePortfolioSnapshot } from './portfolio.js';
import { simulatePriceMovement, getCurrentPrice } from './marketData.js';
import { getDerivMarketData, getMarketStatus } from './derivService.js';

let broadcast = null;
let loopInterval = null;
let priceInterval = null;

export function setBroadcast(fn) {
  broadcast = fn;
}

async function updateOpenTrades() {
  const openTrades = await query(`SELECT * FROM trades WHERE status = 'OPEN'`);
  for (const trade of openTrades.rows) {
    const currentPx = getCurrentPrice();
    const { status, closePrice } = simulatePriceMovement(
      parseFloat(trade.entry),
      trade.action,
      parseFloat(trade.sl),
      parseFloat(trade.tp),
      currentPx
    );

    let openPnl = 0;
    const lot = parseFloat(trade.lot) || 0.01;
    if (trade.action === 'BUY') {
      openPnl = parseFloat(((currentPx - parseFloat(trade.entry)) * 100 * lot).toFixed(2));
    } else if (trade.action === 'SELL') {
      openPnl = parseFloat(((parseFloat(trade.entry) - currentPx) * 100 * lot).toFixed(2));
    }

    if (status !== 'OPEN') {
      let pnl = 0;
      if (trade.action === 'BUY') {
        pnl = parseFloat(((closePrice - parseFloat(trade.entry)) * 100 * lot).toFixed(2));
      } else {
        pnl = parseFloat(((parseFloat(trade.entry) - closePrice) * 100 * lot).toFixed(2));
      }

      await query(
        `UPDATE trades SET status=$1, close_time=NOW(), close_price=$2, pnl=$3, open_pnl=0 WHERE id=$4`,
        [status, closePrice, pnl, trade.id]
      );

      console.log(`[Loop] Trade ${trade.id} closed: ${status}, PnL: ${pnl}`);

      if (broadcast) {
        broadcast({ type: 'trade_update', data: { tradeId: trade.id, status, closePrice, pnl, action: trade.action, symbol: trade.symbol } });
      }
    } else {
      await query(`UPDATE trades SET open_pnl=$1 WHERE id=$2`, [openPnl, trade.id]);
    }
  }
}

async function runCycle() {
  console.log('[Loop] Starting AI cycle...');
  try {
    await updateOpenTrades();

    const decision = await runAIDecision(broadcast);

    const derivData = getDerivMarketData();
    if (broadcast) {
      broadcast({ type: 'market_status', data: { status: derivData.marketStatus, isConnected: derivData.isConnected, currentPrice: derivData.currentPrice } });
    }

    if (!decision) {
      console.log('[Loop] Cycle skipped — menunggu data Deriv live.');
      return;
    }

    const stats = await getPortfolioStats();
    await savePortfolioSnapshot(stats);

    if (broadcast) {
      broadcast({ type: 'ai_decision', data: decision });
      broadcast({ type: 'portfolio_update', data: stats });
    }

    console.log(`[Loop] Cycle: ${decision.action} @ ${decision.entry} (conf: ${decision.confidence}) [deriv]`);
  } catch (err) {
    console.error('[Loop] Cycle error:', err.message);
    if (broadcast) broadcast({ type: 'error', data: { message: err.message } });
  }
}

export function startTradingLoop() {
  console.log('[Loop] Starting trading loop (30s interval)...');
  runCycle();
  loopInterval = setInterval(runCycle, 30000);

  priceInterval = setInterval(async () => {
    try {
      await updateOpenTrades();
      const stats = await getPortfolioStats();
      const derivData = getDerivMarketData();
      if (broadcast) {
        broadcast({ type: 'portfolio_update', data: stats });
        broadcast({ type: 'market_status', data: { status: derivData.marketStatus, isConnected: derivData.isConnected, currentPrice: derivData.currentPrice } });
      }
    } catch (err) {
      console.error('[Loop] Price update error:', err.message);
    }
  }, 5000);
}

export function stopTradingLoop() {
  if (loopInterval) clearInterval(loopInterval);
  if (priceInterval) clearInterval(priceInterval);
}
