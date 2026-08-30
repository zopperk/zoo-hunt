import { env, SELF, runDurableObjectAlarm } from 'cloudflare:test';
import { describe, it, expect, vi } from 'vitest';
import { api, json, fixture, BASE } from './helpers';

async function connect(gameId: string) {
	const res = await SELF.fetch(`${BASE}/ws/${gameId}`, { headers: { Upgrade: 'websocket' } });
	expect(res.status).toBe(101);
	const ws = res.webSocket!;
	ws.accept();
	const messages: any[] = [];
	ws.addEventListener('message', (e) => {
		messages.push(JSON.parse(String(e.data)));
	});
	return { ws, messages };
}

describe('GameRoom websocket hub', () => {
	it('rejects non-upgrade requests and unknown games', async () => {
		const { game } = await fixture();
		expect((await SELF.fetch(`${BASE}/ws/${game.id}`)).status).toBe(426);
		expect((await SELF.fetch(`${BASE}/ws/does-not-exist`, { headers: { Upgrade: 'websocket' } })).status).toBe(404);
	});

	it('broadcasts to every connected client', async () => {
		const { game } = await fixture();
		const a = await connect(game.id);
		const b = await connect(game.id);
		const stub = env.GAME_ROOM.get(env.GAME_ROOM.idFromName(game.id));
		expect(await stub.connections()).toBe(2);
		expect(await stub.broadcast({ type: 'test', hello: 'world' })).toBe(2);
		await vi.waitFor(() => {
			expect(a.messages).toHaveLength(1);
			expect(b.messages).toHaveLength(1);
		});
		expect(a.messages[0]).toMatchObject({ type: 'test', hello: 'world' });
		expect(typeof a.messages[0].at).toBe('number');
		a.ws.close();
		b.ws.close();
	});

	it('answers ping with pong', async () => {
		const { game } = await fixture();
		const res = await SELF.fetch(`${BASE}/ws/${game.id}`, { headers: { Upgrade: 'websocket' } });
		const ws = res.webSocket!;
		ws.accept();
		const got: string[] = [];
		ws.addEventListener('message', (e) => {
			got.push(String(e.data));
		});
		ws.send('ping');
		await vi.waitFor(() => expect(got).toEqual(['pong']));
		ws.close();
	});

	it('admin actions fan out to players', async () => {
		const { admin, game, clue, player } = await fixture();
		const client = await connect(game.id);
		await api(`/api/admin/clues/${clue.id}`, { method: 'PATCH', body: json({ status: 'locked' }) }, admin);
		await api(`/api/admin/games/${game.id}/scores/adjust`, { method: 'POST', body: json({ teamId: player.team.id, delta: 10, reason: 'hi' }) }, admin);
		await vi.waitFor(() => expect(client.messages.map((m) => m.type)).toEqual(['clues_locked', 'score_adjusted']));
		client.ws.close();
	});
});

describe('GameRoom alarm', () => {
	it('releases due scheduled clues and broadcasts', async () => {
		const { admin, game, clue } = await fixture();
		const client = await connect(game.id);
		const past = Date.now() - 1000;
		await api(`/api/admin/clues/${clue.id}/schedule`, { method: 'POST', body: json({ releaseAt: past }) }, admin);
		const stub = env.GAME_ROOM.get(env.GAME_ROOM.idFromName(game.id));
		// A past-due alarm may already have fired on its own; running it explicitly is a no-op then.
		await runDurableObjectAlarm(stub);

		await vi.waitFor(async () => {
			const row = await env.DB.prepare('SELECT status, release_at FROM clues WHERE id = ?').bind(clue.id).first<{ status: string; release_at: number | null }>();
			expect(row).toEqual({ status: 'available', release_at: null });
		});
		await vi.waitFor(() => expect(client.messages.map((m) => m.type)).toContain('clue_released'));
		expect(client.messages.find((m) => m.type === 'clue_released').clueIds).toEqual([clue.id]);
		client.ws.close();
	});

	it('leaves future clues locked and re-arms', async () => {
		const { admin, game, clue } = await fixture();
		await api(`/api/admin/clues/${clue.id}/schedule`, { method: 'POST', body: json({ releaseAt: Date.now() + 3_600_000 }) }, admin);
		const stub = env.GAME_ROOM.get(env.GAME_ROOM.idFromName(game.id));
		expect(await runDurableObjectAlarm(stub)).toBe(true);
		const row = await env.DB.prepare('SELECT status FROM clues WHERE id = ?').bind(clue.id).first<{ status: string }>();
		expect(row?.status).toBe('locked');
	});
});
