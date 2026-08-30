import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Bootstrap } from '../../shared/api';

// Mock the game context so the screen renders against fixed state.
const fixture: Bootstrap = {
	game: { id: 'g', code: 'ZOO-TEST', name: 'Test Hunt', status: 'live', starts_at: null, ends_at: null, approval_mode: 'manual' },
	player: { id: 'p', name: 'Alex', is_leader: true },
	team: { id: 't1', name: 'Banana Bunch', color: 'yellow', avatar: 'monkey' },
	players: [{ id: 'p', name: 'Alex', is_leader: true }],
	clues: [],
	leaderboard: [
		{ id: 't2', name: 'Zookeeperz', color: 'green', avatar: 'monkey', points: 1200, clues_found: 3, photos_submitted: 3, players: 2, rank: 1 },
		{ id: 't1', name: 'Banana Bunch', color: 'yellow', avatar: 'monkey', points: 900, clues_found: 2, photos_submitted: 4, players: 1, rank: 2 },
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
	beforeEach(() => render(<Scoreboard />, { wrapper: MemoryRouter }));

	it('lists teams in rank order with formatted points', () => {
		const rows = screen.getAllByText(/Zookeeperz|Banana Bunch/);
		expect(rows[0]).toHaveTextContent('Zookeeperz');
		expect(screen.getByText('1,200')).toBeInTheDocument();
		expect(screen.getByText('900')).toBeInTheDocument();
	});

	it("marks the player's own team", () => {
		expect(screen.getByText('· you')).toBeInTheDocument();
	});

	it('shows the live indicator', () => {
		expect(screen.getByText('● LIVE')).toBeInTheDocument();
	});
});
