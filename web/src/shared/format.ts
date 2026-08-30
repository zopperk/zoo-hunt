import type { TeamClueStatus, LeaderboardEntry } from './api';

export function formatPoints(n: number): string {
	return new Intl.NumberFormat('en-US').format(n);
}

export function signed(n: number): string {
	return n > 0 ? `+${formatPoints(n)}` : formatPoints(n);
}

export function clueStatusLabel(status: TeamClueStatus): string {
	switch (status) {
		case 'complete':
			return 'Found';
		case 'pending':
			return 'In review';
		case 'available':
			return 'Open';
		default:
			return 'Locked';
	}
}

export function clueStatusIcon(status: TeamClueStatus): string {
	switch (status) {
		case 'complete':
			return '✓';
		case 'pending':
			return '📷';
		case 'available':
			return '?';
		default:
			return '🔒';
	}
}

/** Rank position for a team, honouring ties on points (1, 2, 2, 4). */
export function rankWithTies(board: Pick<LeaderboardEntry, 'id' | 'points'>[]): Map<string, number> {
	const sorted = [...board].sort((a, b) => b.points - a.points);
	const ranks = new Map<string, number>();
	let rank = 0;
	let prev: number | null = null;
	sorted.forEach((t, i) => {
		if (t.points !== prev) {
			rank = i + 1;
			prev = t.points;
		}
		ranks.set(t.id, rank);
	});
	return ranks;
}

export function timeAgo(ms: number, now = Date.now()): string {
	const s = Math.max(0, Math.round((now - ms) / 1000));
	if (s < 45) return 'just now';
	const m = Math.round(s / 60);
	if (m < 60) return `${m}m ago`;
	const h = Math.round(m / 60);
	if (h < 24) return `${h}h ago`;
	return `${Math.round(h / 24)}d ago`;
}

export function clock(ms: number | null | undefined): string {
	if (!ms) return '—';
	return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export const isValidTeamName = (s: string) => s.trim().length > 0 && s.trim().length <= 40;
export const normalizeCode = (s: string) => s.trim().toUpperCase().replace(/\s+/g, '');
