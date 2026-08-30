import type { D1Migration } from 'cloudflare:test';

// `env` from cloudflare:test is typed as Cloudflare.Env; add the test-only bindings from vitest.config.mts.
declare global {
	namespace Cloudflare {
		interface Env {
			TEST_MIGRATIONS: D1Migration[];
			ADMIN_PASSWORD: string;
			SESSION_SECRET: string;
		}
	}
}

export {};
