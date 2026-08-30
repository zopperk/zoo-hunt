/** Player-side API client + shared types. */

export type GameStatus = 'draft' | 'live' | 'ended';
export type TeamClueStatus = 'locked' | 'available' | 'pending' | 'complete';
export type SubmissionStatus = 'pending' | 'approved' | 'rejected';

export interface TeamClue {
	id: string;
	sort_order: number;
	title: string;
	body: string | null;
	animal: string | null;
	points: number;
	status: TeamClueStatus;
	submission_id: string | null;
	map_x: number | null;
	map_y: number | null;
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
export interface Submission {
	id: string;
	clue_id: string;
	status: SubmissionStatus;
	points_awarded: number;
	photo_url: string;
	created_at: number;
}
export interface Bootstrap {
	game: { id: string; code: string; name: string; status: GameStatus; starts_at: number | null; ends_at: number | null; approval_mode: 'manual' | 'auto' };
	player: { id: string; name: string; is_leader: boolean };
	team: { id: string; name: string; color: string; avatar: string };
	players: { id: string; name: string; is_leader: boolean }[];
	clues: TeamClue[];
	leaderboard: LeaderboardEntry[];
	bonus: { id: string; title: string; description: string; points: number } | null;
	submissions: Submission[];
	stats: { points: number; rank: number | null; clues_found: number; photos_submitted: number; clues_total: number };
}
export interface PublicGame {
	game: { id: string; code: string; name: string; status: GameStatus };
	teams: { id: string; name: string; color: string; avatar: string; players: number }[];
	colors: readonly string[];
}

export class ApiError extends Error {
	status: number;
	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

const TOKEN_KEY = 'zoo-hunt:token';
export const tokenStore = {
	get(): string | null {
		try {
			return localStorage.getItem(TOKEN_KEY);
		} catch {
			return null;
		}
	},
	set(token: string) {
		try {
			localStorage.setItem(TOKEN_KEY, token);
		} catch {
			/* private mode */
		}
	},
	clear() {
		try {
			localStorage.removeItem(TOKEN_KEY);
		} catch {
			/* ignore */
		}
	},
};

export async function request<T>(path: string, init: RequestInit = {}, auth: 'player' | 'admin' | 'none' = 'player'): Promise<T> {
	const headers = new Headers(init.headers);
	if (auth === 'player') {
		const token = tokenStore.get();
		if (token) headers.set('Authorization', `Bearer ${token}`);
	}
	if (init.body && typeof init.body === 'string' && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
	const res = await fetch(path, { ...init, headers, credentials: 'same-origin' });
	const text = await res.text();
	let data: any = null;
	try {
		data = text ? JSON.parse(text) : null;
	} catch {
		data = { error: text };
	}
	if (!res.ok) throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`);
	return data as T;
}

export const playerApi = {
	lookupGame: (code: string) => request<PublicGame>(`/api/games/${encodeURIComponent(code.trim().toUpperCase())}`, {}, 'none'),
	currentGame: () => request<PublicGame>('/api/games/current', {}, 'none'),
	join: (body: { code: string; playerName: string; teamId?: string; teamName?: string; color?: string }) =>
		request<Bootstrap & { token: string }>('/api/join', { method: 'POST', body: JSON.stringify(body) }, 'none'),
	me: () => request<Bootstrap>('/api/me'),
	renameTeam: (body: { name?: string; color?: string }) => request<{ team: Bootstrap['team'] }>('/api/team', { method: 'PATCH', body: JSON.stringify(body) }),
	submit: (clueId: string, photo: Blob, filename = 'find.jpg') => {
		const fd = new FormData();
		fd.set('clueId', clueId);
		fd.set('photo', photo, filename);
		return request<{ submission: Submission; points_awarded: number }>('/api/submissions', { method: 'POST', body: fd });
	},
};
