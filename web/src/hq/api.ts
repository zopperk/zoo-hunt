import { request, type GameStatus, type LeaderboardEntry, type SubmissionStatus, type TeamClue } from '../shared/api';

export interface Game {
	id: string;
	code: string;
	name: string;
	status: GameStatus;
	starts_at: number | null;
	ends_at: number | null;
	default_points: number;
	approval_mode: 'manual' | 'auto';
	created_at: number;
}
export interface Stats {
	teams: number;
	players: number;
	clues_total: number;
	clues_completed: number;
	photos_pending: number;
}
export interface Activity {
	id: string;
	type: string;
	message: string;
	created_at: number;
}
export interface Overview {
	game: Game;
	stats: Stats;
	leaderboard: LeaderboardEntry[];
	activity: Activity[];
}
export interface AdminClue {
	id: string;
	sort_order: number;
	title: string;
	body: string;
	animal: string;
	points: number;
	status: 'locked' | 'available';
	release_at: number | null;
	map_x: number | null;
	map_y: number | null;
	photos: number;
	completions: number;
}
export interface AdminSubmission {
	id: string;
	team_id: string;
	clue_id: string;
	status: SubmissionStatus;
	points_awarded: number;
	photo_url: string;
	created_at: number;
	reviewed_at: number | null;
	clue_title: string;
	clue_order: number;
	clue_points: number;
	team_name: string;
	team_color: string;
	player_name: string | null;
}
export interface ScoreEvent {
	id: string;
	team_id: string;
	delta: number;
	reason: string;
	source: string;
	created_by: string;
	created_at: number;
	team_name?: string;
}
export interface Bonus {
	id: string;
	title: string;
	description: string;
	points: number;
	status: 'active' | 'inactive';
	created_at: number;
}
export interface TeamDetail {
	team: { id: string; name: string; color: string; avatar: string; game_id: string };
	points: number;
	players: { id: string; name: string; is_leader: number; last_seen_at: number }[];
	submissions: (AdminSubmission & { clue_points: number })[];
	score_log: ScoreEvent[];
	clues: TeamClue[];
}

const a = <T,>(path: string, init: RequestInit = {}) => request<T>(`/api/admin${path}`, init, 'admin');
const post = (body?: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body ?? {}) });
const patch = (body: unknown): RequestInit => ({ method: 'PATCH', body: JSON.stringify(body) });

export const adminApi = {
	login: (password: string) => a<{ ok: true; token: string }>('/login', post({ password })),
	logout: () => a('/logout', post()),
	session: () => a<{ ok: true }>('/session'),

	games: () => a<{ games: Game[] }>('/games'),
	createGame: (body: Record<string, unknown>) => a<{ game: Game }>('/games', post(body)),
	overview: (id: string) => a<Overview>(`/games/${id}`),
	patchGame: (id: string, body: Record<string, unknown>) => a<{ game: Game }>(`/games/${id}`, patch(body)),
	regenerateCode: (id: string) => a<{ game: Game }>(`/games/${id}/regenerate-code`, post()),

	teams: (id: string) => a<{ teams: LeaderboardEntry[] }>(`/games/${id}/teams`),
	addTeam: (id: string, body: { name: string; color?: string }) => a(`/games/${id}/teams`, post(body)),
	team: (teamId: string) => a<TeamDetail>(`/teams/${teamId}`),
	patchTeam: (teamId: string, body: { name?: string; color?: string }) => a(`/teams/${teamId}`, patch(body)),
	patchPlayer: (playerId: string, body: { name?: string; isLeader?: boolean }) => a(`/players/${playerId}`, patch(body)),
	deletePlayer: (playerId: string) => a(`/players/${playerId}`, { method: 'DELETE' }),
	deleteTeam: (teamId: string) => a(`/teams/${teamId}`, { method: 'DELETE' }),

	clues: (id: string) => a<{ clues: AdminClue[] }>(`/games/${id}/clues`),
	addClue: (id: string, body: Record<string, unknown>) => a<{ clue: AdminClue }>(`/games/${id}/clues`, post(body)),
	patchClue: (clueId: string, body: Record<string, unknown>) => a(`/clues/${clueId}`, patch(body)),
	deleteClue: (clueId: string) => a(`/clues/${clueId}`, { method: 'DELETE' }),
	releaseNext: (id: string) => a<{ clue: AdminClue }>(`/games/${id}/clues/release-next`, post()),
	releaseAll: (id: string) => a<{ released: number }>(`/games/${id}/clues/release-all`, post()),
	lockAll: (id: string) => a<{ locked: number }>(`/games/${id}/clues/lock-all`, post()),
	schedule: (clueId: string, releaseAt: string | number) => a(`/clues/${clueId}/schedule`, post({ releaseAt })),

	submissions: (id: string, status?: SubmissionStatus) => a<{ submissions: AdminSubmission[] }>(`/games/${id}/submissions${status ? `?status=${status}` : ''}`),
	approve: (subId: string, bonus = 0) => a<{ ok: true; points_awarded: number }>(`/submissions/${subId}/approve`, post({ bonus })),
	reject: (subId: string, reason?: string) => a(`/submissions/${subId}/reject`, post({ reason })),
	markAllReviewed: (id: string) => a<{ approved: number }>(`/games/${id}/submissions/mark-all-reviewed`, post()),

	adjust: (id: string, body: { teamId: string; delta: number; reason: string }) => a<{ points: number }>(`/games/${id}/scores/adjust`, post(body)),
	scoreLog: (id: string) => a<{ log: ScoreEvent[] }>(`/games/${id}/scores/log`),

	bonuses: (id: string) => a<{ bonuses: Bonus[] }>(`/games/${id}/bonus`),
	addBonus: (id: string, body: Record<string, unknown>) => a<{ bonus: Bonus }>(`/games/${id}/bonus`, post(body)),
	patchBonus: (bonusId: string, body: Record<string, unknown>) => a(`/bonus/${bonusId}`, patch(body)),
	awardBonus: (bonusId: string, teamId: string) => a<{ points: number }>(`/bonus/${bonusId}/award`, post({ teamId })),

	activity: (id: string) => a<{ activity: Activity[] }>(`/games/${id}/activity`),
};
