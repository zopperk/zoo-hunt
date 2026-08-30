import { DurableObject } from 'cloudflare:workers';
import type { AppEnv } from './types';
import { logActivity } from './db';

export interface RoomEvent {
	type:
		| 'leaderboard'
		| 'team_updated'
		| 'clue_released'
		| 'clues_locked'
		| 'submission_created'
		| 'submission_reviewed'
		| 'score_adjusted'
		| 'bonus_updated'
		| 'game_updated'
		| 'game_ended'
		| 'test';
	[k: string]: unknown;
}

/**
 * One GameRoom per game (id = game id). Holds every connected player/admin WebSocket
 * (hibernatable) and runs the alarm that releases scheduled clues.
 */
export class GameRoom extends DurableObject<AppEnv> {
	async fetch(request: Request): Promise<Response> {
		if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
			return new Response('Expected WebSocket upgrade', { status: 426 });
		}
		const pair = new WebSocketPair();
		const client = pair[0];
		const server = pair[1];
		this.ctx.acceptWebSocket(server);
		return new Response(null, { status: 101, webSocket: client });
	}

	/** Send an event to every connected socket. Returns how many received it. */
	async broadcast(event: RoomEvent): Promise<number> {
		const msg = JSON.stringify({ ...event, at: Date.now() });
		let sent = 0;
		for (const ws of this.ctx.getWebSockets()) {
			try {
				ws.send(msg);
				sent++;
			} catch {
				// socket already closing; hibernation API cleans it up
			}
		}
		return sent;
	}

	async connections(): Promise<number> {
		return this.ctx.getWebSockets().length;
	}

	/** Remember the game and make sure an alarm fires no later than `at`. */
	async scheduleRelease(gameId: string, at: number): Promise<void> {
		await this.ctx.storage.put('gameId', gameId);
		const current = await this.ctx.storage.getAlarm();
		if (current === null || at < current) await this.ctx.storage.setAlarm(at);
	}

	async alarm(): Promise<void> {
		const gameId = await this.ctx.storage.get<string>('gameId');
		if (!gameId) return;
		const t = Date.now();
		const due = await this.env.DB.prepare(
			`SELECT id, title FROM clues WHERE game_id = ? AND status = 'locked' AND release_at IS NOT NULL AND release_at <= ? ORDER BY sort_order`,
		)
			.bind(gameId, t)
			.all<{ id: string; title: string }>();

		for (const clue of due.results) {
			await this.env.DB.prepare(`UPDATE clues SET status = 'available', release_at = NULL WHERE id = ?`).bind(clue.id).run();
			await logActivity(this.env.DB, gameId, 'clue_released', `${clue.title} released (scheduled)`);
		}
		if (due.results.length > 0) {
			await this.broadcast({ type: 'clue_released', clueIds: due.results.map((c) => c.id) });
		}

		const next = await this.env.DB.prepare(
			`SELECT MIN(release_at) AS at FROM clues WHERE game_id = ? AND status = 'locked' AND release_at IS NOT NULL`,
		)
			.bind(gameId)
			.first<{ at: number | null }>();
		if (next?.at) await this.ctx.storage.setAlarm(Math.max(next.at, t + 1000));
	}

	async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
		if (message === 'ping') ws.send('pong');
	}

	async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
		try {
			ws.close(code, reason);
		} catch {
			/* already closed */
		}
	}

	async webSocketError(ws: WebSocket): Promise<void> {
		try {
			ws.close(1011, 'error');
		} catch {
			/* already closed */
		}
	}
}
