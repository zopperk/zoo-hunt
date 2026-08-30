import { Link } from 'react-router-dom';
import { useGameState } from '../GameContext';
import { Bar, Screen } from '../components';

const PIN_FILL: Record<string, string> = {
	complete: '#2e6b3e',
	pending: '#f2c84b',
	available: '#c9432e',
	locked: '#9a8f7c',
};

const TREES: [number, number][] = [
	[20, 30],
	[60, 50],
	[250, 150],
	[280, 200],
	[30, 230],
	[150, 380],
	[260, 400],
	[120, 40],
];

/** Stylised zoo map (SVG) with clue pins positioned from clue.map_x / map_y (0–1). */
export function ZooMap() {
	const s = useGameState();
	const pins = s.clues.filter((c) => c.map_x !== null && c.map_y !== null);
	return (
		<Screen>
			<Bar>Zoo map</Bar>
			<div className="card mt" style={{ padding: 8 }}>
				<svg viewBox="0 0 300 420" width="100%" role="img" aria-label="Zoo map with clue locations" style={{ display: 'block', borderRadius: 8 }}>
					<rect width="300" height="420" fill="#cfe3b0" />
					<path d="M0 60 C 80 40, 120 110, 200 80 S 300 60, 300 100 L300 0 L0 0 Z" fill="#b7d497" />
					<path d="M0 420 C 60 380, 140 400, 190 340 S 300 300, 300 360 L300 420 Z" fill="#b7d497" />
					<ellipse cx="220" cy="230" rx="60" ry="34" fill="#9fd0e6" />
					<ellipse cx="70" cy="300" rx="34" ry="22" fill="#9fd0e6" />
					<path d="M30 400 C 60 300, 40 200, 110 150 S 240 110, 270 30" stroke="#e9d8a8" strokeWidth="14" fill="none" strokeLinecap="round" />
					<path d="M110 150 C 150 200, 120 300, 250 330" stroke="#e9d8a8" strokeWidth="12" fill="none" strokeLinecap="round" />
					<path d="M40 120 C 100 130, 140 60, 200 90" stroke="#e9d8a8" strokeWidth="10" fill="none" strokeLinecap="round" />
					{TREES.map(([x, y], i) => (
						<g key={i}>
							<circle cx={x} cy={y} r="11" fill="#5f9a4f" />
							<circle cx={x - 6} cy={y + 5} r="8" fill="#6faa5c" />
						</g>
					))}
					<text x="150" y="410" textAnchor="middle" fontSize="11" fill="#2b2118" fontFamily="Anton, Impact" letterSpacing="2">
						BRONX ZOO
					</text>
					{pins.map((c) => {
						const x = 12 + c.map_x! * 276;
						const y = 12 + c.map_y! * 380;
						return (
							<Link key={c.id} to={c.status === 'locked' ? '/map' : `/clues/${c.id}`}>
								<g>
									<circle cx={x} cy={y} r="14" fill={PIN_FILL[c.status]} stroke="#2b2118" strokeWidth="2" />
									<text x={x} y={y + 5} textAnchor="middle" fontSize="13" fontWeight="800" fill={c.status === 'pending' ? '#2b2118' : '#fff'} fontFamily="Nunito, sans-serif">
										{c.status === 'locked' ? '?' : c.sort_order}
									</text>
								</g>
							</Link>
						);
					})}
				</svg>
			</div>
			<div className="row wrap gap mt small" style={{ justifyContent: 'center' }}>
				<span className="pill complete">Found</span>
				<span className="pill pending">In review</span>
				<span className="pill" style={{ background: 'var(--red)', color: '#fff' }}>
					Open
				</span>
				<span className="pill locked">Locked</span>
			</div>
			{pins.length === 0 && <div className="card soft tc muted mt">Pins appear here as the host places clues on the map.</div>}
		</Screen>
	);
}
