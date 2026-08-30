import { formatPoints } from '../../shared/format';
import { useGameState } from '../GameContext';
import { Avatar, Bar, Screen } from '../components';

export function Scoreboard() {
	const s = useGameState();
	return (
		<Screen>
			<Bar right={s.game.status === 'live' ? '● LIVE' : s.game.status.toUpperCase()}>Scoreboard</Bar>
			<div className="list mt">
				{s.leaderboard.map((t) => (
					<div key={t.id} className={`team-row team-${t.color} ${t.id === s.team.id ? 'selected' : ''}`} style={{ cursor: 'default' }}>
						<span className="rank">{t.rank}</span>
						<Avatar color={t.color} size="sm" />
						<span className="name">
							{t.name}
							{t.id === s.team.id && <span className="tiny"> · you</span>}
							<div className="tiny" style={{ fontWeight: 600, opacity: 0.8 }}>
								{t.clues_found} {t.clues_found === 1 ? 'clue' : 'clues'} · {t.players} {t.players === 1 ? 'player' : 'players'}
							</div>
						</span>
						<span className="pts">{formatPoints(t.points)}</span>
					</div>
				))}
				{s.leaderboard.length === 0 && <div className="card soft tc muted">No teams yet.</div>}
			</div>
		</Screen>
	);
}
