import { query } from './db.js';

const INITIAL_BALANCE = 1000000;

export async function getPortfolioStats() {
  const tradesRes = await query(`SELECT * FROM trades ORDER BY open_time DESC`);
  const trades = tradesRes.rows;

  const closedTrades = trades.filter(t => t.status !== 'OPEN');
  const openTrades = trades.filter(t => t.status === 'OPEN');

  const totalPnl = closedTrades.reduce((sum, t) => sum + parseFloat(t.pnl || 0), 0);
  const balance = parseFloat((INITIAL_BALANCE + totalPnl).toFixed(2));

  const openPnl = openTrades.reduce((sum, t) => sum + parseFloat(t.open_pnl || 0), 0);
  const equity = parseFloat((balance + openPnl).toFixed(2));

  const wins = closedTrades.filter(t => t.status === 'TP_HIT').length;
  const winRate = closedTrades.length > 0 ? parseFloat((wins / closedTrades.length).toFixed(4)) : 0;

  let peak = INITIAL_BALANCE;
  let maxDrawdown = 0;
  let running = INITIAL_BALANCE;
  for (const t of [...closedTrades].reverse()) {
    running += parseFloat(t.pnl || 0);
    if (running > peak) peak = running;
    const dd = peak > 0 ? (peak - running) / peak : 0;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  const equityHistory = await buildEquityHistory(closedTrades);

  return {
    balance,
    equity,
    openPnl: parseFloat(openPnl.toFixed(2)),
    winRate,
    maxDrawdown: parseFloat(maxDrawdown.toFixed(4)),
    totalTrades: closedTrades.length,
    openTrades: openTrades.length,
    equityHistory
  };
}

async function buildEquityHistory(closedTrades) {
  const history = [{ time: 'Start', value: INITIAL_BALANCE }];
  let running = INITIAL_BALANCE;
  const sorted = [...closedTrades].reverse();
  for (const t of sorted) {
    running += parseFloat(t.pnl || 0);
    history.push({
      time: new Date(t.close_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      value: parseFloat(running.toFixed(2))
    });
  }
  if (history.length < 2) {
    history.push({ time: 'Now', value: running });
  }
  return history;
}

export async function savePortfolioSnapshot(stats) {
  await query(
    `INSERT INTO portfolio_snapshots (balance, equity, open_pnl, win_rate, drawdown, total_trades) VALUES ($1, $2, $3, $4, $5, $6)`,
    [stats.balance, stats.equity, stats.openPnl, stats.winRate, stats.maxDrawdown, stats.totalTrades]
  );
}
