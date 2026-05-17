import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, CrosshairMode, LineStyle, CandlestickSeries, LineSeries } from 'lightweight-charts';
import type { Signal } from '../types';
import { L } from '../lib/labels';

interface Props {
  currentPrice: number | null;
  activeSymbol?: 'XAUUSD' | 'V75';
  signal?: Signal;
}

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

const CANDLE_MS = 60_000;

export function PriceChart({ currentPrice, activeSymbol = 'XAUUSD', signal }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const candleSeriesRef = useRef<ReturnType<ReturnType<typeof createChart>['addSeries']> | null>(null);
  const entryLineRef = useRef<ReturnType<ReturnType<typeof createChart>['addSeries']> | null>(null);
  const tpLineRef = useRef<ReturnType<ReturnType<typeof createChart>['addSeries']> | null>(null);
  const slLineRef = useRef<ReturnType<ReturnType<typeof createChart>['addSeries']> | null>(null);
  const candlesRef = useRef<Candle[]>([]);
  const lastPriceRef = useRef<number | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#2E3F55',
      },
      grid: {
        vertLines: { color: '#131d30' },
        horzLines: { color: '#131d30' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: {
        borderColor: '#131d30',
        textColor: '#6B7E99',
      } as Parameters<typeof createChart>[1]['rightPriceScale'],
      timeScale: {
        borderColor: '#131d30',
        textColor: '#6B7E99',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: true,
      handleScale: true,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#00D68F',
      downColor: '#F5365C',
      borderUpColor: '#00D68F',
      borderDownColor: '#F5365C',
      wickUpColor: '#00D68F',
      wickDownColor: '#F5365C',
    });

    const entryLine = chart.addSeries(LineSeries, {
      color: '#3B82F6',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      lastValueVisible: true,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    } as Parameters<ReturnType<typeof createChart>['addSeries']>[1]);

    const tpLine = chart.addSeries(LineSeries, {
      color: '#00D68F',
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      lastValueVisible: true,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    } as Parameters<ReturnType<typeof createChart>['addSeries']>[1]);

    const slLine = chart.addSeries(LineSeries, {
      color: '#F5365C',
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      lastValueVisible: true,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    } as Parameters<ReturnType<typeof createChart>['addSeries']>[1]);

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    entryLineRef.current = entryLine;
    tpLineRef.current = tpLine;
    slLineRef.current = slLine;

    const setSize = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        if (w > 0 && h > 0) {
          chart.applyOptions({ width: w, height: h });
        }
      }
    };
    setSize();
    const ro = new ResizeObserver(setSize);
    ro.observe(containerRef.current);
    setIsReady(true);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      entryLineRef.current = null;
      tpLineRef.current = null;
      slLineRef.current = null;
    };
  }, []);

  // Reset candle buffer when symbol changes to avoid cross-instrument bleed
  useEffect(() => {
    candlesRef.current = [];
    lastPriceRef.current = null;
    if (candleSeriesRef.current) {
      try { candleSeriesRef.current.setData([]); } catch (e) { console.warn('[PriceChart] reset candle series:', e); }
    }
    if (entryLineRef.current) { try { entryLineRef.current.setData([]); } catch (e) { console.warn('[PriceChart] reset entry line:', e); } }
    if (tpLineRef.current)    { try { tpLineRef.current.setData([]);    } catch (e) { console.warn('[PriceChart] reset tp line:', e);    } }
    if (slLineRef.current)    { try { slLineRef.current.setData([]);    } catch (e) { console.warn('[PriceChart] reset sl line:', e);    } }
  }, [activeSymbol]);

  useEffect(() => {
    if (!currentPrice || !candleSeriesRef.current || !isReady) return;
    const now = Date.now();
    const candleTime = Math.floor(now / CANDLE_MS) * CANDLE_MS / 1000;
    const candles = candlesRef.current;

    if (candles.length === 0) {
      candles.push({ time: candleTime, open: currentPrice, high: currentPrice, low: currentPrice, close: currentPrice });
    } else {
      const last = candles[candles.length - 1];
      if (last.time === candleTime) {
        last.close = currentPrice;
        last.high = Math.max(last.high, currentPrice);
        last.low = Math.min(last.low, currentPrice);
        candles[candles.length - 1] = { ...last };
      } else {
        candles.push({ time: candleTime, open: lastPriceRef.current ?? currentPrice, high: currentPrice, low: currentPrice, close: currentPrice });
      }
    }
    lastPriceRef.current = currentPrice;

    try {
      candleSeriesRef.current.setData(candles as Parameters<typeof candleSeriesRef.current.setData>[0]);
      chartRef.current?.timeScale().scrollToRealTime();
    } catch (e) { console.warn('[PriceChart] setData error:', e); }
  }, [currentPrice, isReady]);

  function drawSignalLines() {
    if (!isReady || !entryLineRef.current || !tpLineRef.current || !slLineRef.current) return;
    const activeSignal = signal?.hasSignal ? signal.signal : null;
    const candles = candlesRef.current;

    if (activeSignal && candles.length > 0) {
      const t1 = candles[0].time;
      const t2 = candles[candles.length - 1].time + 600;
      const e = Number(activeSignal.entry);
      const tp = Number(activeSignal.tp);
      const sl = Number(activeSignal.sl);
      try {
        entryLineRef.current.setData([{ time: t1, value: e }, { time: t2, value: e }] as Parameters<typeof entryLineRef.current.setData>[0]);
        tpLineRef.current.setData([{ time: t1, value: tp }, { time: t2, value: tp }] as Parameters<typeof tpLineRef.current.setData>[0]);
        slLineRef.current.setData([{ time: t1, value: sl }, { time: t2, value: sl }] as Parameters<typeof slLineRef.current.setData>[0]);
      } catch (e) { console.warn('[PriceChart] signal line setData error:', e); }
    } else {
      try {
        entryLineRef.current.setData([]);
        tpLineRef.current.setData([]);
        slLineRef.current.setData([]);
      } catch (e) { console.warn('[PriceChart] clear signal lines error:', e); }
    }
  }

  useEffect(() => {
    drawSignalLines();
  }, [signal, isReady, currentPrice]);

  const isV75 = activeSymbol === 'V75';
  const symbolColor = isV75 ? '#a78bfa' : 'var(--gold)';

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--gold)', letterSpacing: '.1em', textTransform: 'uppercase' }}>{L.priceChart}</span>
          <span style={{ fontSize: 9, fontWeight: 700, color: symbolColor, background: isV75 ? 'rgba(139,92,246,.1)' : 'var(--gold-glow)', padding: '2px 7px', borderRadius: 5, border: `1px solid ${isV75 ? 'rgba(139,92,246,.25)' : 'rgba(201,168,76,.25)'}` }}>
            {activeSymbol}
          </span>
        </div>
        {signal?.hasSignal && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 8, fontWeight: 600 }}>
            <span style={{ color: 'var(--gold)' }}>── Harga Entry</span>
            <span style={{ color: 'var(--green)' }}>── Batas Untung</span>
            <span style={{ color: 'var(--red)' }}>── Batas Rugi</span>
          </div>
        )}
      </div>
      <div ref={containerRef} style={{ flex: 1, minHeight: 0 }} />
    </div>
  );
}
