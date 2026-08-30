import { Link, Navigate, useParams } from 'react-router-dom';
import { formatPoints } from '../../shared/format';
import { useGameState } from '../GameContext';
import { BackLink, Plank, Screen } from '../components';
import { QuestionDashedIcon, CameraIcon, LockIcon } from '../../shared/icons';

/** Frame 08-clue-details: "CLUE n OF 10" plank + paper note + I THINK I KNOW! */
export function ClueDetail() {
	const { id } = useParams();
	const s = useGameState();
	const clue = s.clues.find((c) => c.id === id);
	if (!clue) return <Navigate to="/clues" replace />;
	const sub = s.submissions.find((x) => x.id === clue.submission_id) ?? s.submissions.find((x) => x.clue_id === clue.id && x.status !== 'rejected');

	return (
		<Screen>
			<BackLink to="/clues">Clues</BackLink>
			<div className="sheet">
				<div className="row between">
					<Plank fit>
						Clue {clue.sort_order} of {s.clues.length}
					</Plank>
					<span className="eyebrow">{formatPoints(clue.points)} pts</span>
				</div>

				<div className="note" style={{ marginTop: 20 }}>
					{clue.status === 'locked' ? (
						<>
							<p className="body">This clue hasn’t been released yet. Keep an eye out — the host will unlock it soon!</p>
							<div className="big-ic">
								<LockIcon />
							</div>
						</>
					) : (
						<>
							<p className="body">{clue.body}</p>
							{clue.status === 'complete' && sub ? (
								<div className="tc" style={{ marginTop: 18 }}>
									<div className="polaroid" style={{ maxWidth: 220 }}>
										<img src={sub.photo_url} alt="Your team's find" />
									</div>
									<div className="eyebrow" style={{ color: 'var(--green)', marginTop: 10 }}>
										Found! +{formatPoints(sub.points_awarded)} pts
									</div>
								</div>
							) : clue.status === 'pending' ? (
								<div className="tc" style={{ marginTop: 18 }}>
									<div className="big-ic" style={{ color: 'var(--orange)' }}>
										<CameraIcon />
									</div>
									<div className="eyebrow" style={{ color: 'var(--orange)' }}>
										Photo in review
									</div>
								</div>
							) : (
								<div className="big-ic">
									<QuestionDashedIcon />
								</div>
							)}
						</>
					)}
				</div>
			</div>

			<div className="spacer" />
			{clue.status === 'available' && s.game.status === 'live' && (
				<Link to={`/clues/${clue.id}/snap`} className="btn md block mt-l">
					I think I know!
				</Link>
			)}
			{clue.status === 'available' && s.game.status !== 'live' && <div className="card tc muted mt-l">Photos open once the host starts the game.</div>}
		</Screen>
	);
}
