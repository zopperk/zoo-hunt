import { formatPoints } from '../../shared/format';
import { useGameState } from '../GameContext';
import { Plank, Screen, TeamTile } from '../components';

/** Frame 06-scoreboard. */
export function Scoreboard() {
	const s = useGameState();
	return (
		<Screen>
			<div className="sheet">
				<Plank side={s.game.status === 'live' ? '● LIVE' : s.game.status.toUpperCase()}>Scoreboard</Plank>
				{s.leaderboard.map((t, i) => (
					<div key={t.id} className={`team-row team-${t.color} ${t.id === s.team.id ? 'selected' : ''}`} style={{ cursor: 'default', animationDelay: `${i * 40}ms` }}>
						<span className="rank">{t.rank}</span>
						<TeamTile color={t.color} size="xs" />
						<span className="name">
							{t.name}
							{t.id === s.team.id && <span className="tiny"> · you</span>}
						</span>
						<span className="pts">{formatPoints(t.points)}</span>
					</div>
				))}
				{s.leaderboard.length === 0 && <div className="card tc muted">No teams yet.</div>}
			</div>
		</Screen>
	);
}
