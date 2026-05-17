import { query } from './db.js';
import { runAIDecision } from './aiEngine.js';
import { getPortfolioStats, savePortfolioSnapshot } from './portfolio.js';
import { getActiveMarketData, getActiveSymbol, getPipMultiplier, getCurrentDerivPrice } from './derivService.js';

let broadcast    = null;
let loopInterval = null;
let priceInterval = null;

export function setBroadcast(fn) { broadcast = fn; }

function getPriceForSymbol(tradeSymbol) {
  const active = getActiveMarketData();
  // Use active price regardless of symbol (best available)
  return active.currentPrice || getCurrentDerivPrice() || null;
}

async function updateOpenTrades() {
  const openTrades = await query(`SELECT * FROM trades WHERE status = 'OPEN'`);
  for (const trade of openTrades.rows) {
    const currentPx = getPriceForSymbol(trade.symbol);
    if (!currentPx) continue;

    // Determine pip multiplier based on trade's symbol
    const sym = trade.symbol?.includes('Volatility') || trade.symbol === 'V75' ? 'V75' : 'XAUUSD';
    const pipMult = getPipMultiplier(sym);
    const lot     = parseFloat(trade.lot) || 0.01;

    const entry = parseFloat(trade.entry);
    const sl    = parseFloat(trade.sl);
    const tp    = parseFloat(trade.tp);

    // Check TP/SL hit
    let status     = 'OPEN';
    let closePrice = null;

    if (trade.action === 'BUY') {
      if (currentPx >= tp) { status = 'TP_HIT'; closePrice = tp; }
      else if (currentPx <= sl) { status = 'SL_HIT'; closePrice = sl; }
    } else if (trade.action === 'SELL') {
      if (currentPx <= tp) { status = 'TP_HIT'; closePrice = tp; }
      else if (currentPx >= sl) { status = 'SL_HIT'; closePrice = sl; }
    }

    // Open PnL
    let openPnl = 0;
    if (trade.action === 'BUY')  openPnl = parseFloat(((currentPx - entry) * pipMult * lot).toFixed(2));
    else if (trade.action === 'SELL') openPnl = parseFloat(((entry - currentPx) * pipMult * lot).toFixed(2));

    if (status !== 'OPEN') {
      const pnl = trade.action === 'BUY'
        ? parseFloat(((closePrice - entry) * pipMult * lot).toFixed(2))
        : parseFloat(((entry - closePrice) * pipMult * lot).toFixed(2));

      await query(
        `UPDATE trades SET status=$1, close_time=NOW(), close_price=$2, pnl=$3, open_pnl=0 WHERE id=$4`,
        [status, closePrice, pnl, trade.id]
      );
      console.log(`[Loop] Trade ${trade.id} (${trade.symbol}) closed: ${status}, PnL: $${pnl}`);

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

    const decision   = await runAIDecision(broadcast);
    const activeData = getActiveMarketData();
    const activeSymbol = getActiveSymbol();

    if (broadcast) {
      broadcast({
        type: 'market_status',
        data: {
          status: activeData.marketStatus,
          isConnected: activeData.isConnected,
          currentPrice: activeData.currentPrice,
          activeSymbol,
          xauusdStatus: activeData.xauusdStatus,
        },
      });
    }

    if (!decision) {
      console.log('[Loop] Cycle skipped — menunggu data live.');
      return;
    }

    const stats = await getPortfolioStats();
    await savePortfolioSnapshot(stats);

    if (broadcast) {
      broadcast({ type: 'ai_decision', data: decision });
      broadcast({ type: 'portfolio_update', data: stats });
    }

    console.log(`[Loop] Cycle: ${decision.action} ${activeSymbol} @ ${decision.entry} (conf: ${decision.confidence})`);
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
      const stats      = await getPortfolioStats();
      const activeData = getActiveMarketData();
      const activeSymbol = getActiveSymbol();
      if (broadcast) {
        broadcast({ type: 'portfolio_update', data: stats });
        broadcast({
          type: 'market_status',
          data: {
            status: activeData.marketStatus,
            isConnected: activeData.isConnected,
            currentPrice: activeData.currentPrice,
            activeSymbol,
            xauusdStatus: activeData.xauusdStatus,
          },
        });
      }
    } catch (err) {
      console.error('[Loop] Price update error:', err.message);
    }
  }, 5000);
}

export function stopTradingLoop() {
  if (loopInterval)  clearInterval(loopInterval);
  if (priceInterval) clearInterval(priceInterval);
}
