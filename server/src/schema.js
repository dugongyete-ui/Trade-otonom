import { query } from './db.js';

export async function initSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS trades (
      id SERIAL PRIMARY KEY,
      symbol VARCHAR(20) NOT NULL DEFAULT 'XAUUSD',
      action VARCHAR(10) NOT NULL,
      entry DECIMAL(12, 5) NOT NULL,
      sl DECIMAL(12, 5) NOT NULL,
      tp DECIMAL(12, 5) NOT NULL,
      lot DECIMAL(6, 2) NOT NULL DEFAULT 0.01,
      open_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      close_time TIMESTAMPTZ,
      close_price DECIMAL(12, 5),
      pnl DECIMAL(12, 2),
      open_pnl DECIMAL(12, 2) DEFAULT 0,
      status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
      reflection TEXT,
      strategy TEXT
    )
  `);
  await query(`ALTER TABLE trades ADD COLUMN IF NOT EXISTS open_pnl DECIMAL(12, 2) DEFAULT 0`);
  await query(`ALTER TABLE trades ADD COLUMN IF NOT EXISTS original_sl_dist DECIMAL(12, 5)`);

  await query(`
    CREATE TABLE IF NOT EXISTS market_snapshots (
      id SERIAL PRIMARY KEY,
      symbol VARCHAR(20) NOT NULL DEFAULT 'XAUUSD',
      timeframe VARCHAR(10) NOT NULL,
      candle_data JSONB NOT NULL,
      macro_data JSONB,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS ai_decisions (
      id SERIAL PRIMARY KEY,
      trade_id INTEGER REFERENCES trades(id),
      symbol VARCHAR(20) NOT NULL DEFAULT 'XAUUSD',
      action VARCHAR(10) NOT NULL,
      entry DECIMAL(12, 5),
      sl DECIMAL(12, 5),
      tp DECIMAL(12, 5),
      confidence DECIMAL(4, 3),
      reasoning_text TEXT NOT NULL,
      reflection TEXT,
      strategy TEXT,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS portfolio_snapshots (
      id SERIAL PRIMARY KEY,
      balance DECIMAL(12, 2) NOT NULL,
      equity DECIMAL(12, 2) NOT NULL,
      open_pnl DECIMAL(12, 2) NOT NULL DEFAULT 0,
      win_rate DECIMAL(5, 4) NOT NULL DEFAULT 0,
      drawdown DECIMAL(5, 4) NOT NULL DEFAULT 0,
      total_trades INTEGER NOT NULL DEFAULT 0,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  console.log('[DB] Schema initialized');
}
