import { describe, it, expect } from 'vitest';
import { sign, verify, timingSafeEqual } from '../src/auth';
import { api, json, adminHeaders, ADMIN_PASSWORD } from './helpers';

describe('token signing', () => {
	it('round-trips a payload', async () => {
		const token = await sign({ sub: 'p1', game: 'g1' }, 'secret');
		expect(await verify<{ sub: string }>(token, 'secret')).toMatchObject({ sub: 'p1', game: 'g1' });
	});

	it('rejects a tampered payload', async () => {
		const token = await sign({ sub: 'p1' }, 'secret');
		const [body, sig] = token.split('.');
		const forged = btoa(JSON.stringify({ sub: 'p2' })).replace(/=+$/, '') + '.' + sig;
		expect(await verify(forged, 'secret')).toBeNull();
		expect(await verify(body + '.AAAA', 'secret')).toBeNull();
	});

	it('rejects the wrong secret, garbage, and empty input', async () => {
		const token = await sign({ sub: 'p1' }, 'secret');
		expect(await verify(token, 'other')).toBeNull();
		expect(await verify('not-a-token', 'secret')).toBeNull();
		expect(await verify('', 'secret')).toBeNull();
		expect(await verify(undefined, 'secret')).toBeNull();
	});

	it('honours exp', async () => {
		const expired = await sign({ role: 'admin', exp: Date.now() - 1000 }, 'secret');
		const fresh = await sign({ role: 'admin', exp: Date.now() + 60_000 }, 'secret');
		expect(await verify(expired, 'secret')).toBeNull();
		expect(await verify(fresh, 'secret')).not.toBeNull();
	});

	it('timingSafeEqual compares correctly', () => {
		expect(timingSafeEqual('abc', 'abc')).toBe(true);
		expect(timingSafeEqual('abc', 'abd')).toBe(false);
		expect(timingSafeEqual('abc', 'abcd')).toBe(false);
	});
});

describe('admin auth', () => {
	it('login rejects a wrong or missing password', async () => {
		expect((await api('/api/admin/login', { method: 'POST', body: json({ password: 'nope' }) })).status).toBe(401);
		expect((await api('/api/admin/login', { method: 'POST', body: json({}) })).status).toBe(401);
	});

	it('login sets a cookie and returns a bearer token', async () => {
		const r = await api('/api/admin/login', { method: 'POST', body: json({ password: ADMIN_PASSWORD }) });
		expect(r.status).toBe(200);
		expect(r.body.token).toMatch(/^[\w-]+\.[\w-]+$/);
		expect(r.headers.get('set-cookie')).toMatch(/^zh_admin=.*HttpOnly/);
	});

	it('cookie auth works as well as bearer', async () => {
		const login = await api('/api/admin/login', { method: 'POST', body: json({ password: ADMIN_PASSWORD }) });
		const cookie = login.headers.get('set-cookie')!.split(';')[0];
		expect((await api('/api/admin/session', {}, { Cookie: cookie })).status).toBe(200);
	});

	const protectedRoutes: [string, string][] = [
		['GET', '/api/admin/session'],
		['GET', '/api/admin/games'],
		['POST', '/api/admin/games'],
		['GET', '/api/admin/games/x'],
		['PATCH', '/api/admin/games/x'],
		['GET', '/api/admin/games/x/teams'],
		['POST', '/api/admin/games/x/teams'],
		['GET', '/api/admin/games/x/clues'],
		['POST', '/api/admin/games/x/clues/release-next'],
		['GET', '/api/admin/games/x/submissions'],
		['POST', '/api/admin/submissions/x/approve'],
		['POST', '/api/admin/games/x/scores/adjust'],
		['GET', '/api/admin/games/x/activity'],
	];
	it.each(protectedRoutes)('%s %s requires admin', async (method, path) => {
		expect((await api(path, { method })).status).toBe(401);
		const player = await sign({ sub: 'p', game: 'g', team: 't' }, 'test-secret-do-not-use');
		expect((await api(path, { method }, { Authorization: `Bearer ${player}` })).status).toBe(401);
	});

	it('player routes reject missing, forged, and orphaned tokens', async () => {
		expect((await api('/api/me')).status).toBe(401);
		const forged = await sign({ sub: 'nobody', game: 'g', team: 't' }, 'wrong-secret');
		expect((await api('/api/me', {}, { Authorization: `Bearer ${forged}` })).status).toBe(401);
		const orphan = await sign({ sub: 'nobody', game: 'g', team: 't' }, 'test-secret-do-not-use');
		expect((await api('/api/me', {}, { Authorization: `Bearer ${orphan}` })).status).toBe(401);
	});

	it('logout clears the cookie', async () => {
		const admin = await adminHeaders();
		const r = await api('/api/admin/logout', { method: 'POST' }, admin);
		expect(r.status).toBe(200);
		expect(r.headers.get('set-cookie')).toMatch(/zh_admin=;/);
	});
});
