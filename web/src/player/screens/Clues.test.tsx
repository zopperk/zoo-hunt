import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Bootstrap } from '../../shared/api';

const fixture: Bootstrap = {
	game: { id: 'g', code: 'ZOO-TEST', name: 'Test Hunt', status: 'live', starts_at: null, ends_at: null, approval_mode: 'manual' },
	player: { id: 'p', name: 'Alex', is_leader: true },
	team: { id: 't1', name: 'Banana Bunch', color: 'yellow', avatar: 'monkey' },
	players: [],
	clues: [
		{ id: 'c1', sort_order: 1, title: 'Splash Happy', body: 'hippo', animal: 'hippo', points: 150, status: 'complete', submission_id: 's1', map_x: null, map_y: null },
		{ id: 'c2', sort_order: 2, title: 'Striped & Proud', body: 'zebra', animal: 'zebra', points: 150, status: 'pending', submission_id: 's2', map_x: null, map_y: null },
		{ id: 'c3', sort_order: 3, title: 'Lunch in the Trees', body: 'giraffe', animal: 'giraffe', points: 150, status: 'available', submission_id: null, map_x: null, map_y: null },
		{ id: 'c4', sort_order: 4, title: 'Big Ears', body: null, animal: null, points: 150, status: 'locked', submission_id: null, map_x: null, map_y: null },
	],
	leaderboard: [],
	bonus: { id: 'b', title: 'Team photo with the elephant', description: '', points: 250 },
	submissions: [],
	stats: { points: 150, rank: 1, clues_found: 1, photos_submitted: 2, clues_total: 4 },
};

vi.mock('../GameContext', () => ({
	useGameState: () => fixture,
	useGame: () => ({ state: fixture, toasts: [] }),
}));

import { Clues } from './Clues';

describe('<Clues />', () => {
	it('renders every clue with its status and the completion count', () => {
		render(<Clues />, { wrapper: MemoryRouter });
		expect(screen.getByText('1/4')).toBeInTheDocument();
		expect(screen.getByText('Found')).toBeInTheDocument();
		expect(screen.getByText('In review')).toBeInTheDocument();
		expect(screen.getByText('Open')).toBeInTheDocument();
		expect(screen.getByText('Locked')).toBeInTheDocument();
	});

	it('hides points for locked clues and links open clues', () => {
		render(<Clues />, { wrapper: MemoryRouter });
		const locked = screen.getByText('Big Ears').closest('a')!;
		expect(locked).toHaveClass('locked');
		expect(locked).toHaveAttribute('aria-disabled', 'true');
		expect(locked).toHaveTextContent('—');
		expect(screen.getByText('Lunch in the Trees').closest('a')).toHaveAttribute('href', '/clues/c3');
	});

	it('shows the active bonus challenge', () => {
		render(<Clues />, { wrapper: MemoryRouter });
		expect(screen.getByText(/Bonus challenge · 250 pts/)).toBeInTheDocument();
		expect(screen.getByText('Team photo with the elephant')).toBeInTheDocument();
	});
});
