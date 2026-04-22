import { useEffect, useRef } from 'react';

type OpdEventType = 'FLOW_STATE_CHANGE' | 'NEW_PATIENT' | 'VITALS_SAVED' | 'CONNECTED' | 'HEARTBEAT';

interface OpdEvent {
  type: OpdEventType;
  encounterCoreId?: string;
  data?: Record<string, any>;
  timestamp?: string;
}

type EventHandler = (event: OpdEvent) => void;

export function useOpdEvents(onEvent: EventHandler, enabled = true) {
  const handlerRef = useRef<EventHandler>(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    if (!enabled) return;

    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let retries = 0;

    const connect = () => {
      eventSource = new EventSource('/api/opd/events/stream');

      eventSource.onmessage = (e) => {
        try {
          const event: OpdEvent = JSON.parse(e.data);
          if (event.type !== 'HEARTBEAT') {
            handlerRef.current(event);
          }
          retries = 0; // Reset on successful message
        } catch {}
      };

      eventSource.onerror = () => {
        eventSource?.close();
        retries++;
        const delay = Math.min(1000 * Math.pow(2, retries), 30000); // Exponential backoff, max 30s
        reconnectTimeout = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      eventSource?.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [enabled]);
}
