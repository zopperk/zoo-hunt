/** Worker bindings (generated in worker-configuration.d.ts) plus secrets. */
export type AppEnv = Env & {
	ADMIN_PASSWORD: string;
	SESSION_SECRET: string;
};

/** Signed into a player's bearer token. */
export interface PlayerClaims {
	sub: string; // player id
	game: string;
	team: string;
}

export interface AdminClaims {
	role: 'admin';
	exp: number;
}

export const TEAM_COLORS = ['yellow', 'green', 'blue', 'red', 'purple', 'orange'] as const;
export type TeamColor = (typeof TEAM_COLORS)[number];
