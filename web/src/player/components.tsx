import { NavLink, Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useGame } from './GameContext';
import { MagnifierIcon, MapIcon, TrophyIcon, PersonCircleIcon } from '../shared/icons';

/** Green header bar ("plank"). */
export function Plank({ children, side, fit }: { children: ReactNode; side?: ReactNode; fit?: boolean }) {
	return (
		<div className={`plank ${fit ? 'fit' : ''}`}>
			{children}
			{side && <span className="side">{side}</span>}
		</div>
	);
}

/** Colored square with the monkey head — the team avatar from the Figma. */
export function TeamTile({ color, size, selected, onClick, label }: { color: string; size?: 'xs' | 'sm' | 'lg'; selected?: boolean; onClick?: () => void; label?: string }) {
	const cls = `tile team-${color} ${size ?? ''} ${selected ? 'selected' : ''}`;
	const img = <img src="/art/monkey-head.png" alt="" />;
	if (onClick) {
		return (
			<button type="button" className={cls} onClick={onClick} aria-label={label ?? color} aria-pressed={selected}>
				{img}
			</button>
		);
	}
	return (
		<span className={cls} aria-hidden>
			{img}
		</span>
	);
}

export function BottomNav() {
	const { state } = useGame();
	const open = state?.clues.filter((c) => c.status === 'available').length ?? 0;
	const cls = ({ isActive }: { isActive: boolean }) => (isActive ? 'active' : '');
	return (
		<nav className="nav" aria-label="Main">
			<NavLink to="/clues" className={cls}>
				<MagnifierIcon />
				Clues
				{open > 0 && <span className="badge">{open}</span>}
			</NavLink>
			<NavLink to="/map" className={cls}>
				<MapIcon />
				Map
			</NavLink>
			<NavLink to="/scores" className={cls}>
				<TrophyIcon />
				Scores
			</NavLink>
			<NavLink to="/profile" className={cls}>
				<PersonCircleIcon />
				Team
			</NavLink>
		</nav>
	);
}

export function Toasts() {
	const { toasts } = useGame();
	if (!toasts.length) return null;
	return (
		<div aria-live="polite">
			{toasts.map((t, i) => (
				<div key={t.id} className={`toast ${t.kind === 'good' ? 'good' : ''}`} style={{ top: 14 + i * 58 }}>
					{t.text}
				</div>
			))}
		</div>
	);
}

export function Screen({ children, nav = true, center = false }: { children: ReactNode; nav?: boolean; center?: boolean }) {
	return (
		<main className={`screen paper ${nav ? '' : 'no-nav'} ${center ? 'center' : ''}`}>
			{children}
			{nav && <BottomNav />}
		</main>
	);
}

export function Spinner() {
	return <div className="spinner" role="status" aria-label="Loading" />;
}

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
	return (
		<Link to={to} className="link" style={{ alignSelf: 'flex-start', paddingLeft: 0 }}>
			‹ {children}
		</Link>
	);
}

const CONFETTI = ['#fcc637', '#7a9135', '#47839e', '#d35128', '#895e85', '#e57e23'];
export function Confetti({ count = 40 }: { count?: number }) {
	return (
		<div className="confetti" aria-hidden>
			{Array.from({ length: count }, (_, i) => (
				<i
					key={i}
					style={{
						left: `${(i * 37) % 100}%`,
						background: CONFETTI[i % CONFETTI.length],
						animationDelay: `${(i % 10) * 0.12}s`,
						animationDuration: `${2.2 + (i % 5) * 0.3}s`,
					}}
				/>
			))}
		</div>
	);
}
