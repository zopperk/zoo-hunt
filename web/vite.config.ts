/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
	plugins: [react()],
	server: {
		port: 5173,
		proxy: {
			'/api': 'http://localhost:8787',
			'/ws': { target: 'ws://localhost:8787', ws: true },
		},
	},
	build: {
		sourcemap: true,
	},
	test: {
		environment: 'jsdom',
		globals: true,
		setupFiles: ['./src/test-setup.ts'],
		include: ['src/**/*.test.{ts,tsx}'],
		css: false,
	},
});
