import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Bootstrap } from '../../shared/api';

// Mock the game context so the screen renders against fixed state.
// The leaderboard is deliberately NOT in rank order so the test proves the
// screen renders rows in the order the server ranked them.
const fixture: Bootstrap = {
	game: { id: 'g', code: 'ZOO-TEST', name: 'Test Hunt', status: 'live', starts_at: null, ends_at: null, approval_mode: 'manual' },
	player: { id: 'p', name: 'Alex', is_leader: true },
	team: { id: 't1', name: 'Banana Bunch', color: 'yellow', avatar: 'monkey' },
	players: [{ id: 'p', name: 'Alex', is_leader: true }],
	clues: [],
	leaderboard: [
		{ id: 't2', name: 'Zookeeperz', color: 'green', avatar: 'monkey', points: 1200, clues_found: 3, photos_submitted: 3, players: 2, rank: 1 },
		{ id: 't1', name: 'Banana Bunch', color: 'yellow', avatar: 'monkey', points: 900, clues_found: 2, photos_submitted: 4, players: 1, rank: 2 },
		{ id: 't3', name: 'Lion Kings', color: 'red', avatar: 'monkey', points: 0, clues_found: 0, photos_submitted: 0, players: 3, rank: 3 },
	],
	bonus: null,
	submissions: [],
	stats: { points: 900, rank: 2, clues_found: 2, photos_submitted: 4, clues_total: 10 },
};

vi.mock('../GameContext', () => ({
	useGameState: () => fixture,
	useGame: () => ({ state: fixture, toasts: [] }),
}));

import { Scoreboard } from './Scoreboard';

describe('<Scoreboard />', () => {
	let container: HTMLElement;
	const rows = () => Array.from(container.querySelectorAll<HTMLElement>('.team-row'));

	beforeEach(() => {
		({ container } = render(<Scoreboard />, { wrapper: MemoryRouter }));
	});

	it('lists every team in rank order with rank numbers', () => {
		expect(rows()).toHaveLength(3);
		expect(rows().map((r) => r.querySelector('.rank')?.textContent)).toEqual(['1', '2', '3']);
		expect(rows().map((r) => r.querySelector('.name')?.textContent)).toEqual(['Zookeeperz', 'Banana Bunch · you', 'Lion Kings']);
	});

	it('formats points with thousands separators', () => {
		expect(rows().map((r) => r.querySelector('.pts')?.textContent)).toEqual(['1,200', '900', '0']);
		expect(screen.getByText('1,200')).toBeInTheDocument();
	});

	it("marks only the player's own team", () => {
		const mine = rows()[1];
		expect(mine).toHaveClass('selected');
		expect(within(mine).getByText('· you')).toBeInTheDocument();
		expect(screen.getAllByText('· you')).toHaveLength(1);
		expect(rows()[0]).not.toHaveClass('selected');
	});

	it('colours each row by team colour', () => {
		expect(rows().map((r) => r.className)).toEqual([
			expect.stringContaining('team-green'),
			expect.stringContaining('team-yellow'),
			expect.stringContaining('team-red'),
		]);
	});

	it('shows the live indicator on the plank', () => {
		expect(screen.getByText('● LIVE')).toBeInTheDocument();
		expect(screen.getByText('Scoreboard')).toBeInTheDocument();
	});

	it('does not show the empty state when teams exist', () => {
		expect(screen.queryByText('No teams yet.')).toBeNull();
	});
});
