import { describe, it, expect } from 'vitest';
import { formatPoints, signed, clueStatusLabel, clueStatusIcon, rankWithTies, timeAgo, isValidTeamName, normalizeCode } from './format';

describe('formatPoints / signed', () => {
	it('adds thousands separators', () => {
		expect(formatPoints(1640)).toBe('1,640');
		expect(formatPoints(0)).toBe('0');
	});
	it('signs deltas', () => {
		expect(signed(150)).toBe('+150');
		expect(signed(-25)).toBe('-25');
		expect(signed(0)).toBe('0');
	});
});

describe('clue status mapping', () => {
	it.each([
		['complete', 'Found', '✓'],
		['pending', 'In review', '📷'],
		['available', 'Open', '?'],
		['locked', 'Locked', '🔒'],
	] as const)('%s → %s %s', (status, label, icon) => {
		expect(clueStatusLabel(status)).toBe(label);
		expect(clueStatusIcon(status)).toBe(icon);
	});
});

describe('rankWithTies', () => {
	it('gives tied teams the same rank and skips the next', () => {
		const ranks = rankWithTies([
			{ id: 'a', points: 300 },
			{ id: 'b', points: 300 },
			{ id: 'c', points: 100 },
			{ id: 'd', points: 0 },
		]);
		expect([...ranks.entries()]).toEqual([
			['a', 1],
			['b', 1],
			['c', 3],
			['d', 4],
		]);
	});
	it('handles unsorted input and empty boards', () => {
		const ranks = rankWithTies([
			{ id: 'low', points: 5 },
			{ id: 'high', points: 50 },
		]);
		expect(ranks.get('high')).toBe(1);
		expect(ranks.get('low')).toBe(2);
		expect(rankWithTies([]).size).toBe(0);
	});
});

describe('timeAgo', () => {
	const now = 1_000_000_000;
	it('buckets sensibly', () => {
		expect(timeAgo(now - 10_000, now)).toBe('just now');
		expect(timeAgo(now - 3 * 60_000, now)).toBe('3m ago');
		expect(timeAgo(now - 2 * 3_600_000, now)).toBe('2h ago');
		expect(timeAgo(now - 3 * 86_400_000, now)).toBe('3d ago');
	});
});

describe('validation helpers', () => {
	it('validates team names', () => {
		expect(isValidTeamName('  ')).toBe(false);
		expect(isValidTeamName('Banana Bunch')).toBe(true);
		expect(isValidTeamName('x'.repeat(41))).toBe(false);
	});
	it('normalizes game codes', () => {
		expect(normalizeCode(' zoo-2929 ')).toBe('ZOO-2929');
		expect(normalizeCode('zoo 29 29')).toBe('ZOO2929');
	});
});
