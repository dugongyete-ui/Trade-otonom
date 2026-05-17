import { useState, useEffect, useRef, useCallback } from 'react';

export type WSMessage = {
  type: 'connected' | 'ai_thinking' | 'ai_decision' | 'trade_update' | 'portfolio_update' | 'market_status' | 'error';
  data: unknown;
};

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export function useWebSocket(url: string) {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setStatus('connected');
        console.log('[WS] Connected');
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const msg: WSMessage = JSON.parse(event.data);
          setLastMessage(msg);
        } catch (e) {
          console.error('[WS] Parse error:', e);
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setStatus('disconnected');
        console.log('[WS] Disconnected, reconnecting in 3s...');
        reconnectRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        if (!mountedRef.current) return;
        setStatus('error');
        ws.close();
      };
    } catch (err) {
      console.error('[WS] Connection error:', err);
      setStatus('error');
      reconnectRef.current = setTimeout(connect, 5000);
    }
  }, [url]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  return { status, lastMessage };
}
