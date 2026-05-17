import { useState, useEffect, useRef } from 'react';

export type SSEMessage = {
  type: 'connected' | 'ai_thinking' | 'ai_decision' | 'trade_update' | 'portfolio_update' | 'market_status' | 'error';
  data: unknown;
};

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

const SSE_EVENTS: SSEMessage['type'][] = [
  'connected', 'ai_thinking', 'ai_decision', 'trade_update',
  'portfolio_update', 'market_status', 'error',
];

export function useSSE(url: string) {
  const [status, setStatus]           = useState<ConnectionStatus>('connecting');
  const [lastMessage, setLastMessage] = useState<SSEMessage | null>(null);
  const esRef                         = useRef<EventSource | null>(null);
  const retryRef                      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef                    = useRef(true);

  function connect() {
    if (!mountedRef.current) return;
    try {
      const es = new EventSource(url);
      esRef.current = es;

      // Generic message handler (fallback for unnamed events)
      es.onmessage = (e) => {
        if (!mountedRef.current) return;
        try {
          const msg = JSON.parse(e.data) as SSEMessage;
          setLastMessage(msg);
          setStatus('connected');
        } catch {}
      };

      // Named event listeners for each broadcast type
      SSE_EVENTS.forEach(type => {
        es.addEventListener(type, (e: MessageEvent) => {
          if (!mountedRef.current) return;
          try {
            const data = JSON.parse(e.data);
            setLastMessage({ type, data });
            setStatus('connected');
          } catch {}
        });
      });

      es.onerror = () => {
        if (!mountedRef.current) return;
        es.close();
        esRef.current = null;
        setStatus('disconnected');
        console.log('[SSE] Connection lost, retrying in 3s...');
        retryRef.current = setTimeout(connect, 3000);
      };

    } catch (err) {
      console.error('[SSE] Failed to connect:', err);
      setStatus('error');
      retryRef.current = setTimeout(connect, 5000);
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (retryRef.current) clearTimeout(retryRef.current);
      if (esRef.current)    esRef.current.close();
    };
  }, [url]);

  return { status, lastMessage };
}
