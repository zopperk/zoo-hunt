import type { AppEnv } from './types';
import type { RoomEvent } from './room';

/** Fire-and-forget broadcast to a game's room from a request handler. */
export async function emit(env: AppEnv, gameId: string, event: RoomEvent): Promise<void> {
	try {
		const stub = env.GAME_ROOM.get(env.GAME_ROOM.idFromName(gameId));
		await stub.broadcast(event);
	} catch (err) {
		console.error('broadcast failed', err);
	}
}

export function room(env: AppEnv, gameId: string) {
	return env.GAME_ROOM.get(env.GAME_ROOM.idFromName(gameId));
}
