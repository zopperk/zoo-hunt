import { Link, Navigate, useParams } from 'react-router-dom';
import { formatPoints } from '../../shared/format';
import { useGameState } from '../GameContext';
import { BackLink, Bar, Screen } from '../components';

export function ClueDetail() {
	const { id } = useParams();
	const s = useGameState();
	const clue = s.clues.find((c) => c.id === id);
	if (!clue) return <Navigate to="/clues" replace />;
	const sub = s.submissions.find((x) => x.id === clue.submission_id) ?? s.submissions.find((x) => x.clue_id === clue.id && x.status !== 'rejected');

	return (
		<Screen>
			<div className="row between">
				<BackLink to="/clues">Clues</BackLink>
				<span className="eyebrow">{formatPoints(clue.points)} pts</span>
			</div>
			<Bar>
				Clue {clue.sort_order} of {s.clues.length}
			</Bar>

			{clue.status === 'locked' ? (
				<div className="card mt-l tc">
					<div style={{ fontSize: 40 }}>🔒</div>
					<div className="bold">This clue hasn’t been released yet.</div>
					<div className="small muted">Keep an eye out — the host will unlock it soon.</div>
				</div>
			) : (
				<>
					<div className="note mt-l">
						<p className="type" style={{ fontSize: 18, margin: 0 }}>
							{clue.body}
						</p>
						<div className="tc" style={{ fontSize: 64, marginTop: 14 }} aria-hidden>
							{clue.status === 'complete' ? '✅' : '❓'}
						</div>
					</div>

					{clue.status === 'complete' && sub && (
						<div className="card mt-l tc">
							<div className="eyebrow c-green">Found! +{formatPoints(sub.points_awarded)} pts</div>
							<img src={sub.photo_url} alt="Your team's find" style={{ width: '100%', borderRadius: 8, marginTop: 8, maxHeight: 220, objectFit: 'cover' }} />
						</div>
					)}
					{clue.status === 'pending' && sub && (
						<div className="card mt-l tc">
							<div className="eyebrow" style={{ color: '#9a7a12' }}>
								📷 Photo in review
							</div>
							<div className="small muted">The host is checking your photo. Points will land shortly.</div>
						</div>
					)}
				</>
			)}

			<div style={{ flex: 1 }} />
			{clue.status === 'available' && s.game.status === 'live' && (
				<Link to={`/clues/${clue.id}/snap`} className="btn block mt-l">
					I think I know!
				</Link>
			)}
			{clue.status === 'available' && s.game.status !== 'live' && <div className="card soft tc muted mt-l">Photos open once the host starts the game.</div>}
		</Screen>
	);
}
