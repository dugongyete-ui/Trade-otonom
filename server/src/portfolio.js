import { query } from './db.js';

const INITIAL_BALANCE = 1000000;

// Session definitions in WIB (UTC+7)
// Asia:   00:00 - 07:59 WIB  → UTC 17:00 - 00:59
// London: 14:00 - 19:59 WIB  → UTC 07:00 - 12:59
// NY:     20:00 - 01:59 WIB  → UTC 13:00 - 18:59
// Off:    all other hours

function getSessionName(closeTime) {
  if (!closeTime) return 'Off-hours';
  const d = new Date(closeTime);
  const utcHour = d.getUTCHours();
  const wibHour = (utcHour + 7) % 24;

  // NY takes priority over Asia for the 00:00-01:59 overlap
  if (wibHour >= 20 || wibHour < 2) return 'NewYork';  // 20:00-01:59 WIB
  if (wibHour >= 0 && wibHour < 8) return 'Asia';       // 02:00-07:59 WIB (after NY ends)
  if (wibHour >= 14 && wibHour < 20) return 'London';   // 14:00-19:59 WIB
  return 'Off-hours';
}

export function getSessionStats(closedTrades) {
  const sessions = {
    Asia:     { trades: 0, wins: 0, losses: 0, pnl: 0 },
    London:   { trades: 0, wins: 0, losses: 0, pnl: 0 },
    NewYork:  { trades: 0, wins: 0, losses: 0, pnl: 0 },
    'Off-hours': { trades: 0, wins: 0, losses: 0, pnl: 0 },
  };

  for (const t of closedTrades) {
    const session = getSessionName(t.close_time);
    if (!sessions[session]) continue;
    sessions[session].trades++;
    sessions[session].pnl += parseFloat(t.pnl || 0);
    if (t.status === 'TP_HIT') sessions[session].wins++;
    else sessions[session].losses++;
  }

  // Round PnL values
  for (const s of Object.keys(sessions)) {
    sessions[s].pnl = parseFloat(sessions[s].pnl.toFixed(2));
    sessions[s].winRate = sessions[s].trades > 0
      ? parseFloat((sessions[s].wins / sessions[s].trades).toFixed(4))
      : 0;
  }

  return sessions;
}

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
  const sessionStats  = getSessionStats(closedTrades);

  return {
    balance,
    equity,
    openPnl: parseFloat(openPnl.toFixed(2)),
    winRate,
    maxDrawdown: parseFloat(maxDrawdown.toFixed(4)),
    totalTrades: closedTrades.length,
    openTrades: openTrades.length,
    equityHistory,
    sessionStats,
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
