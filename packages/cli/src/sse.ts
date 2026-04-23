/**
 * ADR-011 — Minimal SSE client for the CLI.
 *
 * Consumes `text/event-stream` from the Layer 4 API. Handles reconnect
 * with Last-Event-ID, and surfaces `id`, `event`, `data` per message.
 * No extra dependency — parses the wire format ourselves.
 */

export interface SseMessage {
  id?: string;
  event?: string;
  data: string;
}

export interface SseStreamOptions {
  url: string;
  headers?: Record<string, string>;
  /** Called for each complete message. */
  onMessage: (msg: SseMessage) => void | Promise<void>;
  /** Signal to terminate the stream cooperatively. */
  signal?: AbortSignal;
  /** Caller sets true to stop auto-reconnect (e.g. on terminal event). */
  shouldStop?: () => boolean;
  /** Reconnect delay ms after a drop. Default 2000. */
  reconnectMs?: number;
}

export async function consumeSse(opts: SseStreamOptions): Promise<void> {
  const { url, onMessage, signal, shouldStop } = opts;
  const reconnectMs = opts.reconnectMs ?? 2000;
  let lastId: string | undefined;

  while (!signal?.aborted && !shouldStop?.()) {
    const headers: Record<string, string> = {
      Accept: 'text/event-stream',
      'Cache-Control': 'no-cache',
      ...(opts.headers ?? {}),
    };
    if (lastId) headers['Last-Event-ID'] = lastId;

    let res: Response;
    try {
      res = await fetch(url, { headers, signal });
    } catch {
      await wait(reconnectMs, signal);
      continue;
    }

    if (res.status === 401 || res.status === 403) {
      throw new Error(`SSE auth failed (${res.status})`);
    }
    if (!res.ok || !res.body) {
      await wait(reconnectMs, signal);
      continue;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentId: string | undefined;
    let currentEvent: string | undefined;
    let currentData = '';

    try {
      while (!signal?.aborted && !shouldStop?.()) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sep: number;
        while ((sep = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, sep).replace(/\r$/, '');
          buffer = buffer.slice(sep + 1);

          if (line === '') {
            // Dispatch accumulated message.
            if (currentData.length > 0 || currentEvent) {
              if (currentId) lastId = currentId;
              await onMessage({
                id: currentId,
                event: currentEvent,
                data: currentData.replace(/\n$/, ''),
              });
              if (currentEvent === 'end' || shouldStop?.()) return;
            }
            currentId = undefined;
            currentEvent = undefined;
            currentData = '';
            continue;
          }

          if (line.startsWith(':')) continue; // heartbeat comment
          const colon = line.indexOf(':');
          const field = colon === -1 ? line : line.slice(0, colon);
          const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '');

          switch (field) {
            case 'id':    currentId = value; break;
            case 'event': currentEvent = value; break;
            case 'data':  currentData += value + '\n'; break;
            // `retry` intentionally ignored — we control reconnect ourselves.
          }
        }
      }
    } catch {
      // fall through to reconnect
    } finally {
      try { reader.releaseLock(); } catch { /* ignore */ }
    }

    if (shouldStop?.()) return;
    await wait(reconnectMs, signal);
  }
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      resolve();
    });
  });
}
