/**
 * Zoo Hunt Worker: JSON API under /api, WebSocket rooms under /ws, and the
 * Vite-built SPA (player app at /, Game Master HQ at /hq) served as static assets.
 */
import { Hono } from 'hono';
import type { AppEnv } from './types';
import { playerRoutes } from './api/player';
import { adminRoutes } from './api/admin';

export { GameRoom } from './room';

const app = new Hono<{ Bindings: AppEnv }>();

app.get('/api/health', (c) => c.json({ ok: true, at: Date.now() }));
app.route('/api/admin', adminRoutes);
app.route('/api', playerRoutes);

app.get('/ws/:gameId', async (c) => {
	if (c.req.header('Upgrade')?.toLowerCase() !== 'websocket') return c.text('Expected WebSocket upgrade', 426);
	const gameId = c.req.param('gameId');
	const game = await c.env.DB.prepare('SELECT id FROM games WHERE id = ?').bind(gameId).first();
	if (!game) return c.json({ error: 'Game not found' }, 404);
	const stub = c.env.GAME_ROOM.get(c.env.GAME_ROOM.idFromName(gameId));
	return stub.fetch(c.req.raw);
});

app.notFound((c) => c.json({ error: 'Not found' }, 404));
app.onError((err, c) => {
	console.error(err);
	return c.json({ error: 'Internal error' }, 500);
});

export default app;
