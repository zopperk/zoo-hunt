import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { AdminClaims, AppEnv } from '../types';
import { TEAM_COLORS } from '../types';
import { sign, verify, timingSafeEqual } from '../auth';
import * as db from '../db';
import { emit, room } from '../room-client';

type Ctx = { Bindings: AppEnv };
export const adminRoutes = new Hono<Ctx>();

const COOKIE = 'zh_admin';
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

const requireAdmin = createMiddleware<Ctx>(async (c, next) => {
	const auth = c.req.header('Authorization') ?? '';
	const token = auth.startsWith('Bearer ') ? auth.slice(7) : getCookie(c, COOKIE);
	const claims = await verify<AdminClaims>(token, c.env.SESSION_SECRET);
	if (claims?.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401);
	await next();
});

const bad = (c: { json: (o: unknown, s: 400) => Response }, msg: string) => c.json({ error: msg }, 400);

async function loadGame(c: { env: AppEnv }, id: string): Promise<db.GameRow | null> {
	return db.getGame(c.env.DB, id);
}

function toMs(v: unknown): number | null {
	if (v === null || v === undefined || v === '') return null;
	if (typeof v === 'number') return Number.isFinite(v) ? v : null;
	const t = Date.parse(String(v));
	return Number.isNaN(t) ? null : t;
}

// ---------- auth ----------

adminRoutes.post('/login', async (c) => {
	const body = await c.req.json<{ password?: string }>().catch(() => null);
	const password = body?.password ?? '';
	if (!password || !timingSafeEqual(password, c.env.ADMIN_PASSWORD)) return c.json({ error: 'Wrong password' }, 401);
	const token = await sign({ role: 'admin', exp: Date.now() + SESSION_MS } satisfies AdminClaims, c.env.SESSION_SECRET);
	setCookie(c, COOKIE, token, {
		httpOnly: true,
		sameSite: 'Lax',
		path: '/',
		secure: new URL(c.req.url).protocol === 'https:',
		maxAge: SESSION_MS / 1000,
	});
	return c.json({ ok: true, token });
});

adminRoutes.post('/logout', (c) => {
	deleteCookie(c, COOKIE, { path: '/' });
	return c.json({ ok: true });
});

adminRoutes.use('/*', requireAdmin);

adminRoutes.get('/session', (c) => c.json({ ok: true }));

// ---------- games ----------

adminRoutes.get('/games', async (c) => {
	const { results } = await c.env.DB.prepare('SELECT * FROM games ORDER BY created_at DESC').all<db.GameRow>();
	return c.json({ games: results });
});

adminRoutes.post('/games', async (c) => {
	const body = await c.req.json<Record<string, unknown>>().catch(() => null);
	if (!body) return bad(c, 'Invalid JSON');
	const name = String(body.name ?? '').trim();
	if (!name) return bad(c, 'name is required');
	const defaultPoints = Number(body.defaultPoints ?? 150);
	if (!Number.isInteger(defaultPoints) || defaultPoints < 0) return bad(c, 'defaultPoints must be a non-negative integer');
	const approvalMode = body.approvalMode === 'auto' ? 'auto' : 'manual';
	const status: db.GameStatus = body.status === 'live' ? 'live' : 'draft';
	let code = String(body.code ?? '').trim().toUpperCase();
	if (code && !/^[A-Z0-9-]{4,16}$/.test(code)) return bad(c, 'code must be 4-16 letters, numbers or dashes');

	const game: db.GameRow = {
		id: db.uid(),
		code: code || db.genCode(),
		name,
		status,
		starts_at: toMs(body.startsAt),
		ends_at: toMs(body.endsAt),
		default_points: defaultPoints,
		approval_mode: approvalMode,
		created_at: db.now(),
	};
	for (let attempt = 0; attempt < 5; attempt++) {
		try {
			await c.env.DB.prepare(
				'INSERT INTO games (id, code, name, status, starts_at, ends_at, default_points, approval_mode, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
			)
				.bind(game.id, game.code, game.name, game.status, game.starts_at, game.ends_at, game.default_points, game.approval_mode, game.created_at)
				.run();
			await db.logActivity(c.env.DB, game.id, 'game_created', `Game "${game.name}" created`);
			return c.json({ game }, 201);
		} catch (err) {
			if (!String(err).includes('UNIQUE')) throw err;
			if (code) return c.json({ error: 'That game code is already in use' }, 409);
			game.code = db.genCode();
		}
	}
	return c.json({ error: 'Could not allocate a unique game code' }, 500);
});

adminRoutes.get('/games/:id', async (c) => {
	const game = await loadGame(c, c.req.param('id'));
	if (!game) return c.json({ error: 'Game not found' }, 404);
	const [stats, board, activity] = await Promise.all([
		db.gameStats(c.env.DB, game.id),
		db.leaderboard(c.env.DB, game.id),
		c.env.DB.prepare('SELECT * FROM activity WHERE game_id = ? ORDER BY created_at DESC LIMIT 20').bind(game.id).all<db.ActivityRow>(),
	]);
	return c.json({ game, stats, leaderboard: board, activity: activity.results });
});

adminRoutes.patch('/games/:id', async (c) => {
	const game = await loadGame(c, c.req.param('id'));
	if (!game) return c.json({ error: 'Game not found' }, 404);
	const body = await c.req.json<Record<string, unknown>>().catch(() => null);
	if (!body) return bad(c, 'Invalid JSON');
	const next: db.GameRow = { ...game };
	if (body.name !== undefined) {
		next.name = String(body.name).trim();
		if (!next.name) return bad(c, 'name cannot be empty');
	}
	if (body.status !== undefined) {
		if (!['draft', 'live', 'ended'].includes(String(body.status))) return bad(c, 'invalid status');
		next.status = body.status as db.GameStatus;
	}
	if (body.defaultPoints !== undefined) {
		next.default_points = Number(body.defaultPoints);
		if (!Number.isInteger(next.default_points) || next.default_points < 0) return bad(c, 'invalid defaultPoints');
	}
	if (body.approvalMode !== undefined) {
		if (!['manual', 'auto'].includes(String(body.approvalMode))) return bad(c, 'invalid approvalMode');
		next.approval_mode = body.approvalMode as db.ApprovalMode;
	}
	if (body.startsAt !== undefined) next.starts_at = toMs(body.startsAt);
	if (body.endsAt !== undefined) next.ends_at = toMs(body.endsAt);

	await c.env.DB.prepare(
		'UPDATE games SET name = ?, status = ?, starts_at = ?, ends_at = ?, default_points = ?, approval_mode = ? WHERE id = ?',
	)
		.bind(next.name, next.status, next.starts_at, next.ends_at, next.default_points, next.approval_mode, next.id)
		.run();

	if (next.status !== game.status) {
		await db.logActivity(c.env.DB, game.id, 'game_status', `Game is now ${next.status}`);
		await emit(c.env, game.id, { type: next.status === 'ended' ? 'game_ended' : 'game_updated', status: next.status });
	} else {
		await emit(c.env, game.id, { type: 'game_updated' });
	}
	return c.json({ game: next });
});

adminRoutes.post('/games/:id/regenerate-code', async (c) => {
	const game = await loadGame(c, c.req.param('id'));
	if (!game) return c.json({ error: 'Game not found' }, 404);
	for (let attempt = 0; attempt < 5; attempt++) {
		const code = db.genCode();
		try {
			await c.env.DB.prepare('UPDATE games SET code = ? WHERE id = ?').bind(code, game.id).run();
			return c.json({ game: { ...game, code } });
		} catch (err) {
			if (!String(err).includes('UNIQUE')) throw err;
		}
	}
	return c.json({ error: 'Could not allocate a unique game code' }, 500);
});

// ---------- teams ----------

adminRoutes.get('/games/:id/teams', async (c) => {
	return c.json({ teams: await db.leaderboard(c.env.DB, c.req.param('id')) });
});

adminRoutes.post('/games/:id/teams', async (c) => {
	const game = await loadGame(c, c.req.param('id'));
	if (!game) return c.json({ error: 'Game not found' }, 404);
	const body = await c.req.json<{ name?: string; color?: string }>().catch(() => null);
	const name = (body?.name ?? '').trim();
	if (!name || name.length > 40) return bad(c, 'name is required (max 40 chars)');
	const color = (TEAM_COLORS as readonly string[]).includes(body?.color ?? '') ? body!.color! : TEAM_COLORS[0];
	const team: db.TeamRow = { id: db.uid(), game_id: game.id, name, color, avatar: 'monkey', created_at: db.now() };
	try {
		await c.env.DB.prepare('INSERT INTO teams (id, game_id, name, color, avatar, created_at) VALUES (?, ?, ?, ?, ?, ?)')
			.bind(team.id, team.game_id, team.name, team.color, team.avatar, team.created_at)
			.run();
	} catch (err) {
		if (String(err).includes('UNIQUE')) return c.json({ error: 'That team name is taken' }, 409);
		throw err;
	}
	await db.logActivity(c.env.DB, game.id, 'team_created', `Team ${name} added by host`);
	await emit(c.env, game.id, { type: 'leaderboard', reason: 'team_created' });
	return c.json({ team }, 201);
});

adminRoutes.get('/teams/:id', async (c) => {
	const team = await db.getTeam(c.env.DB, c.req.param('id'));
	if (!team) return c.json({ error: 'Team not found' }, 404);
	const [players, submissions, log, points, clues] = await Promise.all([
		c.env.DB.prepare('SELECT id, name, is_leader, last_seen_at FROM players WHERE team_id = ? ORDER BY created_at').bind(team.id).all(),
		c.env.DB.prepare(
			`SELECT s.*, c.title AS clue_title, c.points AS clue_points, p.name AS player_name
			 FROM submissions s JOIN clues c ON c.id = s.clue_id LEFT JOIN players p ON p.id = s.player_id
			 WHERE s.team_id = ? ORDER BY s.created_at DESC`,
		)
			.bind(team.id)
			.all<db.SubmissionRow & { clue_title: string; clue_points: number; player_name: string | null }>(),
		c.env.DB.prepare('SELECT * FROM score_events WHERE team_id = ? ORDER BY created_at DESC').bind(team.id).all<db.ScoreEventRow>(),
		db.teamScore(c.env.DB, team.id),
		db.cluesForTeam(c.env.DB, team.game_id, team.id),
	]);
	return c.json({
		team,
		points,
		players: players.results,
		submissions: submissions.results.map((s) => ({ ...s, photo_url: db.photoUrl(s.r2_key) })),
		score_log: log.results,
		clues,
	});
});

adminRoutes.patch('/teams/:id', async (c) => {
	const team = await db.getTeam(c.env.DB, c.req.param('id'));
	if (!team) return c.json({ error: 'Team not found' }, 404);
	const body = await c.req.json<{ name?: string; color?: string }>().catch(() => null);
	const name = (body?.name ?? team.name).trim();
	const color = (TEAM_COLORS as readonly string[]).includes(body?.color ?? '') ? body!.color! : team.color;
	if (!name || name.length > 40) return bad(c, 'invalid name');
	try {
		await c.env.DB.prepare('UPDATE teams SET name = ?, color = ? WHERE id = ?').bind(name, color, team.id).run();
	} catch (err) {
		if (String(err).includes('UNIQUE')) return c.json({ error: 'That team name is taken' }, 409);
		throw err;
	}
	await emit(c.env, team.game_id, { type: 'team_updated', teamId: team.id });
	return c.json({ team: { ...team, name, color } });
});

adminRoutes.delete('/teams/:id', async (c) => {
	const team = await db.getTeam(c.env.DB, c.req.param('id'));
	if (!team) return c.json({ error: 'Team not found' }, 404);
	await c.env.DB.prepare('DELETE FROM teams WHERE id = ?').bind(team.id).run();
	await db.logActivity(c.env.DB, team.game_id, 'team_removed', `Team ${team.name} removed by host`);
	await emit(c.env, team.game_id, { type: 'leaderboard', reason: 'team_removed' });
	return c.json({ ok: true });
});

// ---------- players ----------

adminRoutes.patch('/players/:id', async (c) => {
	const player = await c.env.DB.prepare('SELECT * FROM players WHERE id = ?').bind(c.req.param('id')).first<db.PlayerRow>();
	if (!player) return c.json({ error: 'Player not found' }, 404);
	const body = await c.req.json<{ name?: string; isLeader?: boolean }>().catch(() => null);
	if (!body) return bad(c, 'Invalid JSON');
	const name = (body.name ?? player.name).trim();
	if (!name || name.length > 40) return bad(c, 'name is required (max 40 chars)');
	const isLeader = body.isLeader === undefined ? player.is_leader : body.isLeader ? 1 : 0;
	await c.env.DB.prepare('UPDATE players SET name = ?, is_leader = ? WHERE id = ?').bind(name, isLeader, player.id).run();
	await emit(c.env, player.game_id, { type: 'team_updated', teamId: player.team_id });
	return c.json({ player: { ...player, name, is_leader: isLeader } });
});

adminRoutes.delete('/players/:id', async (c) => {
	const player = await c.env.DB.prepare('SELECT * FROM players WHERE id = ?').bind(c.req.param('id')).first<db.PlayerRow>();
	if (!player) return c.json({ error: 'Player not found' }, 404);
	await c.env.DB.prepare('DELETE FROM players WHERE id = ?').bind(player.id).run();
	await emit(c.env, player.game_id, { type: 'team_updated', teamId: player.team_id });
	return c.json({ ok: true });
});

// ---------- clues ----------

adminRoutes.get('/games/:id/clues', async (c) => {
	const { results } = await c.env.DB.prepare(
		`SELECT c.*,
		        (SELECT COUNT(*) FROM submissions s WHERE s.clue_id = c.id AND s.status <> 'rejected') AS photos,
		        (SELECT COUNT(*) FROM submissions s WHERE s.clue_id = c.id AND s.status = 'approved') AS completions
		 FROM clues c WHERE c.game_id = ? ORDER BY c.sort_order`,
	)
		.bind(c.req.param('id'))
		.all<db.ClueRow & { photos: number; completions: number }>();
	return c.json({ clues: results });
});

adminRoutes.post('/games/:id/clues', async (c) => {
	const game = await loadGame(c, c.req.param('id'));
	if (!game) return c.json({ error: 'Game not found' }, 404);
	const body = await c.req.json<Record<string, unknown>>().catch(() => null);
	if (!body) return bad(c, 'Invalid JSON');
	const title = String(body.title ?? '').trim();
	const text = String(body.body ?? '').trim();
	if (!title || !text) return bad(c, 'title and body are required');
	const points = body.points === undefined ? game.default_points : Number(body.points);
	if (!Number.isInteger(points) || points < 0) return bad(c, 'points must be a non-negative integer');
	const status: db.ClueStatus = body.status === 'available' ? 'available' : 'locked';
	const max = await c.env.DB.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM clues WHERE game_id = ?').bind(game.id).first<{ m: number }>();
	const clue: db.ClueRow = {
		id: db.uid(),
		game_id: game.id,
		sort_order: (max?.m ?? 0) + 1,
		title,
		body: text,
		animal: String(body.animal ?? '').trim(),
		points,
		status,
		release_at: null,
		map_x: body.mapX === undefined ? null : Number(body.mapX),
		map_y: body.mapY === undefined ? null : Number(body.mapY),
	};
	await c.env.DB.prepare(
		'INSERT INTO clues (id, game_id, sort_order, title, body, animal, points, status, release_at, map_x, map_y) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
	)
		.bind(clue.id, clue.game_id, clue.sort_order, clue.title, clue.body, clue.animal, clue.points, clue.status, clue.release_at, clue.map_x, clue.map_y)
		.run();
	await emit(c.env, game.id, { type: 'clue_released', clueIds: status === 'available' ? [clue.id] : [] });
	return c.json({ clue }, 201);
});

adminRoutes.patch('/clues/:id', async (c) => {
	const clue = await db.getClue(c.env.DB, c.req.param('id'));
	if (!clue) return c.json({ error: 'Clue not found' }, 404);
	const body = await c.req.json<Record<string, unknown>>().catch(() => null);
	if (!body) return bad(c, 'Invalid JSON');
	const next: db.ClueRow = { ...clue };
	if (body.title !== undefined) next.title = String(body.title).trim();
	if (body.body !== undefined) next.body = String(body.body).trim();
	if (body.animal !== undefined) next.animal = String(body.animal).trim();
	if (body.points !== undefined) next.points = Number(body.points);
	if (body.sortOrder !== undefined) next.sort_order = Number(body.sortOrder);
	if (body.mapX !== undefined) next.map_x = body.mapX === null ? null : Number(body.mapX);
	if (body.mapY !== undefined) next.map_y = body.mapY === null ? null : Number(body.mapY);
	if (body.status !== undefined) {
		if (!['locked', 'available'].includes(String(body.status))) return bad(c, 'invalid status');
		next.status = body.status as db.ClueStatus;
		if (next.status === 'available') next.release_at = null;
	}
	if (!next.title || !next.body) return bad(c, 'title and body cannot be empty');
	if (!Number.isInteger(next.points) || next.points < 0) return bad(c, 'invalid points');
	await c.env.DB.prepare(
		'UPDATE clues SET title = ?, body = ?, animal = ?, points = ?, sort_order = ?, status = ?, release_at = ?, map_x = ?, map_y = ? WHERE id = ?',
	)
		.bind(next.title, next.body, next.animal, next.points, next.sort_order, next.status, next.release_at, next.map_x, next.map_y, next.id)
		.run();
	if (next.status !== clue.status) {
		await db.logActivity(c.env.DB, clue.game_id, next.status === 'available' ? 'clue_released' : 'clue_locked', `${next.title} ${next.status === 'available' ? 'released' : 'locked'}`);
		await emit(c.env, clue.game_id, next.status === 'available' ? { type: 'clue_released', clueIds: [clue.id] } : { type: 'clues_locked', clueIds: [clue.id] });
	} else {
		await emit(c.env, clue.game_id, { type: 'game_updated' });
	}
	return c.json({ clue: next });
});

adminRoutes.delete('/clues/:id', async (c) => {
	const clue = await db.getClue(c.env.DB, c.req.param('id'));
	if (!clue) return c.json({ error: 'Clue not found' }, 404);
	await c.env.DB.prepare('DELETE FROM clues WHERE id = ?').bind(clue.id).run();
	await emit(c.env, clue.game_id, { type: 'game_updated' });
	return c.json({ ok: true });
});

adminRoutes.post('/games/:id/clues/release-next', async (c) => {
	const gameId = c.req.param('id');
	const next = await c.env.DB.prepare(`SELECT * FROM clues WHERE game_id = ? AND status = 'locked' ORDER BY sort_order LIMIT 1`).bind(gameId).first<db.ClueRow>();
	if (!next) return c.json({ error: 'No locked clues left' }, 409);
	await c.env.DB.prepare(`UPDATE clues SET status = 'available', release_at = NULL WHERE id = ?`).bind(next.id).run();
	await db.logActivity(c.env.DB, gameId, 'clue_released', `Clue #${next.sort_order} "${next.title}" released`);
	await emit(c.env, gameId, { type: 'clue_released', clueIds: [next.id] });
	return c.json({ clue: { ...next, status: 'available', release_at: null } });
});

adminRoutes.post('/games/:id/clues/release-all', async (c) => {
	const gameId = c.req.param('id');
	const { results } = await c.env.DB.prepare(`SELECT id FROM clues WHERE game_id = ? AND status = 'locked'`).bind(gameId).all<{ id: string }>();
	await c.env.DB.prepare(`UPDATE clues SET status = 'available', release_at = NULL WHERE game_id = ?`).bind(gameId).run();
	if (results.length) {
		await db.logActivity(c.env.DB, gameId, 'clue_released', `All clues released (${results.length})`);
		await emit(c.env, gameId, { type: 'clue_released', clueIds: results.map((r) => r.id) });
	}
	return c.json({ released: results.length });
});

adminRoutes.post('/games/:id/clues/lock-all', async (c) => {
	const gameId = c.req.param('id');
	const { results } = await c.env.DB.prepare(`SELECT id FROM clues WHERE game_id = ? AND status = 'available'`).bind(gameId).all<{ id: string }>();
	await c.env.DB.prepare(`UPDATE clues SET status = 'locked', release_at = NULL WHERE game_id = ?`).bind(gameId).run();
	if (results.length) {
		await db.logActivity(c.env.DB, gameId, 'clue_locked', `All clues locked (${results.length})`);
		await emit(c.env, gameId, { type: 'clues_locked', clueIds: results.map((r) => r.id) });
	}
	return c.json({ locked: results.length });
});

adminRoutes.post('/clues/:id/schedule', async (c) => {
	const clue = await db.getClue(c.env.DB, c.req.param('id'));
	if (!clue) return c.json({ error: 'Clue not found' }, 404);
	const body = await c.req.json<{ releaseAt?: unknown }>().catch(() => null);
	const at = toMs(body?.releaseAt);
	if (at === null) return bad(c, 'releaseAt (ISO string or epoch ms) is required');
	await c.env.DB.prepare(`UPDATE clues SET status = 'locked', release_at = ? WHERE id = ?`).bind(at, clue.id).run();
	await room(c.env, clue.game_id).scheduleRelease(clue.game_id, at);
	await db.logActivity(c.env.DB, clue.game_id, 'clue_scheduled', `${clue.title} scheduled for ${new Date(at).toISOString()}`);
	return c.json({ clue: { ...clue, status: 'locked', release_at: at } });
});

// ---------- submissions ----------

adminRoutes.get('/games/:id/submissions', async (c) => {
	const status = c.req.query('status');
	const where = status && ['pending', 'approved', 'rejected'].includes(status) ? `AND s.status = '${status}'` : '';
	const { results } = await c.env.DB.prepare(
		`SELECT s.*, c.title AS clue_title, c.sort_order AS clue_order, c.points AS clue_points,
		        t.name AS team_name, t.color AS team_color, p.name AS player_name
		 FROM submissions s
		 JOIN clues c ON c.id = s.clue_id
		 JOIN teams t ON t.id = s.team_id
		 LEFT JOIN players p ON p.id = s.player_id
		 WHERE s.game_id = ? ${where}
		 ORDER BY s.created_at DESC LIMIT 200`,
	)
		.bind(c.req.param('id'))
		.all<db.SubmissionRow & { clue_title: string; clue_order: number; clue_points: number; team_name: string; team_color: string; player_name: string | null }>();
	return c.json({ submissions: results.map((s) => ({ ...s, photo_url: db.photoUrl(s.r2_key) })) });
});

async function approve(env: AppEnv, sub: db.SubmissionRow, bonus: number, reviewer = 'host') {
	const [clue, team] = await Promise.all([db.getClue(env.DB, sub.clue_id), db.getTeam(env.DB, sub.team_id)]);
	if (!clue || !team) throw new Error('submission references missing clue/team');
	const t = db.now();
	await env.DB.prepare(`UPDATE submissions SET status = 'approved', points_awarded = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?`)
		.bind(clue.points + bonus, reviewer, t, sub.id)
		.run();
	await db.addScore(env.DB, { gameId: sub.game_id, teamId: sub.team_id, delta: clue.points, reason: `Approved photo: ${clue.title}`, source: 'submission', refId: sub.id, createdBy: reviewer });
	if (bonus > 0) {
		await db.addScore(env.DB, { gameId: sub.game_id, teamId: sub.team_id, delta: bonus, reason: `Bonus for ${clue.title} photo`, source: 'bonus', refId: sub.id, createdBy: reviewer });
	}
	await db.logActivity(env.DB, sub.game_id, 'photo_approved', `${team.name} photo approved for ${clue.title} (+${clue.points + bonus} pts)`);
	await emit(env, sub.game_id, { type: 'submission_reviewed', teamId: team.id, clueId: clue.id, submissionId: sub.id, status: 'approved', points: clue.points + bonus });
	return { points: clue.points + bonus };
}

adminRoutes.post('/submissions/:id/approve', async (c) => {
	const sub = await db.getSubmission(c.env.DB, c.req.param('id'));
	if (!sub) return c.json({ error: 'Submission not found' }, 404);
	if (sub.status !== 'pending') return c.json({ error: `Submission is already ${sub.status}` }, 409);
	const body = await c.req.json<{ bonus?: unknown }>().catch(() => ({}) as { bonus?: unknown });
	const bonus = body.bonus === undefined ? 0 : Number(body.bonus);
	if (!Number.isInteger(bonus) || bonus < 0 || bonus > 10000) return bad(c, 'bonus must be an integer between 0 and 10000');
	const { points } = await approve(c.env, sub, bonus);
	return c.json({ ok: true, points_awarded: points });
});

adminRoutes.post('/submissions/:id/reject', async (c) => {
	const sub = await db.getSubmission(c.env.DB, c.req.param('id'));
	if (!sub) return c.json({ error: 'Submission not found' }, 404);
	if (sub.status !== 'pending') return c.json({ error: `Submission is already ${sub.status}` }, 409);
	const body = await c.req.json<{ reason?: string }>().catch(() => ({}) as { reason?: string });
	await c.env.DB.prepare(`UPDATE submissions SET status = 'rejected', reviewed_by = 'host', reviewed_at = ? WHERE id = ?`).bind(db.now(), sub.id).run();
	const [clue, team] = await Promise.all([db.getClue(c.env.DB, sub.clue_id), db.getTeam(c.env.DB, sub.team_id)]);
	await db.logActivity(c.env.DB, sub.game_id, 'photo_rejected', `${team?.name ?? 'A team'} photo rejected for ${clue?.title ?? 'a clue'}${body.reason ? `: ${body.reason}` : ''}`);
	await emit(c.env, sub.game_id, { type: 'submission_reviewed', teamId: sub.team_id, clueId: sub.clue_id, submissionId: sub.id, status: 'rejected', reason: body.reason ?? null });
	return c.json({ ok: true });
});

adminRoutes.post('/games/:id/submissions/mark-all-reviewed', async (c) => {
	const gameId = c.req.param('id');
	const { results } = await c.env.DB.prepare(`SELECT * FROM submissions WHERE game_id = ? AND status = 'pending' ORDER BY created_at`).bind(gameId).all<db.SubmissionRow>();
	for (const sub of results) await approve(c.env, sub, 0);
	return c.json({ approved: results.length });
});

// ---------- scores ----------

adminRoutes.post('/games/:id/scores/adjust', async (c) => {
	const game = await loadGame(c, c.req.param('id'));
	if (!game) return c.json({ error: 'Game not found' }, 404);
	const body = await c.req.json<{ teamId?: string; delta?: unknown; reason?: string }>().catch(() => null);
	if (!body) return bad(c, 'Invalid JSON');
	const delta = Number(body.delta);
	const reason = (body.reason ?? '').trim();
	if (!body.teamId) return bad(c, 'teamId is required');
	if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 10000) return bad(c, 'delta must be a non-zero integer within ±10000');
	if (!reason) return bad(c, 'reason is required');
	const team = await c.env.DB.prepare('SELECT * FROM teams WHERE id = ? AND game_id = ?').bind(body.teamId, game.id).first<db.TeamRow>();
	if (!team) return c.json({ error: 'Team not found' }, 404);
	const event = await db.addScore(c.env.DB, { gameId: game.id, teamId: team.id, delta, reason, source: 'adjust' });
	await db.logActivity(c.env.DB, game.id, 'score_adjusted', `${team.name} ${delta > 0 ? '+' : ''}${delta} pts — ${reason}`);
	await emit(c.env, game.id, { type: 'score_adjusted', teamId: team.id, delta, reason });
	return c.json({ event, points: await db.teamScore(c.env.DB, team.id) });
});

adminRoutes.get('/games/:id/scores/log', async (c) => {
	const { results } = await c.env.DB.prepare(
		`SELECT e.*, t.name AS team_name FROM score_events e JOIN teams t ON t.id = e.team_id WHERE e.game_id = ? ORDER BY e.created_at DESC LIMIT 200`,
	)
		.bind(c.req.param('id'))
		.all<db.ScoreEventRow & { team_name: string }>();
	return c.json({ log: results });
});

// ---------- bonus challenges ----------

adminRoutes.get('/games/:id/bonus', async (c) => {
	const { results } = await c.env.DB.prepare('SELECT * FROM bonus_challenges WHERE game_id = ? ORDER BY created_at DESC').bind(c.req.param('id')).all<db.BonusRow>();
	return c.json({ bonuses: results });
});

adminRoutes.post('/games/:id/bonus', async (c) => {
	const game = await loadGame(c, c.req.param('id'));
	if (!game) return c.json({ error: 'Game not found' }, 404);
	const body = await c.req.json<Record<string, unknown>>().catch(() => null);
	if (!body) return bad(c, 'Invalid JSON');
	const title = String(body.title ?? '').trim();
	const points = Number(body.points ?? 250);
	if (!title) return bad(c, 'title is required');
	if (!Number.isInteger(points) || points < 0) return bad(c, 'invalid points');
	const bonus: db.BonusRow = {
		id: db.uid(),
		game_id: game.id,
		title,
		description: String(body.description ?? '').trim(),
		points,
		status: body.status === 'inactive' ? 'inactive' : 'active',
		r2_key: null,
		created_at: db.now(),
	};
	await c.env.DB.prepare('INSERT INTO bonus_challenges (id, game_id, title, description, points, status, r2_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
		.bind(bonus.id, bonus.game_id, bonus.title, bonus.description, bonus.points, bonus.status, bonus.r2_key, bonus.created_at)
		.run();
	if (bonus.status === 'active') await db.logActivity(c.env.DB, game.id, 'bonus_posted', `Bonus challenge: ${title} (${points} pts)`);
	await emit(c.env, game.id, { type: 'bonus_updated' });
	return c.json({ bonus }, 201);
});

adminRoutes.patch('/bonus/:id', async (c) => {
	const bonus = await c.env.DB.prepare('SELECT * FROM bonus_challenges WHERE id = ?').bind(c.req.param('id')).first<db.BonusRow>();
	if (!bonus) return c.json({ error: 'Bonus not found' }, 404);
	const body = await c.req.json<Record<string, unknown>>().catch(() => null);
	if (!body) return bad(c, 'Invalid JSON');
	const next = { ...bonus };
	if (body.title !== undefined) next.title = String(body.title).trim();
	if (body.description !== undefined) next.description = String(body.description).trim();
	if (body.points !== undefined) next.points = Number(body.points);
	if (body.status !== undefined) next.status = body.status === 'inactive' ? 'inactive' : 'active';
	if (!next.title || !Number.isInteger(next.points) || next.points < 0) return bad(c, 'invalid bonus');
	await c.env.DB.prepare('UPDATE bonus_challenges SET title = ?, description = ?, points = ?, status = ? WHERE id = ?')
		.bind(next.title, next.description, next.points, next.status, next.id)
		.run();
	if (next.status === 'active' && bonus.status !== 'active') await db.logActivity(c.env.DB, bonus.game_id, 'bonus_posted', `Bonus challenge: ${next.title} (${next.points} pts)`);
	await emit(c.env, bonus.game_id, { type: 'bonus_updated' });
	return c.json({ bonus: next });
});

/** Award a bonus challenge to a team (ledger source = bonus). */
adminRoutes.post('/bonus/:id/award', async (c) => {
	const bonus = await c.env.DB.prepare('SELECT * FROM bonus_challenges WHERE id = ?').bind(c.req.param('id')).first<db.BonusRow>();
	if (!bonus) return c.json({ error: 'Bonus not found' }, 404);
	const body = await c.req.json<{ teamId?: string }>().catch(() => null);
	const team = body?.teamId ? await c.env.DB.prepare('SELECT * FROM teams WHERE id = ? AND game_id = ?').bind(body.teamId, bonus.game_id).first<db.TeamRow>() : null;
	if (!team) return c.json({ error: 'Team not found' }, 404);
	await db.addScore(c.env.DB, { gameId: bonus.game_id, teamId: team.id, delta: bonus.points, reason: `Bonus challenge: ${bonus.title}`, source: 'bonus', refId: bonus.id });
	await db.logActivity(c.env.DB, bonus.game_id, 'bonus_awarded', `${team.name} completed bonus "${bonus.title}" (+${bonus.points} pts)`);
	await emit(c.env, bonus.game_id, { type: 'score_adjusted', teamId: team.id, delta: bonus.points, reason: bonus.title });
	return c.json({ ok: true, points: await db.teamScore(c.env.DB, team.id) });
});

// ---------- activity ----------

adminRoutes.get('/games/:id/activity', async (c) => {
	const { results } = await c.env.DB.prepare('SELECT * FROM activity WHERE game_id = ? ORDER BY created_at DESC LIMIT 100').bind(c.req.param('id')).all<db.ActivityRow>();
	return c.json({ activity: results });
});
