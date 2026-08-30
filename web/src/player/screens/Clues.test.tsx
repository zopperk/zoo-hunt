import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Bootstrap } from '../../shared/api';

const fixture: Bootstrap = {
	game: { id: 'g', code: 'ZOO-TEST', name: 'Test Hunt', status: 'live', starts_at: null, ends_at: null, approval_mode: 'manual' },
	player: { id: 'p', name: 'Alex', is_leader: true },
	team: { id: 't1', name: 'Banana Bunch', color: 'yellow', avatar: 'monkey' },
	players: [],
	clues: [
		{ id: 'c1', sort_order: 1, title: 'Splash Happy', body: 'Find the hippo pool', animal: 'hippo', points: 150, status: 'complete', submission_id: 's1', map_x: null, map_y: null },
		{ id: 'c2', sort_order: 2, title: 'Striped & Proud', body: 'Find the zebras', animal: 'zebra', points: 150, status: 'pending', submission_id: 's2', map_x: null, map_y: null },
		{ id: 'c3', sort_order: 3, title: 'Lunch in the Trees', body: 'Find the giraffes', animal: 'giraffe', points: 1250, status: 'available', submission_id: null, map_x: null, map_y: null },
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

const LOCKED_TEXT = 'Locked — the host will release this clue soon.';

function renderClues() {
	const utils = render(<Clues />, { wrapper: MemoryRouter });
	const card = (id: string) => utils.container.querySelector<HTMLAnchorElement>(`a[href="/clues/${id}"]`)!;
	return { ...utils, card };
}

describe('<Clues />', () => {
	it('shows the completion count on the plank', () => {
		renderClues();
		expect(screen.getByText('1/4')).toBeInTheDocument();
	});

	it('renders one card per clue, in order, labelled with its status', () => {
		const { container } = renderClues();
		const cards = Array.from(container.querySelectorAll('a.clue-card'));
		expect(cards.map((c) => c.getAttribute('aria-label'))).toEqual(['Clue 1: Found', 'Clue 2: In review', 'Clue 3: Open', 'Clue 4: Locked']);
		expect(cards.map((c) => c.className)).toEqual(['clue-card complete', 'clue-card pending', 'clue-card available', 'clue-card locked']);
		for (const name of ['Clue 1: Found', 'Clue 2: In review', 'Clue 3: Open', 'Clue 4: Locked']) {
			expect(screen.getByRole('link', { name })).toBeInTheDocument();
		}
	});

	it('renders an accessible status icon on every card', () => {
		const { card } = renderClues();
		expect(within(card('c1')).getByRole('img', { name: 'Found' })).toBeInTheDocument();
		expect(within(card('c2')).getByRole('img', { name: 'In review' })).toBeInTheDocument();
		expect(within(card('c3')).getByRole('img', { name: 'Open' })).toBeInTheDocument();
		expect(within(card('c4')).getByRole('img', { name: 'Locked' })).toBeInTheDocument();
	});

	it('links open clues to their detail page with body text and points', () => {
		const { card } = renderClues();
		const open = card('c3');
		expect(open).toHaveAttribute('href', '/clues/c3');
		expect(open).not.toHaveAttribute('aria-disabled', 'true');
		expect(within(open).getByText('Find the giraffes')).toBeInTheDocument();
		expect(within(open).getByText('1,250 pts')).toBeInTheDocument();
		expect(within(open).getByText('Clue #3')).toBeInTheDocument();
		expect(open.querySelector('.stamp')).toBeNull();
	});

	it('disables locked clues, hides their body and points, and explains why', () => {
		const { card } = renderClues();
		const locked = card('c4');
		expect(locked).toHaveClass('locked');
		expect(locked).toHaveAttribute('aria-disabled', 'true');
		expect(within(locked).getByText(LOCKED_TEXT)).toBeInTheDocument();
		expect(within(locked).queryByText(/pts$/)).toBeNull();
		// Only the locked card carries the locked explanation.
		expect(screen.getAllByText(LOCKED_TEXT)).toHaveLength(1);
	});

	it('stamps completed clues as Found', () => {
		const { card, container } = renderClues();
		const stamp = card('c1').querySelector('.stamp');
		expect(stamp).not.toBeNull();
		expect(stamp).toHaveTextContent('Found');
		expect(container.querySelectorAll('.stamp')).toHaveLength(1);
		// Pending clues are still awaiting review, so no stamp yet.
		expect(card('c2').querySelector('.stamp')).toBeNull();
	});

	it('shows the active bonus challenge with its points', () => {
		renderClues();
		expect(screen.getByText('Bonus · 250 pts')).toBeInTheDocument();
		expect(screen.getByText('Team photo with the elephant')).toBeInTheDocument();
		expect(screen.getByRole('img', { name: 'Bonus challenge' })).toBeInTheDocument();
	});

	it('does not show the ended banner while the game is live', () => {
		renderClues();
		expect(screen.queryByText(/The hunt has ended/)).toBeNull();
	});
});
