import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import { teamScore } from '../src/db';
import { api, json, fixture, adminHeaders, createGame, addClue, join, submitPhoto } from './helpers';

describe('games', () => {
	it('creates a game with a generated code and lists it', async () => {
		const admin = await adminHeaders();
		const r = await api('/api/admin/games', { method: 'POST', body: json({ name: 'Zaid 29', defaultPoints: 200, approvalMode: 'auto' }) }, admin);
		expect(r.status).toBe(201);
		expect(r.body.game).toMatchObject({ name: 'Zaid 29', status: 'draft', default_points: 200, approval_mode: 'auto' });
		expect(r.body.game.code).toMatch(/^ZOO-[A-Z0-9]{4}$/);
		const list = await api('/api/admin/games', {}, admin);
		expect(list.body.games.map((g: any) => g.id)).toContain(r.body.game.id);
	});

	it('accepts a custom code and rejects duplicates / bad input', async () => {
		const admin = await adminHeaders();
		expect((await api('/api/admin/games', { method: 'POST', body: json({ name: 'A', code: 'bzoo-27a9' }) }, admin)).body.game.code).toBe('BZOO-27A9');
		expect((await api('/api/admin/games', { method: 'POST', body: json({ name: 'B', code: 'BZOO-27A9' }) }, admin)).status).toBe(409);
		expect((await api('/api/admin/games', { method: 'POST', body: json({ name: '' }) }, admin)).status).toBe(400);
		expect((await api('/api/admin/games', { method: 'POST', body: json({ name: 'C', code: '!!' }) }, admin)).status).toBe(400);
		expect((await api('/api/admin/games', { method: 'POST', body: json({ name: 'C', defaultPoints: -5 }) }, admin)).status).toBe(400);
	});

	it('overview returns stats, leaderboard and activity', async () => {
		const { admin, game } = await fixture();
		const r = await api(`/api/admin/games/${game.id}`, {}, admin);
		expect(r.status).toBe(200);
		expect(r.body.stats).toMatchObject({ teams: 1, players: 1, clues_total: 1 });
		expect(r.body.leaderboard[0].name).toBe('Banana Bunch');
		expect(r.body.activity.map((a: any) => a.type)).toEqual(expect.arrayContaining(['game_created', 'team_joined']));
	});

	it('patches settings and status, regenerates code', async () => {
		const { admin, game } = await fixture();
		const r = await api(`/api/admin/games/${game.id}`, { method: 'PATCH', body: json({ name: 'Renamed', approvalMode: 'auto', defaultPoints: 100, status: 'ended' }) }, admin);
		expect(r.status).toBe(200);
		expect(r.body.game).toMatchObject({ name: 'Renamed', approval_mode: 'auto', default_points: 100, status: 'ended' });
		expect((await api(`/api/admin/games/${game.id}`, { method: 'PATCH', body: json({ status: 'bogus' }) }, admin)).status).toBe(400);
		const regen = await api(`/api/admin/games/${game.id}/regenerate-code`, { method: 'POST' }, admin);
		expect(regen.body.game.code).not.toBe(game.code);
		expect((await api(`/api/admin/games/nope`, {}, admin)).status).toBe(404);
	});
});

describe('teams', () => {
	it('host can add, rename, and delete teams', async () => {
		const { admin, game } = await fixture();
		const add = await api(`/api/admin/games/${game.id}/teams`, { method: 'POST', body: json({ name: 'Zookeeperz', color: 'green' }) }, admin);
		expect(add.status).toBe(201);
		expect((await api(`/api/admin/games/${game.id}/teams`, { method: 'POST', body: json({ name: 'zookeeperz' }) }, admin)).status).toBe(409);
		const patch = await api(`/api/admin/teams/${add.body.team.id}`, { method: 'PATCH', body: json({ name: 'Keepers', color: 'purple' }) }, admin);
		expect(patch.body.team).toMatchObject({ name: 'Keepers', color: 'purple' });
		expect((await api(`/api/admin/games/${game.id}/teams`, {}, admin)).body.teams).toHaveLength(2);
		expect((await api(`/api/admin/teams/${add.body.team.id}`, { method: 'DELETE' }, admin)).status).toBe(200);
		expect((await api(`/api/admin/games/${game.id}/teams`, {}, admin)).body.teams).toHaveLength(1);
	});

	it('team detail includes members, submissions, ledger and clue status', async () => {
		const { admin, clue, player } = await fixture();
		const sub = await submitPhoto(player.token, clue.id);
		await api(`/api/admin/submissions/${sub.body.submission.id}/approve`, { method: 'POST', body: json({ bonus: 50 }) }, admin);
		const r = await api(`/api/admin/teams/${player.team.id}`, {}, admin);
		expect(r.status).toBe(200);
		expect(r.body.points).toBe(200);
		expect(r.body.players.map((p: any) => p.name)).toEqual(['Alex']);
		expect(r.body.submissions[0]).toMatchObject({ status: 'approved', clue_title: 'Lunch in the Trees', player_name: 'Alex', points_awarded: 200 });
		expect(r.body.score_log.map((e: any) => e.delta).sort()).toEqual([150, 50]);
		expect(r.body.clues[0].status).toBe('complete');
	});
});

describe('players', () => {
	it('host can rename a player, toggle leader, and remove them', async () => {
		const { admin, game, player } = await fixture();
		const bea = await join(game.code, '', { teamId: player.team.id }); // random name
		const detail = await api(`/api/admin/teams/${player.team.id}`, {}, admin);
		const beaRow = detail.body.players.find((p: any) => p.id === bea.player.id);
		expect(beaRow.name).not.toBe('');

		const renamed = await api(`/api/admin/players/${bea.player.id}`, { method: 'PATCH', body: json({ name: 'Bea', isLeader: true }) }, admin);
		expect(renamed.status).toBe(200);
		expect(renamed.body.player).toMatchObject({ name: 'Bea', is_leader: 1 });
		expect((await api(`/api/admin/players/${bea.player.id}`, { method: 'PATCH', body: json({ name: '' }) }, admin)).status).toBe(400);
		expect((await api(`/api/admin/players/nope`, { method: 'PATCH', body: json({ name: 'X' }) }, admin)).status).toBe(404);

		// the player sees their new name
		expect((await api('/api/me', {}, { Authorization: `Bearer ${bea.token}` })).body.player).toMatchObject({ name: 'Bea', is_leader: true });

		expect((await api(`/api/admin/players/${bea.player.id}`, { method: 'DELETE' }, admin)).status).toBe(200);
		expect((await api('/api/me', {}, { Authorization: `Bearer ${bea.token}` })).status).toBe(401);
		expect((await api(`/api/admin/teams/${player.team.id}`, {}, admin)).body.players).toHaveLength(1);
	});
});

describe('clues', () => {
	it('adds clues with incrementing order and default points', async () => {
		const admin = await adminHeaders();
		const game = await createGame(admin, { defaultPoints: 120 });
		const a = await addClue(admin, game.id, { title: 'A' });
		const b = await addClue(admin, game.id, { title: 'B', points: 300 });
		expect([a.sort_order, b.sort_order]).toEqual([1, 2]);
		expect([a.points, b.points]).toEqual([120, 300]);
		expect((await api(`/api/admin/games/${game.id}/clues`, { method: 'POST', body: json({ title: 'no body' }) }, admin)).status).toBe(400);
	});

	it('release-next promotes exactly one locked clue in order; release-all / lock-all flip everything', async () => {
		const admin = await adminHeaders();
		const game = await createGame(admin);
		const c1 = await addClue(admin, game.id, { title: 'One', status: 'locked' });
		const c2 = await addClue(admin, game.id, { title: 'Two', status: 'locked' });
		const c3 = await addClue(admin, game.id, { title: 'Three', status: 'locked' });

		const first = await api(`/api/admin/games/${game.id}/clues/release-next`, { method: 'POST' }, admin);
		expect(first.body.clue.id).toBe(c1.id);
		const second = await api(`/api/admin/games/${game.id}/clues/release-next`, { method: 'POST' }, admin);
		expect(second.body.clue.id).toBe(c2.id);
		let clues = (await api(`/api/admin/games/${game.id}/clues`, {}, admin)).body.clues;
		expect(clues.map((c: any) => c.status)).toEqual(['available', 'available', 'locked']);

		expect((await api(`/api/admin/games/${game.id}/clues/release-all`, { method: 'POST' }, admin)).body.released).toBe(1);
		expect((await api(`/api/admin/games/${game.id}/clues/release-next`, { method: 'POST' }, admin)).status).toBe(409);
		expect((await api(`/api/admin/games/${game.id}/clues/lock-all`, { method: 'POST' }, admin)).body.locked).toBe(3);
		clues = (await api(`/api/admin/games/${game.id}/clues`, {}, admin)).body.clues;
		expect(clues.every((c: any) => c.status === 'locked')).toBe(true);
		expect(clues.map((c: any) => c.id)).toEqual([c1.id, c2.id, c3.id]);
	});

	it('patch/delete and photo counts', async () => {
		const { admin, game, clue, player } = await fixture();
		await submitPhoto(player.token, clue.id);
		const patched = await api(`/api/admin/clues/${clue.id}`, { method: 'PATCH', body: json({ title: 'New title', points: 175 }) }, admin);
		expect(patched.body.clue).toMatchObject({ title: 'New title', points: 175 });
		expect((await api(`/api/admin/clues/${clue.id}`, { method: 'PATCH', body: json({ points: -1 }) }, admin)).status).toBe(400);
		const list = (await api(`/api/admin/games/${game.id}/clues`, {}, admin)).body.clues;
		expect(list[0]).toMatchObject({ photos: 1, completions: 0 });
		expect((await api(`/api/admin/clues/${clue.id}`, { method: 'DELETE' }, admin)).status).toBe(200);
		expect((await api(`/api/admin/games/${game.id}/clues`, {}, admin)).body.clues).toHaveLength(0);
	});

	it('schedule stores release_at and keeps the clue locked', async () => {
		const { admin, clue } = await fixture();
		const at = Date.now() + 60_000;
		const r = await api(`/api/admin/clues/${clue.id}/schedule`, { method: 'POST', body: json({ releaseAt: new Date(at).toISOString() }) }, admin);
		expect(r.status).toBe(200);
		expect(r.body.clue).toMatchObject({ status: 'locked', release_at: at });
		expect((await api(`/api/admin/clues/${clue.id}/schedule`, { method: 'POST', body: json({}) }, admin)).status).toBe(400);
	});
});

describe('photo review', () => {
	it('lists pending submissions with team, clue and player context', async () => {
		const { admin, game, clue, player } = await fixture();
		await submitPhoto(player.token, clue.id);
		const r = await api(`/api/admin/games/${game.id}/submissions?status=pending`, {}, admin);
		expect(r.body.submissions).toHaveLength(1);
		expect(r.body.submissions[0]).toMatchObject({ team_name: 'Banana Bunch', team_color: 'yellow', clue_title: 'Lunch in the Trees', player_name: 'Alex', clue_points: 150 });
		expect(r.body.submissions[0].photo_url).toMatch(/^\/api\/photos\//);
	});

	it('approve awards clue points (+ optional bonus as a separate ledger row)', async () => {
		const { admin, clue, player } = await fixture();
		const sub = await submitPhoto(player.token, clue.id);
		const r = await api(`/api/admin/submissions/${sub.body.submission.id}/approve`, { method: 'POST', body: json({ bonus: 25 }) }, admin);
		expect(r.status).toBe(200);
		expect(r.body.points_awarded).toBe(175);
		expect(await teamScore(env.DB, player.team.id)).toBe(175);
		const log = (await api(`/api/admin/games/${player.game.id}/scores/log`, {}, admin)).body.log;
		expect(log.map((e: any) => [e.source, e.delta]).sort()).toEqual([
			['bonus', 25],
			['submission', 150],
		]);
		// cannot approve twice
		expect((await api(`/api/admin/submissions/${sub.body.submission.id}/approve`, { method: 'POST', body: json({}) }, admin)).status).toBe(409);
		expect((await api(`/api/admin/submissions/${sub.body.submission.id}/reject`, { method: 'POST', body: json({}) }, admin)).status).toBe(409);
	});

	it('reject awards nothing', async () => {
		const { admin, clue, player } = await fixture();
		const sub = await submitPhoto(player.token, clue.id);
		const r = await api(`/api/admin/submissions/${sub.body.submission.id}/reject`, { method: 'POST', body: json({ reason: 'blurry' }) }, admin);
		expect(r.status).toBe(200);
		expect(await teamScore(env.DB, player.team.id)).toBe(0);
		const activity = (await api(`/api/admin/games/${player.game.id}/activity`, {}, admin)).body.activity;
		expect(activity[0].message).toContain('blurry');
	});

	it('mark-all-reviewed approves every pending photo', async () => {
		const { admin, game, clue, player } = await fixture();
		const other = await addClue(admin, game.id, { title: 'Other' });
		const b = await join(game.code, 'Bea', { teamName: 'Zookeeperz' });
		await submitPhoto(player.token, clue.id);
		await submitPhoto(b.token, other.id);
		const r = await api(`/api/admin/games/${game.id}/submissions/mark-all-reviewed`, { method: 'POST' }, admin);
		expect(r.body.approved).toBe(2);
		expect(await teamScore(env.DB, player.team.id)).toBe(150);
		expect(await teamScore(env.DB, b.team.id)).toBe(150);
		expect((await api(`/api/admin/games/${game.id}/submissions?status=pending`, {}, admin)).body.submissions).toHaveLength(0);
	});

	it('bad bonus values are rejected', async () => {
		const { admin, clue, player } = await fixture();
		const sub = await submitPhoto(player.token, clue.id);
		expect((await api(`/api/admin/submissions/${sub.body.submission.id}/approve`, { method: 'POST', body: json({ bonus: -5 }) }, admin)).status).toBe(400);
		expect((await api(`/api/admin/submissions/${sub.body.submission.id}/approve`, { method: 'POST', body: json({ bonus: 1.5 }) }, admin)).status).toBe(400);
	});
});

describe('score control', () => {
	it('adjust requires a reason and non-zero integer delta, and is logged', async () => {
		const { admin, game, player } = await fixture();
		const base = `/api/admin/games/${game.id}/scores/adjust`;
		expect((await api(base, { method: 'POST', body: json({ teamId: player.team.id, delta: 50 }) }, admin)).status).toBe(400);
		expect((await api(base, { method: 'POST', body: json({ teamId: player.team.id, delta: 0, reason: 'x' }) }, admin)).status).toBe(400);
		expect((await api(base, { method: 'POST', body: json({ teamId: player.team.id, delta: 2.5, reason: 'x' }) }, admin)).status).toBe(400);
		expect((await api(base, { method: 'POST', body: json({ teamId: 'nope', delta: 10, reason: 'x' }) }, admin)).status).toBe(404);

		const up = await api(base, { method: 'POST', body: json({ teamId: player.team.id, delta: 100, reason: 'Best group photo' }) }, admin);
		expect(up.status).toBe(200);
		expect(up.body.points).toBe(100);
		const down = await api(base, { method: 'POST', body: json({ teamId: player.team.id, delta: -25, reason: 'Used a hint' }) }, admin);
		expect(down.body.points).toBe(75);

		const log = (await api(`/api/admin/games/${game.id}/scores/log`, {}, admin)).body.log;
		expect(log.map((e: any) => [e.delta, e.reason, e.team_name])).toEqual([
			[-25, 'Used a hint', 'Banana Bunch'],
			[100, 'Best group photo', 'Banana Bunch'],
		]);
	});
});

describe('bonus challenges', () => {
	it('create, toggle, and award', async () => {
		const { admin, game, player } = await fixture();
		const created = await api(`/api/admin/games/${game.id}/bonus`, { method: 'POST', body: json({ title: 'Biggest animal photo', points: 250 }) }, admin);
		expect(created.status).toBe(201);
		expect((await api('/api/me', {}, { Authorization: `Bearer ${player.token}` })).body.bonus).toMatchObject({ title: 'Biggest animal photo', points: 250 });

		const off = await api(`/api/admin/bonus/${created.body.bonus.id}`, { method: 'PATCH', body: json({ status: 'inactive' }) }, admin);
		expect(off.body.bonus.status).toBe('inactive');
		expect((await api('/api/me', {}, { Authorization: `Bearer ${player.token}` })).body.bonus).toBeNull();

		const award = await api(`/api/admin/bonus/${created.body.bonus.id}/award`, { method: 'POST', body: json({ teamId: player.team.id }) }, admin);
		expect(award.status).toBe(200);
		expect(award.body.points).toBe(250);
		expect((await api(`/api/admin/games/${game.id}/bonus`, {}, admin)).body.bonuses).toHaveLength(1);
	});
});
