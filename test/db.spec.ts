import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import { addScore, cluesForTeam, leaderboard, teamScore, gameStats, genCode } from '../src/db';
import { fixture, addClue, join, submitPhoto, api, json } from './helpers';

describe('score ledger', () => {
	it('team score is the sum of ledger deltas and the leaderboard agrees', async () => {
		const { game, player } = await fixture();
		const teamId = player.team.id;
		expect(await teamScore(env.DB, teamId)).toBe(0);
		await addScore(env.DB, { gameId: game.id, teamId, delta: 150, reason: 'photo', source: 'submission' });
		await addScore(env.DB, { gameId: game.id, teamId, delta: 50, reason: 'bonus', source: 'bonus' });
		await addScore(env.DB, { gameId: game.id, teamId, delta: -25, reason: 'hint', source: 'hint' });
		expect(await teamScore(env.DB, teamId)).toBe(175);
		const board = await leaderboard(env.DB, game.id);
		expect(board).toHaveLength(1);
		expect(board[0]).toMatchObject({ id: teamId, points: 175, rank: 1 });
	});

	it('leaderboard ranks by points then clues found, then join order', async () => {
		const { game, player: a } = await fixture();
		const b = await join(game.code, 'Bea', { teamName: 'Zookeeperz' });
		const c = await join(game.code, 'Cal', { teamName: 'Wild Things' });
		await addScore(env.DB, { gameId: game.id, teamId: b.team.id, delta: 300, reason: 'x', source: 'adjust' });
		await addScore(env.DB, { gameId: game.id, teamId: c.team.id, delta: 300, reason: 'x', source: 'adjust' });
		const board = await leaderboard(env.DB, game.id);
		expect(board.map((t) => [t.name, t.rank, t.points])).toEqual([
			['Zookeeperz', 1, 300],
			['Wild Things', 2, 300],
			['Banana Bunch', 3, 0],
		]);
		expect(board.find((t) => t.id === a.team.id)?.players).toBe(1);
	});

	it('game stats count teams, players, completed clues and pending photos', async () => {
		const { admin, game, clue, player } = await fixture();
		await join(game.code, 'Bea', { teamId: player.team.id });
		await join(game.code, 'Cal', { teamName: 'Zookeeperz' });
		await addClue(admin, game.id, { title: 'Second' });
		const sub = await submitPhoto(player.token, clue.id);
		expect(sub.status).toBe(201);
		let stats = await gameStats(env.DB, game.id);
		expect(stats).toEqual({ teams: 2, players: 3, clues_total: 4, clues_completed: 0, photos_pending: 1 });
		await api(`/api/admin/submissions/${sub.body.submission.id}/approve`, { method: 'POST', body: json({}) }, admin);
		stats = await gameStats(env.DB, game.id);
		expect(stats).toMatchObject({ clues_completed: 1, photos_pending: 0 });
	});
});

describe('per-team clue status', () => {
	it('derives locked / available / pending / complete', async () => {
		const { admin, game, clue, player } = await fixture();
		const locked = await addClue(admin, game.id, { title: 'Locked one', status: 'locked' });
		const other = await addClue(admin, game.id, { title: 'Other', status: 'available' });
		const sub = await submitPhoto(player.token, clue.id);
		expect(sub.status).toBe(201);

		let clues = await cluesForTeam(env.DB, game.id, player.team.id);
		const byId = Object.fromEntries(clues.map((c) => [c.id, c]));
		expect(byId[clue.id].status).toBe('pending');
		expect(byId[locked.id].status).toBe('locked');
		expect(byId[locked.id].body).toBeNull(); // locked clue text is hidden
		expect(byId[other.id].status).toBe('available');
		expect(byId[other.id].body).toBe('Find the thing');

		await api(`/api/admin/submissions/${sub.body.submission.id}/approve`, { method: 'POST', body: json({}) }, admin);
		clues = await cluesForTeam(env.DB, game.id, player.team.id);
		expect(clues.find((c) => c.id === clue.id)?.status).toBe('complete');
	});

	it('a rejected photo returns the clue to available and allows a resubmit', async () => {
		const { admin, game, clue, player } = await fixture();
		const first = await submitPhoto(player.token, clue.id);
		expect(first.status).toBe(201);
		expect((await submitPhoto(player.token, clue.id)).status).toBe(409); // duplicate while pending
		await api(`/api/admin/submissions/${first.body.submission.id}/reject`, { method: 'POST', body: json({}) }, admin);
		const clues = await cluesForTeam(env.DB, game.id, player.team.id);
		expect(clues.find((c) => c.id === clue.id)?.status).toBe('available');
		expect((await submitPhoto(player.token, clue.id)).status).toBe(201);
	});

	it('is isolated per team', async () => {
		const { game, clue, player: a } = await fixture();
		const b = await join(game.code, 'Bea', { teamName: 'Zookeeperz' });
		await submitPhoto(a.token, clue.id);
		expect((await cluesForTeam(env.DB, game.id, a.team.id))[0].status).toBe('pending');
		expect((await cluesForTeam(env.DB, game.id, b.team.id))[0].status).toBe('available');
	});
});

describe('genCode', () => {
	it('produces ZOO-XXXX without ambiguous characters', () => {
		for (let i = 0; i < 50; i++) expect(genCode()).toMatch(/^ZOO-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);
	});
});
