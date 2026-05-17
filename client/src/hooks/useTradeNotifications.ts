import { useEffect, useRef, useCallback } from 'react';
import type { SSEMessage } from './useSSE';
import { L } from '../lib/labels';

type Toast = { id: number; type: 'tp' | 'sl'; title: string; body: string };
type ToastCallback = (toast: Toast) => void;

let toastId = 0;

function playTone(type: 'tp' | 'sl') {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'tp') {
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } else {
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(330, ctx.currentTime + 0.15);
      osc.frequency.setValueAtTime(260, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);
    }
  } catch {}
}

function sendBrowserNotification(title: string, body: string) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    try { new Notification(title, { body, icon: '/favicon.ico' }); } catch {}
  } else if (Notification.permission === 'default') {
    Notification.requestPermission().then(perm => {
      if (perm === 'granted') {
        try { new Notification(title, { body }); } catch {}
      }
    });
  }
}

export function useTradeNotifications(lastMessage: SSEMessage | null, onToast: ToastCallback) {
  const lastMessageRef = useRef<SSEMessage | null>(null);

  const handleToast = useCallback(onToast, []);

  useEffect(() => {
    if (!lastMessage) return;
    if (lastMessage === lastMessageRef.current) return;
    lastMessageRef.current = lastMessage;

    // trade_update is the SSE event fired by the backend when a trade closes (TP_HIT or SL_HIT).
    // The backend does not emit a separate trade_closed event; trade_update covers both
    // open-trade PnL updates AND close events. We filter by data.status to identify closures.
    if (lastMessage.type !== 'trade_update') return;
    const data = lastMessage.data as { status?: string; pnl?: number; symbol?: string };
    if (!data?.status) return;

    if (data.status === 'TP_HIT') {
      playTone('tp');
      const pnlStr = data.pnl !== undefined ? ` +Rp ${Math.abs(data.pnl).toLocaleString('id-ID')}` : '';
      const title = L.tpHitTitle;
      const body = `${data.symbol || 'XAUUSD'}${pnlStr}`;
      sendBrowserNotification(title, body);
      handleToast({ id: ++toastId, type: 'tp', title, body });
    } else if (data.status === 'SL_HIT') {
      playTone('sl');
      const pnlStr = data.pnl !== undefined ? ` Rp ${Math.abs(data.pnl).toLocaleString('id-ID')}` : '';
      const title = L.slHitTitle;
      const body = `${data.symbol || 'XAUUSD'}${pnlStr}`;
      sendBrowserNotification(title, body);
      handleToast({ id: ++toastId, type: 'sl', title, body });
    }
  }, [lastMessage, handleToast]);
}
