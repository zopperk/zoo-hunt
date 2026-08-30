import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import { api, json, fixture, join, bearer, submitPhoto, photoFile, adminHeaders, createGame } from './helpers';

describe('GET /api/games/:code', () => {
	it('returns public game info and teams', async () => {
		const { game, player } = await fixture();
		const r = await api(`/api/games/${game.code.toLowerCase()}`);
		expect(r.status).toBe(200);
		expect(r.body.game).toMatchObject({ id: game.id, code: game.code, status: 'live' });
		expect(r.body.teams).toEqual([expect.objectContaining({ id: player.team.id, name: 'Banana Bunch', color: 'yellow', players: 1 })]);
		expect(r.body.colors).toContain('purple');
	});
	it('404s for an unknown code', async () => {
		expect((await api('/api/games/NOPE-0000')).status).toBe(404);
	});
});

describe('POST /api/join', () => {
	it('creates a team + leader and returns a token with bootstrap state', async () => {
		const admin = await adminHeaders();
		const game = await createGame(admin);
		const r = await api('/api/join', { method: 'POST', body: json({ code: game.code, playerName: 'Alex', teamName: 'Banana Bunch', color: 'blue' }) });
		expect(r.status).toBe(201);
		expect(r.body.token).toMatch(/\./);
		expect(r.body.player).toMatchObject({ name: 'Alex', is_leader: true });
		expect(r.body.team).toMatchObject({ name: 'Banana Bunch', color: 'blue' });
		expect(r.body.game).toMatchObject({ id: game.id, code: game.code });
		expect(r.body.leaderboard).toHaveLength(1);
		expect(r.body.stats).toMatchObject({ points: 0, rank: 1, clues_found: 0 });
	});

	it('joins an existing team as a non-leader', async () => {
		const { game, player } = await fixture();
		const r = await api('/api/join', { method: 'POST', body: json({ code: game.code, playerName: 'Bea', teamId: player.team.id }) });
		expect(r.status).toBe(201);
		expect(r.body.player.is_leader).toBe(false);
		expect(r.body.players.map((p: any) => p.name)).toEqual(['Alex', 'Bea']);
	});

	it('validates input', async () => {
		const { game } = await fixture();
		expect((await api('/api/join', { method: 'POST', body: 'nope' })).status).toBe(400);
		expect((await api('/api/join', { method: 'POST', body: json({ code: game.code }) })).status).toBe(400);
		expect((await api('/api/join', { method: 'POST', body: json({ code: game.code, playerName: 'A' }) })).status).toBe(400);
		expect((await api('/api/join', { method: 'POST', body: json({ code: game.code, playerName: 'x'.repeat(41), teamName: 'T' }) })).status).toBe(400);
		expect((await api('/api/join', { method: 'POST', body: json({ code: 'ZZZ-9999', playerName: 'A', teamName: 'T' }) })).status).toBe(404);
		expect((await api('/api/join', { method: 'POST', body: json({ code: game.code, playerName: 'A', teamId: 'missing' }) })).status).toBe(404);
	});

	it('rejects duplicate team names case-insensitively', async () => {
		const { game } = await fixture();
		const r = await api('/api/join', { method: 'POST', body: json({ code: game.code, playerName: 'Bea', teamName: 'banana bunch' }) });
		expect(r.status).toBe(409);
	});

	it('assigns rotating default colors', async () => {
		const { game } = await fixture(); // first team took yellow explicitly
		const b = await join(game.code, 'B', { teamName: 'Two' });
		const c = await join(game.code, 'C', { teamName: 'Three' });
		expect(b.team.color).toBe('green');
		expect(c.team.color).toBe('blue');
	});

	it('refuses an ended game', async () => {
		const { admin, game } = await fixture();
		await api(`/api/admin/games/${game.id}`, { method: 'PATCH', body: json({ status: 'ended' }) }, admin);
		const r = await api('/api/join', { method: 'POST', body: json({ code: game.code, playerName: 'Late', teamName: 'Latecomers' }) });
		expect(r.status).toBe(410);
	});
});

describe('GET /api/me', () => {
	it('returns the full bootstrap for the player', async () => {
		const { clue, player } = await fixture();
		const r = await api('/api/me', {}, bearer(player.token));
		expect(r.status).toBe(200);
		expect(r.body.clues).toEqual([expect.objectContaining({ id: clue.id, status: 'available', points: 150 })]);
		expect(r.body.bonus).toBeNull();
		expect(r.body.submissions).toEqual([]);
		expect(r.body.stats.clues_total).toBe(1);
	});
});

describe('PATCH /api/team', () => {
	it('lets the leader rename and recolor', async () => {
		const { player } = await fixture();
		const r = await api('/api/team', { method: 'PATCH', body: json({ name: 'Monkey Biz', color: 'red' }) }, bearer(player.token));
		expect(r.status).toBe(200);
		expect(r.body.team).toMatchObject({ name: 'Monkey Biz', color: 'red' });
		expect((await api('/api/me', {}, bearer(player.token))).body.team.name).toBe('Monkey Biz');
	});
	it('blocks non-leaders and duplicate names', async () => {
		const { game, player } = await fixture();
		const bea = await join(game.code, 'Bea', { teamId: player.team.id });
		expect((await api('/api/team', { method: 'PATCH', body: json({ name: 'X' }) }, bearer(bea.token))).status).toBe(403);
		await join(game.code, 'Cal', { teamName: 'Zookeeperz' });
		expect((await api('/api/team', { method: 'PATCH', body: json({ name: 'ZOOKEEPERZ' }) }, bearer(player.token))).status).toBe(409);
	});
});

describe('POST /api/submissions', () => {
	it('stores the photo in R2 and creates a pending submission (manual mode)', async () => {
		const { game, clue, player } = await fixture();
		const r = await submitPhoto(player.token, clue.id, photoFile('giraffe.jpg', 'image/jpeg', [1, 2, 3, 4, 5]));
		expect(r.status).toBe(201);
		expect(r.body.submission).toMatchObject({ clue_id: clue.id, status: 'pending', points_awarded: 0 });
		expect(r.body.points_awarded).toBe(0);
		expect(r.body.submission.photo_url).toMatch(new RegExp(`^/api/photos/games/${game.id}/`));

		const key = r.body.submission.photo_url.replace('/api/photos/', '');
		const obj = await env.PHOTOS.get(key);
		expect(obj).not.toBeNull();
		expect(new Uint8Array(await obj!.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 4, 5]));

		const photo = await api(r.body.submission.photo_url);
		expect(photo.status).toBe(200);
		expect(photo.headers.get('content-type')).toBe('image/jpeg');
		expect(photo.headers.get('cache-control')).toContain('immutable');

		const me = await api('/api/me', {}, bearer(player.token));
		expect(me.body.clues[0].status).toBe('pending');
		expect(me.body.stats.photos_submitted).toBe(1);
	});

	it('auto mode approves immediately and credits the ledger', async () => {
		const { clue, player } = await fixture({ approvalMode: 'auto' });
		const r = await submitPhoto(player.token, clue.id);
		expect(r.status).toBe(201);
		expect(r.body.submission.status).toBe('approved');
		expect(r.body.points_awarded).toBe(150);
		const me = await api('/api/me', {}, bearer(player.token));
		expect(me.body.stats).toMatchObject({ points: 150, clues_found: 1 });
		expect(me.body.clues[0].status).toBe('complete');
	});

	it('validates the upload', async () => {
		const { clue, player } = await fixture();
		expect((await submitPhoto(player.token, clue.id, photoFile('x.txt', 'text/plain'))).status).toBe(415);
		expect((await submitPhoto(player.token, clue.id, photoFile('empty.jpg', 'image/jpeg', []))).status).toBe(400);
		expect((await submitPhoto(player.token, 'missing-clue')).status).toBe(404);
		const fd = new FormData();
		fd.set('clueId', clue.id);
		expect((await api('/api/submissions', { method: 'POST', body: fd }, bearer(player.token))).status).toBe(400);
	});

	it('rejects locked clues and games that are not live', async () => {
		const { admin, game, clue, player } = await fixture();
		await api(`/api/admin/clues/${clue.id}`, { method: 'PATCH', body: json({ status: 'locked' }) }, admin);
		expect((await submitPhoto(player.token, clue.id)).status).toBe(409);
		await api(`/api/admin/clues/${clue.id}`, { method: 'PATCH', body: json({ status: 'available' }) }, admin);
		await api(`/api/admin/games/${game.id}`, { method: 'PATCH', body: json({ status: 'ended' }) }, admin);
		expect((await submitPhoto(player.token, clue.id)).status).toBe(409);
	});

	it('blocks a second active submission for the same clue by the same team', async () => {
		const { game, clue, player } = await fixture();
		const teammate = await join(game.code, 'Bea', { teamId: player.team.id });
		expect((await submitPhoto(player.token, clue.id)).status).toBe(201);
		expect((await submitPhoto(teammate.token, clue.id)).status).toBe(409);
	});
});

describe('GET /api/photos/*', () => {
	it('404s for unknown keys', async () => {
		expect((await api('/api/photos/games/nope.jpg')).status).toBe(404);
	});
});
