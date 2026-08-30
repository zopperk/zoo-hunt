import { useEffect, useRef } from 'react';

export interface RoomEvent {
	type: string;
	at?: number;
	[k: string]: unknown;
}

/**
 * Keeps a WebSocket open to /ws/:gameId with reconnect + heartbeat and calls
 * `onEvent` for every broadcast. `onEvent` may change between renders.
 */
export function useSocket(gameId: string | null | undefined, onEvent: (e: RoomEvent) => void) {
	const handler = useRef(onEvent);
	handler.current = onEvent;

	useEffect(() => {
		if (!gameId) return;
		let ws: WebSocket | null = null;
		let closed = false;
		let attempt = 0;
		let retry: number | undefined;
		let heartbeat: number | undefined;

		const connect = () => {
			if (closed) return;
			const proto = location.protocol === 'https:' ? 'wss' : 'ws';
			ws = new WebSocket(`${proto}://${location.host}/ws/${gameId}`);
			ws.onopen = () => {
				attempt = 0;
				heartbeat = window.setInterval(() => ws?.readyState === WebSocket.OPEN && ws.send('ping'), 25_000);
			};
			ws.onmessage = (m) => {
				if (m.data === 'pong') return;
				try {
					handler.current(JSON.parse(String(m.data)));
				} catch {
					/* ignore malformed */
				}
			};
			ws.onclose = () => {
				window.clearInterval(heartbeat);
				if (closed) return;
				attempt++;
				retry = window.setTimeout(connect, Math.min(15_000, 500 * 2 ** attempt));
			};
			ws.onerror = () => ws?.close();
		};
		connect();

		return () => {
			closed = true;
			window.clearTimeout(retry);
			window.clearInterval(heartbeat);
			ws?.close();
		};
	}, [gameId]);
}
