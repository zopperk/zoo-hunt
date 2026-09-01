import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { formatPoints } from '../../shared/format';
import { useGameState } from '../GameContext';
import { Confetti, Screen } from '../components';

/** Frame 10-submission: NICE SHOT! + snapshot + BACK TO CLUES. */
export function Submitted() {
	const { id } = useParams();
	const s = useGameState();
	const loc = useLocation() as { state?: { points?: number; photo?: string } };
	const clue = s.clues.find((c) => c.id === id);
	if (!clue) return <Navigate to="/clues" replace />;
	const sub = s.submissions.find((x) => x.clue_id === clue.id && x.status !== 'rejected');
	const photo = loc.state?.photo ?? sub?.photo_url;
	// Live state wins: if the host approved while this screen was open, show the real award.
	const points = sub?.status === 'approved' ? sub.points_awarded : (loc.state?.points ?? 0);
	const approved = points > 0;

	return (
		<Screen>
			<Confetti />
			<div className="submitted">
				<h1 className="display h-title">Nice shot!</h1>
				{photo && (
					<div className="snapshot">
						<img src={photo} alt="Submitted find" />
					</div>
				)}
				{approved ? (
					<div className="award">
						<div className="eyebrow" style={{ color: 'var(--rust)' }}>
							Submitted!
						</div>
						<div className="v">+{formatPoints(points)} points</div>
					</div>
				) : (
					<p className="h-sub">Your team’s photo has been submitted for review. The score will load shortly.</p>
				)}
			</div>
			<div className="spacer" />
			<Link to="/clues" className="btn md center">
				Back to clues
			</Link>
		</Screen>
	);
}
