import { Link } from 'react-router-dom';
import { clueStatusIcon, clueStatusLabel, formatPoints } from '../../shared/format';
import { useGameState } from '../GameContext';
import { Bar, Screen } from '../components';

export function Clues() {
	const s = useGameState();
	const done = s.clues.filter((c) => c.status === 'complete').length;
	return (
		<Screen>
			<Bar right={`${done}/${s.clues.length}`}>Clues</Bar>
			{s.bonus && (
				<div className="card mt" style={{ background: 'var(--yellow-soft)' }}>
					<div className="eyebrow c-red">⭐ Bonus challenge · {formatPoints(s.bonus.points)} pts</div>
					<div className="bold" style={{ marginTop: 4 }}>
						{s.bonus.title}
					</div>
					{s.bonus.description && <div className="small muted">{s.bonus.description}</div>}
					<div className="tiny muted" style={{ marginTop: 6 }}>
						Show the host to claim it.
					</div>
				</div>
			)}
			<div className="list mt">
				{s.clues.map((c) => (
					<Link key={c.id} to={`/clues/${c.id}`} className={`clue-row ${c.status}`} aria-disabled={c.status === 'locked'}>
						<span className="num">{c.sort_order}</span>
						<span className="t">
							{c.title}
							<div className="tiny muted" style={{ fontWeight: 600 }}>
								{clueStatusLabel(c.status)}
							</div>
						</span>
						<span className="p">{c.status === 'locked' ? '—' : formatPoints(c.points)}</span>
						<span className={`st ${c.status}`} aria-label={clueStatusLabel(c.status)}>
							{clueStatusIcon(c.status)}
						</span>
					</Link>
				))}
				{s.clues.length === 0 && <div className="card soft tc muted">No clues yet — the host is still setting up.</div>}
			</div>
			{s.game.status === 'ended' && <div className="card mt tc bold c-red">The hunt has ended. Check the scoreboard!</div>}
		</Screen>
	);
}
