import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import type { AppEnv, PlayerClaims } from '../types';
import { TEAM_COLORS } from '../types';
import { sign, verify } from '../auth';
import * as db from '../db';
import { emit } from '../room-client';

type Vars = { player: db.PlayerRow; game: db.GameRow; team: db.TeamRow };
type Ctx = { Bindings: AppEnv; Variables: Vars };

export const playerRoutes = new Hono<Ctx>();

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const NAME_MAX = 40;

const NAME_ADJ = ['Curious', 'Sneaky', 'Bouncy', 'Sleepy', 'Mighty', 'Giggly', 'Speedy', 'Fuzzy', 'Brave', 'Cheeky', 'Dizzy', 'Jolly', 'Wobbly', 'Zippy', 'Snappy', 'Sunny'];
const NAME_ANIMAL = ['Capybara', 'Sloth', 'Meerkat', 'Penguin', 'Giraffe', 'Zebra', 'Hippo', 'Lemur', 'Otter', 'Toucan', 'Red Panda', 'Gorilla', 'Flamingo', 'Sea Lion', 'Tiger', 'Peacock'];
/** "Curious Capybara" style names for players who don't type one. */
export function randomPlayerName(): string {
	const pick = (arr: readonly string[]) => arr[Math.floor(Math.random() * arr.length)];
	return `${pick(NAME_ADJ)} ${pick(NAME_ANIMAL)}`;
}

export const requirePlayer = createMiddleware<Ctx>(async (c, next) => {
	const auth = c.req.header('Authorization') ?? '';
	const token = auth.startsWith('Bearer ') ? auth.slice(7) : c.req.query('token');
	const claims = await verify<PlayerClaims>(token, c.env.SESSION_SECRET);
	if (!claims) return c.json({ error: 'Unauthorized' }, 401);
	const player = await c.env.DB.prepare('SELECT * FROM players WHERE id = ?').bind(claims.sub).first<db.PlayerRow>();
	if (!player) return c.json({ error: 'Unauthorized' }, 401);
	const [game, team] = await Promise.all([db.getGame(c.env.DB, player.game_id), db.getTeam(c.env.DB, player.team_id)]);
	if (!game || !team) return c.json({ error: 'Unauthorized' }, 401);
	c.set('player', player);
	c.set('game', game);
	c.set('team', team);
	c.executionCtx.waitUntil(
		c.env.DB.prepare('UPDATE players SET last_seen_at = ? WHERE id = ?').bind(db.now(), player.id).run(),
	);
	await next();
});

async function bootstrap(d1: D1Database, game: db.GameRow, player: db.PlayerRow, team: db.TeamRow) {
	const [players, clues, board, bonus, submissions] = await Promise.all([
		d1
			.prepare('SELECT id, name, is_leader FROM players WHERE team_id = ? ORDER BY created_at')
			.bind(team.id)
			.all<{ id: string; name: string; is_leader: number }>(),
		db.cluesForTeam(d1, game.id, team.id),
		db.leaderboard(d1, game.id),
		d1
			.prepare(`SELECT id, title, description, points FROM bonus_challenges WHERE game_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1`)
			.bind(game.id)
			.first<{ id: string; title: string; description: string; points: number }>(),
		d1
			.prepare('SELECT id, clue_id, status, points_awarded, r2_key, created_at FROM submissions WHERE team_id = ? ORDER BY created_at DESC')
			.bind(team.id)
			.all<Pick<db.SubmissionRow, 'id' | 'clue_id' | 'status' | 'points_awarded' | 'r2_key' | 'created_at'>>(),
	]);
	const mine = board.find((t) => t.id === team.id);
	return {
		game: {
			id: game.id,
			code: game.code,
			name: game.name,
			status: game.status,
			starts_at: game.starts_at,
			ends_at: game.ends_at,
			approval_mode: game.approval_mode,
		},
		player: { id: player.id, name: player.name, is_leader: player.is_leader === 1 },
		team: { id: team.id, name: team.name, color: team.color, avatar: team.avatar },
		players: players.results.map((p) => ({ ...p, is_leader: p.is_leader === 1 })),
		clues,
		leaderboard: board,
		bonus: bonus ?? null,
		submissions: submissions.results.map((s) => ({ ...s, photo_url: db.photoUrl(s.r2_key) })),
		stats: {
			points: mine?.points ?? 0,
			rank: mine?.rank ?? null,
			clues_found: mine?.clues_found ?? 0,
			photos_submitted: mine?.photos_submitted ?? 0,
			clues_total: clues.length,
		},
	};
}

async function publicGame(d1: D1Database, game: db.GameRow) {
	const teams = await d1
		.prepare(
			`SELECT t.id, t.name, t.color, t.avatar, (SELECT COUNT(*) FROM players p WHERE p.team_id = t.id) AS players
			 FROM teams t WHERE t.game_id = ? ORDER BY t.created_at`,
		)
		.bind(game.id)
		.all<{ id: string; name: string; color: string; avatar: string; players: number }>();
	return {
		game: { id: game.id, code: game.code, name: game.name, status: game.status },
		teams: teams.results,
		colors: TEAM_COLORS,
	};
}

/** Public: the game players should join today — the most recently created live game (then draft). */
playerRoutes.get('/games/current', async (c) => {
	const game =
		(await c.env.DB.prepare(`SELECT * FROM games WHERE status = 'live' ORDER BY created_at DESC LIMIT 1`).first<db.GameRow>()) ??
		(await c.env.DB.prepare(`SELECT * FROM games WHERE status = 'draft' ORDER BY created_at DESC LIMIT 1`).first<db.GameRow>());
	if (!game) return c.json({ error: 'No game is running right now' }, 404);
	return c.json(await publicGame(c.env.DB, game));
});

/** Public: look up a game by code so the join screen can list teams. */
playerRoutes.get('/games/:code', async (c) => {
	const game = await db.getGameByCode(c.env.DB, c.req.param('code'));
	if (!game) return c.json({ error: 'No game with that code' }, 404);
	return c.json(await publicGame(c.env.DB, game));
});

playerRoutes.post('/join', async (c) => {
	const body = await c.req.json<{ code?: string; playerName?: string; teamId?: string; teamName?: string; color?: string }>().catch(() => null);
	if (!body) return c.json({ error: 'Invalid JSON' }, 400);
	const code = (body.code ?? '').trim().toUpperCase();
	// Players don't type a name — they get a fun random one the host can change in HQ.
	const playerName = (body.playerName ?? '').trim() || randomPlayerName();
	if (!code) return c.json({ error: 'code is required' }, 400);
	if (playerName.length > NAME_MAX) return c.json({ error: `Name must be ${NAME_MAX} characters or fewer` }, 400);

	const game = await db.getGameByCode(c.env.DB, code);
	if (!game) return c.json({ error: 'No game with that code' }, 404);
	if (game.status === 'ended') return c.json({ error: 'This game has ended' }, 410);

	let team: db.TeamRow | null = null;
	let isLeader = 0;
	if (body.teamId) {
		team = await c.env.DB.prepare('SELECT * FROM teams WHERE id = ? AND game_id = ?').bind(body.teamId, game.id).first<db.TeamRow>();
		if (!team) return c.json({ error: 'Team not found' }, 404);
	} else {
		const teamName = (body.teamName ?? '').trim();
		if (!teamName) return c.json({ error: 'teamName or teamId is required' }, 400);
		if (teamName.length > NAME_MAX) return c.json({ error: `Team name must be ${NAME_MAX} characters or fewer` }, 400);
		const count = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM teams WHERE game_id = ?').bind(game.id).first<{ n: number }>();
		const color = (TEAM_COLORS as readonly string[]).includes(body.color ?? '') ? body.color! : TEAM_COLORS[(count?.n ?? 0) % TEAM_COLORS.length];
		team = { id: db.uid(), game_id: game.id, name: teamName, color, avatar: 'monkey', created_at: db.now() };
		try {
			await c.env.DB.prepare('INSERT INTO teams (id, game_id, name, color, avatar, created_at) VALUES (?, ?, ?, ?, ?, ?)')
				.bind(team.id, team.game_id, team.name, team.color, team.avatar, team.created_at)
				.run();
		} catch (err) {
			if (String(err).includes('UNIQUE')) return c.json({ error: 'That team name is taken' }, 409);
			throw err;
		}
		isLeader = 1;
		await db.logActivity(c.env.DB, game.id, 'team_joined', `${team.name} joined the hunt`);
	}

	const player: db.PlayerRow = {
		id: db.uid(),
		game_id: game.id,
		team_id: team.id,
		name: playerName,
		is_leader: isLeader,
		created_at: db.now(),
		last_seen_at: db.now(),
	};
	await c.env.DB.prepare(
		'INSERT INTO players (id, game_id, team_id, name, is_leader, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
	)
		.bind(player.id, player.game_id, player.team_id, player.name, player.is_leader, player.created_at, player.last_seen_at)
		.run();

	const token = await sign({ sub: player.id, game: game.id, team: team.id } satisfies PlayerClaims, c.env.SESSION_SECRET);
	await emit(c.env, game.id, { type: 'leaderboard', reason: 'join', teamId: team.id });
	return c.json({ token, ...(await bootstrap(c.env.DB, game, player, team)) }, 201);
});

playerRoutes.get('/me', requirePlayer, async (c) => {
	return c.json(await bootstrap(c.env.DB, c.get('game'), c.get('player'), c.get('team')));
});

playerRoutes.get('/leaderboard', requirePlayer, async (c) => {
	return c.json({ leaderboard: await db.leaderboard(c.env.DB, c.get('game').id) });
});

playerRoutes.patch('/team', requirePlayer, async (c) => {
	const player = c.get('player');
	const team = c.get('team');
	if (player.is_leader !== 1) return c.json({ error: 'Only the team leader can rename the team' }, 403);
	const body = await c.req.json<{ name?: string; color?: string }>().catch(() => null);
	const name = (body?.name ?? team.name).trim();
	const color = (TEAM_COLORS as readonly string[]).includes(body?.color ?? '') ? body!.color! : team.color;
	if (!name || name.length > NAME_MAX) return c.json({ error: 'Invalid team name' }, 400);
	try {
		await c.env.DB.prepare('UPDATE teams SET name = ?, color = ? WHERE id = ?').bind(name, color, team.id).run();
	} catch (err) {
		if (String(err).includes('UNIQUE')) return c.json({ error: 'That team name is taken' }, 409);
		throw err;
	}
	await emit(c.env, team.game_id, { type: 'team_updated', teamId: team.id });
	return c.json({ team: { id: team.id, name, color, avatar: team.avatar } });
});

playerRoutes.post('/submissions', requirePlayer, async (c) => {
	const game = c.get('game');
	const team = c.get('team');
	const player = c.get('player');
	if (game.status !== 'live') return c.json({ error: 'The game is not live' }, 409);

	const form = await c.req.parseBody().catch(() => null);
	if (!form) return c.json({ error: 'Expected multipart form data' }, 400);
	const clueId = String(form.clueId ?? '');
	const photo = form.photo;
	if (!(photo instanceof File)) return c.json({ error: 'photo file is required' }, 400);
	if (!photo.type.startsWith('image/')) return c.json({ error: 'photo must be an image' }, 415);
	if (photo.size === 0) return c.json({ error: 'photo is empty' }, 400);
	if (photo.size > MAX_PHOTO_BYTES) return c.json({ error: 'photo is too large (max 10 MB)' }, 413);

	const clue = await c.env.DB.prepare('SELECT * FROM clues WHERE id = ? AND game_id = ?').bind(clueId, game.id).first<db.ClueRow>();
	if (!clue) return c.json({ error: 'Clue not found' }, 404);
	if (clue.status !== 'available') return c.json({ error: 'That clue is locked' }, 409);

	const existing = await c.env.DB.prepare(
		`SELECT id, status FROM submissions WHERE team_id = ? AND clue_id = ? AND status <> 'rejected'`,
	)
		.bind(team.id, clue.id)
		.first<{ id: string; status: db.SubmissionStatus }>();
	if (existing) return c.json({ error: `Your team already has a ${existing.status} photo for this clue`, status: existing.status }, 409);

	const id = db.uid();
	const ext = photo.type === 'image/png' ? 'png' : photo.type === 'image/webp' ? 'webp' : 'jpg';
	const key = `games/${game.id}/${team.id}/${clue.id}/${id}.${ext}`;
	await c.env.PHOTOS.put(key, await photo.arrayBuffer(), { httpMetadata: { contentType: photo.type } });

	const auto = game.approval_mode === 'auto';
	const t = db.now();
	const status: db.SubmissionStatus = auto ? 'approved' : 'pending';
	const pointsAwarded = auto ? clue.points : 0;
	try {
		await c.env.DB.prepare(
			`INSERT INTO submissions (id, game_id, team_id, clue_id, player_id, r2_key, status, points_awarded, reviewed_by, reviewed_at, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		)
			.bind(id, game.id, team.id, clue.id, player.id, key, status, pointsAwarded, auto ? 'auto' : null, auto ? t : null, t)
			.run();
	} catch (err) {
		if (String(err).includes('UNIQUE')) return c.json({ error: 'Your team already submitted this clue' }, 409);
		throw err;
	}

	if (auto) {
		await db.addScore(c.env.DB, {
			gameId: game.id,
			teamId: team.id,
			delta: clue.points,
			reason: `Approved photo: ${clue.title}`,
			source: 'submission',
			refId: id,
			createdBy: 'auto',
		});
		await db.logActivity(c.env.DB, game.id, 'photo_approved', `${team.name} found ${clue.title} (+${clue.points} pts)`);
		await emit(c.env, game.id, { type: 'submission_reviewed', teamId: team.id, clueId: clue.id, submissionId: id, status, points: clue.points });
	} else {
		await db.logActivity(c.env.DB, game.id, 'photo_submitted', `${team.name} submitted a photo for ${clue.title}`);
		await emit(c.env, game.id, { type: 'submission_created', teamId: team.id, clueId: clue.id, submissionId: id });
	}

	return c.json(
		{
			submission: { id, clue_id: clue.id, status, points_awarded: pointsAwarded, photo_url: db.photoUrl(key), created_at: t },
			points_awarded: pointsAwarded,
		},
		201,
	);
});

/** Photos are public-read behind unguessable keys. */
playerRoutes.get('/photos/*', async (c) => {
	const key = decodeURIComponent(c.req.path.replace(/^\/api\/photos\//, ''));
	if (!key) return c.json({ error: 'Not found' }, 404);
	const obj = await c.env.PHOTOS.get(key);
	if (!obj) return c.json({ error: 'Not found' }, 404);
	const headers = new Headers();
	headers.set('Content-Type', obj.httpMetadata?.contentType ?? 'image/jpeg');
	headers.set('Cache-Control', 'public, max-age=31536000, immutable');
	headers.set('ETag', obj.httpEtag);
	return new Response(obj.body, { headers });
});
