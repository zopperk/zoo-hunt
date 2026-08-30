import { Link, useNavigate } from 'react-router-dom';
import { useGame } from '../GameContext';
import { Screen } from '../components';

export function Welcome() {
	const { state, loading } = useGame();
	const nav = useNavigate();
	return (
		<Screen nav={false} center>
			<div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'center' }}>
				<div className="eyebrow" style={{ fontSize: 16, color: 'var(--red)' }}>
					{state?.game.name?.split('—')[0]?.trim() || 'Zaid turns 29'}
				</div>
				<h1 className="title-xl">
					<span className="c-green">Bronx Zoo</span>
					<br />
					<span className="c-red">Scavenger</span>
					<br />
					<span className="c-green">Hunt!</span>
				</h1>
				<div className="monkey" aria-hidden>
					🐵📸
				</div>
				<div className="card soft type small" style={{ maxWidth: 300 }}>
					Solve the clues, find the animals, snap a team selfie, and rack up points. Top team wins a prize!
				</div>
				{loading ? null : state ? (
					<>
						<button className="btn red block" onClick={() => nav('/clues')}>
							Let’s go, {state.team.name}!
						</button>
						<Link to="/how-to-play" className="link">
							How to play
						</Link>
					</>
				) : (
					<>
						<button className="btn red block" onClick={() => nav('/join')}>
							Let’s go!
						</button>
						<Link to="/how-to-play" className="link">
							How to play
						</Link>
					</>
				)}
			</div>
		</Screen>
	);
}
