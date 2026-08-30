import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { formatPoints } from '../../shared/format';
import { useGameState } from '../GameContext';
import { Screen } from '../components';

export function Submitted() {
	const { id } = useParams();
	const s = useGameState();
	const loc = useLocation() as { state?: { points?: number; photo?: string } };
	const clue = s.clues.find((c) => c.id === id);
	if (!clue) return <Navigate to="/clues" replace />;
	const sub = s.submissions.find((x) => x.clue_id === clue.id && x.status !== 'rejected');
	const photo = loc.state?.photo ?? sub?.photo_url;
	const points = loc.state?.points ?? sub?.points_awarded ?? 0;
	const approved = points > 0 || sub?.status === 'approved';
	const next = s.clues.find((c) => c.status === 'available' && c.id !== clue.id);

	return (
		<Screen center>
			<div className="confetti" aria-hidden>
				🎉✨🍌
			</div>
			<h1 className="title-l c-red">Nice shot!</h1>
			{photo && (
				<div className="polaroid mt">
					<img src={photo} alt="Submitted find" />
				</div>
			)}
			{approved ? (
				<div className="mt-l">
					<div className="eyebrow c-red" style={{ fontSize: 16 }}>
						Submitted!
					</div>
					<div className="display title-l c-green">+{formatPoints(points)} points</div>
				</div>
			) : (
				<p className="mt-l small" style={{ maxWidth: 280 }}>
					Your team’s photo has been sent to the host for review. Points will show up on the scoreboard once it’s approved.
				</p>
			)}
			<div className="mt-l" style={{ width: '100%' }}>
				{next ? (
					<Link to={`/clues/${next.id}`} className="btn block">
						On to the next clue!
					</Link>
				) : (
					<Link to="/clues" className="btn block">
						Back to clues
					</Link>
				)}
			</div>
		</Screen>
	);
}
