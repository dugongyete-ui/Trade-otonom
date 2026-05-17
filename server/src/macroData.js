const BASE_MACRO = {
  DXY: { value: 98.462, change: -0.02 },
  SPX: { value: 7444.25, change: 0.58 },
  VIX: { value: 17.87, change: -0.67 },
  OIL_WTI: { value: 101.54, change: 0.51 },
  US10Y: { value: 4.481, change: 0.4 },
  TIPS_ETF: { value: 111.12, change: 0.0 },
  JGB_10Y_FUT: { value: 0, change: 0 },
  IRON_ORE: { value: 111.28, change: 0.15 },
  GOLD_FUT: { value: 0, change: 0.28 },
  REAL_YIELD_SITUATION: 'EASING',
  SPX_CHANGE_PCT: 0.58
};

const UPCOMING_EVENTS = [
  { day: 'Mon', date: 'May 19', time: '8:30am', currency: 'CNY', event: 'CPI y/y', impact: 'Medium' },
  { day: 'Mon', date: 'May 19', time: '', currency: 'CNY', event: 'PPI y/y', impact: 'Medium' },
  { day: 'Tue', date: 'May 20', time: '7:30pm', currency: 'USD', event: 'Core CPI m/m', impact: 'High' },
  { day: 'Tue', date: 'May 20', time: '', currency: 'USD', event: 'Fed Minutes', impact: 'High' },
  { day: 'Wed', date: 'May 21', time: '7:30pm', currency: 'USD', event: 'Retail Sales m/m', impact: 'High' }
];

const HEADLINES = [
  'Fed Officials Signal Caution Over Rate Cut Timeline Amid Sticky Inflation (GLOBAL)',
  'Gold Surges as Dollar Weakens on Mixed US Jobs Data (MARKETS)',
  'BOJ Board Maintains Ultra-Loose Policy Amid Rising Wage Pressures (ASIA)',
  'OPEC+ Considers Further Output Cuts to Support Oil Prices (ENERGY)',
  'US-China Trade Tensions Ease Slightly After High-Level Talks (GEOPOLITICS)'
];

function jitter(base, pct = 0.002) {
  return parseFloat((base * (1 + (Math.random() - 0.5) * pct)).toFixed(3));
}

export function getMacroData(goldPrice = null) {
  const macro = { ...BASE_MACRO };

  macro.DXY.value = jitter(macro.DXY.value, 0.001);
  macro.VIX.value = jitter(macro.VIX.value, 0.01);
  macro.US10Y.value = jitter(macro.US10Y.value, 0.005);
  macro.SPX.value = jitter(macro.SPX.value, 0.002);
  macro.OIL_WTI.value = jitter(macro.OIL_WTI.value, 0.005);

  if (goldPrice) {
    macro.GOLD_FUT.value = parseFloat(goldPrice.toFixed(3));
  } else {
    macro.GOLD_FUT.value = jitter(4710.7, 0.003);
  }

  const dxyChange = ((macro.DXY.value - 98.462) / 98.462 * 100).toFixed(2);
  macro.DXY.change = parseFloat(dxyChange);

  macro.REAL_YIELD_SITUATION = macro.US10Y.value > 4.5 ? 'TIGHTENING' : 'EASING';
  macro.SPX_CHANGE_PCT = parseFloat(macro.SPX.change.toFixed(2));

  return macro;
}

export function getUpcomingEvents() {
  return UPCOMING_EVENTS;
}

export function getRecentHeadlines() {
  return HEADLINES;
}

export function formatMacroSection(macro) {
  return `📈 MACRO INTERNALS:
- DXY: ${macro.DXY.value} (${macro.DXY.change > 0 ? '+' : ''}${macro.DXY.change}%)
- SPX: ${macro.SPX.value} (${macro.SPX.change > 0 ? '+' : ''}${macro.SPX.change}%)
- VIX: ${macro.VIX.value} (${macro.VIX.change > 0 ? '+' : ''}${macro.VIX.change}%)
- OIL_WTI: ${macro.OIL_WTI.value} (${macro.OIL_WTI.change > 0 ? '+' : ''}${macro.OIL_WTI.change}%)
- US10Y: ${macro.US10Y.value} (${macro.US10Y.change > 0 ? '+' : ''}${macro.US10Y.change}%)
- TIPS_ETF: ${macro.TIPS_ETF.value} (${macro.TIPS_ETF.change}%)
- JGB_10Y_FUT: ${macro.JGB_10Y_FUT.value} (${macro.JGB_10Y_FUT.change}%)
- IRON_ORE: ${macro.IRON_ORE.value} (${macro.IRON_ORE.change}%)
- GOLD_FUT: ${macro.GOLD_FUT.value} (${macro.GOLD_FUT.change}%)
- REAL_YIELD_SITUATION: ${macro.REAL_YIELD_SITUATION}
- SPX_CHANGE_PCT: ${macro.SPX_CHANGE_PCT}`;
}

export function formatEventsSection(events) {
  return events.map(e =>
    `- ${e.day} ${e.date}${e.time ? ' ' + e.time : ''} | ${e.currency} | ${e.event} (${e.impact} Impact Expected)`
  ).join('\n');
}
