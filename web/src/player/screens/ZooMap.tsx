import { Link } from 'react-router-dom';
import { useGameState } from '../GameContext';
import { Plank, Screen } from '../components';

/** Frame 05-map: plank + the zoo map image with clue pins (map_x / map_y in 0–1). */
export function ZooMap() {
	const s = useGameState();
	const pins = s.clues.filter((c) => c.map_x !== null && c.map_y !== null);
	return (
		<Screen>
			<div className="sheet">
				<Plank>Zoo map</Plank>
				<div className="map-wrap">
					<img src="/art/zoo-map.jpg" alt="Bronx Zoo map" />
					{pins.map((c) => (
						<Link
							key={c.id}
							to={c.status === 'locked' ? '/map' : `/clues/${c.id}`}
							className={`pin ${c.status}`}
							style={{ left: `${c.map_x! * 100}%`, top: `${c.map_y! * 100}%` }}
							aria-label={`Clue ${c.sort_order}`}
						>
							{c.status === 'locked' ? '?' : c.sort_order}
						</Link>
					))}
				</div>
				<div className="row wrap" style={{ justifyContent: 'center', gap: 8 }}>
					<span className="pill complete">Found</span>
					<span className="pill pending">In review</span>
					<span className="pill rejected">Open</span>
					<span className="pill locked">Locked</span>
				</div>
			</div>
		</Screen>
	);
}
