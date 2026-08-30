import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { formatPoints } from '../../shared/format';
import { useGameState } from '../GameContext';
import { Confetti, Screen } from '../components';

/** Frame 10-submission: NICE SHOT! + polaroid + BACK TO CLUES. */
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
			<div className="sheet" style={{ marginTop: 20 }}>
				<div className="card tc" style={{ padding: '18px 16px 22px' }}>
					<h1 className="display" style={{ fontSize: 40, color: 'var(--orange)' }}>
						Nice shot!
					</h1>
					{photo && (
						<div className="polaroid mt" style={{ maxWidth: 300 }}>
							<img src={photo} alt="Submitted find" style={{ aspectRatio: '1 / 1' }} />
						</div>
					)}
					{approved ? (
						<div className="mt">
							<div className="eyebrow" style={{ color: 'var(--orange)' }}>
								Submitted!
							</div>
							<div className="score-box" style={{ background: 'transparent', border: 0, padding: 0 }}>
								<div className="v">+{formatPoints(points)} points</div>
							</div>
						</div>
					) : (
						<p className="h-sub mt" style={{ fontSize: 16, lineHeight: 1.35 }}>
							Your team’s photo has been submitted for review. The score will load shortly.
						</p>
					)}
				</div>
			</div>
			<div className="spacer" />
			<Link to="/clues" className="btn md block mt-l">
				Back to clues
			</Link>
		</Screen>
	);
}
