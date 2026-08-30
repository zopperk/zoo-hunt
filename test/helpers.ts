import { SELF } from 'cloudflare:test';

export const BASE = 'http://zoo.test';
export const ADMIN_PASSWORD = 'test-admin';

export interface ApiResult<T = any> {
	status: number;
	body: T;
	headers: Headers;
}

export async function api<T = any>(path: string, init: RequestInit = {}, headers: Record<string, string> = {}): Promise<ApiResult<T>> {
	const h = new Headers(init.headers);
	for (const [k, v] of Object.entries(headers)) h.set(k, v);
	if (init.body && typeof init.body === 'string' && !h.has('content-type')) h.set('content-type', 'application/json');
	const res = await SELF.fetch(BASE + path, { ...init, headers: h });
	const text = await res.text();
	let body: any = text;
	try {
		body = JSON.parse(text);
	} catch {
		/* non-JSON */
	}
	return { status: res.status, body, headers: res.headers };
}

export const json = (o: unknown) => JSON.stringify(o);

export async function adminHeaders(): Promise<Record<string, string>> {
	const r = await api('/api/admin/login', { method: 'POST', body: json({ password: ADMIN_PASSWORD }) });
	if (r.status !== 200) throw new Error(`admin login failed: ${r.status} ${JSON.stringify(r.body)}`);
	return { Authorization: `Bearer ${r.body.token}` };
}

export async function createGame(admin: Record<string, string>, overrides: Record<string, unknown> = {}) {
	const r = await api('/api/admin/games', { method: 'POST', body: json({ name: 'Test Hunt', status: 'live', ...overrides }) }, admin);
	if (r.status !== 201) throw new Error(`createGame failed: ${r.status} ${JSON.stringify(r.body)}`);
	return r.body.game as { id: string; code: string; name: string; status: string; default_points: number; approval_mode: string };
}

export async function addClue(admin: Record<string, string>, gameId: string, overrides: Record<string, unknown> = {}) {
	const r = await api(
		`/api/admin/games/${gameId}/clues`,
		{ method: 'POST', body: json({ title: 'A clue', body: 'Find the thing', animal: 'thing', status: 'available', ...overrides }) },
		admin,
	);
	if (r.status !== 201) throw new Error(`addClue failed: ${r.status} ${JSON.stringify(r.body)}`);
	return r.body.clue as { id: string; title: string; points: number; status: string; sort_order: number };
}

export async function join(code: string, playerName: string, team: { teamName?: string; teamId?: string; color?: string }) {
	const r = await api('/api/join', { method: 'POST', body: json({ code, playerName, ...team }) });
	if (r.status !== 201) throw new Error(`join failed: ${r.status} ${JSON.stringify(r.body)}`);
	return r.body as { token: string; team: { id: string; name: string; color: string }; player: { id: string; is_leader: boolean } } & Record<string, any>;
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/** A tiny but valid-looking JPEG (SOI + EOI markers). */
export function photoFile(name = 'find.jpg', type = 'image/jpeg', bytes: number[] = [0xff, 0xd8, 0xff, 0xd9]) {
	return new File([new Uint8Array(bytes)], name, { type });
}

export async function submitPhoto(token: string, clueId: string, file: File = photoFile()) {
	const fd = new FormData();
	fd.set('clueId', clueId);
	fd.set('photo', file);
	return api('/api/submissions', { method: 'POST', body: fd }, bearer(token));
}

/** Full happy-path fixture: live game, one available clue, one team with one player. */
export async function fixture(gameOverrides: Record<string, unknown> = {}) {
	const admin = await adminHeaders();
	const game = await createGame(admin, gameOverrides);
	const clue = await addClue(admin, game.id, { title: 'Lunch in the Trees', animal: 'giraffe', points: 150 });
	const player = await join(game.code, 'Alex', { teamName: 'Banana Bunch', color: 'yellow' });
	return { admin, game, clue, player };
}
