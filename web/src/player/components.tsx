import { NavLink, Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useGame } from './GameContext';

export function Bar({ children, left, right }: { children: ReactNode; left?: ReactNode; right?: ReactNode }) {
	return (
		<div className="bar">
			{left && <span className="bar-left">{left}</span>}
			{children}
			{right && <span className="bar-side">{right}</span>}
		</div>
	);
}

export function Avatar({ color, size }: { color: string; size?: 'sm' | 'lg' }) {
	return (
		<span className={`avatar team-${color} ${size ?? ''}`} aria-hidden>
			🐵
		</span>
	);
}

export function BottomNav() {
	const { state } = useGame();
	const pending = state?.clues.filter((c) => c.status === 'available').length ?? 0;
	const cls = ({ isActive }: { isActive: boolean }) => (isActive ? 'active' : '');
	return (
		<nav className="nav" aria-label="Main">
			<NavLink to="/map" className={cls}>
				<span className="ic">🗺️</span>Map
			</NavLink>
			<NavLink to="/clues" className={cls}>
				<span className="ic">🔍</span>Clues
				{pending > 0 && <span className="badge">{pending}</span>}
			</NavLink>
			<NavLink to="/scores" className={cls}>
				<span className="ic">🏆</span>Scores
			</NavLink>
			<NavLink to="/profile" className={cls}>
				<span className="ic">🐵</span>Team
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
		<main className={`screen paper ${nav ? '' : 'no-nav'} ${center ? 'screen-center' : ''}`}>
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
		<Link to={to} className="link">
			‹ {children}
		</Link>
	);
}
