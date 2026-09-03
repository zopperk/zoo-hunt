/** Typed D1 helpers. Team score is always derived from the score_events ledger. */

export type GameStatus = 'draft' | 'live' | 'ended';
export type ApprovalMode = 'manual' | 'auto';
export type ClueStatus = 'locked' | 'available';
export type SubmissionStatus = 'pending' | 'approved' | 'rejected';
export type ScoreSource = 'submission' | 'adjust' | 'bonus' | 'hint';

export interface GameRow {
	id: string;
	code: string;
	name: string;
	status: GameStatus;
	starts_at: number | null;
	ends_at: number | null;
	default_points: number;
	approval_mode: ApprovalMode;
	created_at: number;
}
export interface TeamRow {
	id: string;
	game_id: string;
	name: string;
	color: string;
	avatar: string;
	created_at: number;
}
export interface PlayerRow {
	id: string;
	game_id: string;
	team_id: string;
	name: string;
	is_leader: number;
	created_at: number;
	last_seen_at: number;
}
export interface ClueRow {
	id: string;
	game_id: string;
	sort_order: number;
	title: string;
	body: string;
	animal: string;
	points: number;
	status: ClueStatus;
	release_at: number | null;
	map_x: number | null;
	map_y: number | null;
}
export interface SubmissionRow {
	id: string;
	game_id: string;
	team_id: string;
	clue_id: string;
	player_id: string | null;
	r2_key: string;
	status: SubmissionStatus;
	points_awarded: number;
	ai_verdict: string | null;
	reviewed_by: string | null;
	reviewed_at: number | null;
	created_at: number;
}
export interface ScoreEventRow {
	id: string;
	game_id: string;
	team_id: string;
	delta: number;
	reason: string;
	source: ScoreSource;
	ref_id: string | null;
	created_by: string;
	created_at: number;
}
export interface BonusRow {
	id: string;
	game_id: string;
	title: string;
	description: string;
	points: number;
	status: 'active' | 'inactive';
	r2_key: string | null;
	created_at: number;
}
export interface ActivityRow {
	id: string;
	game_id: string;
	type: string;
	message: string;
	created_at: number;
}

export interface LeaderboardEntry {
	id: string;
	name: string;
	color: string;
	avatar: string;
	points: number;
	clues_found: number;
	photos_submitted: number;
	players: number;
	rank: number;
}

/** Clue as seen by one team: game-wide lock state + that team's submission state. */
export type TeamClueStatus = 'locked' | 'available' | 'pending' | 'complete';
export interface TeamClue {
	id: string;
	sort_order: number;
	title: string;
	body: string | null; // null while locked
	animal: string | null;
	points: number;
	status: TeamClueStatus;
	submission_id: string | null;
	photo_url: string | null; // the team's approved photo, once the clue is found
	map_x: number | null;
	map_y: number | null;
}

export const now = () => Date.now();
export const uid = () => crypto.randomUUID();

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function genCode(): string {
	let s = '';
	for (let i = 0; i < 4; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
	return `ZOO-${s}`;
}

export async function getGame(db: D1Database, id: string): Promise<GameRow | null> {
	return db.prepare('SELECT * FROM games WHERE id = ?').bind(id).first<GameRow>();
}
export async function getGameByCode(db: D1Database, code: string): Promise<GameRow | null> {
	return db.prepare('SELECT * FROM games WHERE code = ?').bind(code.trim().toUpperCase()).first<GameRow>();
}
export async function getTeam(db: D1Database, id: string): Promise<TeamRow | null> {
	return db.prepare('SELECT * FROM teams WHERE id = ?').bind(id).first<TeamRow>();
}
export async function getClue(db: D1Database, id: string): Promise<ClueRow | null> {
	return db.prepare('SELECT * FROM clues WHERE id = ?').bind(id).first<ClueRow>();
}
export async function getSubmission(db: D1Database, id: string): Promise<SubmissionRow | null> {
	return db.prepare('SELECT * FROM submissions WHERE id = ?').bind(id).first<SubmissionRow>();
}

export async function teamScore(db: D1Database, teamId: string): Promise<number> {
	const row = await db.prepare('SELECT COALESCE(SUM(delta), 0) AS points FROM score_events WHERE team_id = ?').bind(teamId).first<{ points: number }>();
	return row?.points ?? 0;
}

export async function leaderboard(db: D1Database, gameId: string): Promise<LeaderboardEntry[]> {
	const { results } = await db
		.prepare(
			`SELECT t.id, t.name, t.color, t.avatar,
			        COALESCE((SELECT SUM(e.delta) FROM score_events e WHERE e.team_id = t.id), 0) AS points,
			        (SELECT COUNT(*) FROM submissions s WHERE s.team_id = t.id AND s.status = 'approved') AS clues_found,
			        (SELECT COUNT(*) FROM submissions s WHERE s.team_id = t.id AND s.status <> 'rejected') AS photos_submitted,
			        (SELECT COUNT(*) FROM players p WHERE p.team_id = t.id) AS players
			 FROM teams t
			 WHERE t.game_id = ?
			 ORDER BY points DESC, clues_found DESC, t.created_at ASC`,
		)
		.bind(gameId)
		.all<Omit<LeaderboardEntry, 'rank'>>();
	return results.map((r, i) => ({ ...r, rank: i + 1 }));
}

export async function cluesForTeam(db: D1Database, gameId: string, teamId: string): Promise<TeamClue[]> {
	const { results } = await db
		.prepare(
			`SELECT c.id, c.sort_order, c.title, c.body, c.animal, c.points, c.status, c.map_x, c.map_y,
			        s.status AS sub_status, s.id AS submission_id, s.r2_key AS r2_key
			 FROM clues c
			 LEFT JOIN submissions s ON s.clue_id = c.id AND s.team_id = ? AND s.status <> 'rejected'
			 WHERE c.game_id = ?
			 ORDER BY c.sort_order ASC`,
		)
		.bind(teamId, gameId)
		.all<ClueRow & { sub_status: SubmissionStatus | null; submission_id: string | null; r2_key: string | null }>();
	return results.map((c) => {
		const status: TeamClueStatus =
			c.sub_status === 'approved' ? 'complete' : c.sub_status === 'pending' ? 'pending' : c.status;
		const locked = status === 'locked';
		// A pin gives the riddle away, so a clue's position is only sent once the
		// team has actually reached it — the map is a record, not an answer key.
		const reached = status === 'complete' || status === 'pending';
		return {
			id: c.id,
			sort_order: c.sort_order,
			title: c.title,
			body: locked ? null : c.body,
			animal: locked ? null : c.animal,
			points: c.points,
			status,
			submission_id: c.submission_id,
			photo_url: status === 'complete' && c.r2_key ? photoUrl(c.r2_key) : null,
			map_x: reached ? c.map_x : null,
			map_y: reached ? c.map_y : null,
		};
	});
}

export interface ScoreInput {
	gameId: string;
	teamId: string;
	delta: number;
	reason: string;
	source: ScoreSource;
	refId?: string | null;
	createdBy?: string;
}
export async function addScore(db: D1Database, s: ScoreInput): Promise<ScoreEventRow> {
	const row: ScoreEventRow = {
		id: uid(),
		game_id: s.gameId,
		team_id: s.teamId,
		delta: s.delta,
		reason: s.reason,
		source: s.source,
		ref_id: s.refId ?? null,
		created_by: s.createdBy ?? 'host',
		created_at: now(),
	};
	await db
		.prepare(
			'INSERT INTO score_events (id, game_id, team_id, delta, reason, source, ref_id, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
		)
		.bind(row.id, row.game_id, row.team_id, row.delta, row.reason, row.source, row.ref_id, row.created_by, row.created_at)
		.run();
	return row;
}

export async function logActivity(db: D1Database, gameId: string, type: string, message: string): Promise<void> {
	await db
		.prepare('INSERT INTO activity (id, game_id, type, message, created_at) VALUES (?, ?, ?, ?, ?)')
		.bind(uid(), gameId, type, message, now())
		.run();
}

export interface GameStats {
	teams: number;
	players: number;
	clues_total: number; // clues × teams
	clues_completed: number; // approved submissions
	photos_pending: number;
}
export async function gameStats(db: D1Database, gameId: string): Promise<GameStats> {
	const row = await db
		.prepare(
			`SELECT
			   (SELECT COUNT(*) FROM teams WHERE game_id = ?1) AS teams,
			   (SELECT COUNT(*) FROM players WHERE game_id = ?1) AS players,
			   (SELECT COUNT(*) FROM clues WHERE game_id = ?1) AS clues,
			   (SELECT COUNT(*) FROM submissions WHERE game_id = ?1 AND status = 'approved') AS clues_completed,
			   (SELECT COUNT(*) FROM submissions WHERE game_id = ?1 AND status = 'pending') AS photos_pending`,
		)
		.bind(gameId)
		.first<{ teams: number; players: number; clues: number; clues_completed: number; photos_pending: number }>();
	const r = row ?? { teams: 0, players: 0, clues: 0, clues_completed: 0, photos_pending: 0 };
	return {
		teams: r.teams,
		players: r.players,
		clues_total: r.clues * r.teams,
		clues_completed: r.clues_completed,
		photos_pending: r.photos_pending,
	};
}

export const photoUrl = (r2Key: string) => `/api/photos/${r2Key}`;
