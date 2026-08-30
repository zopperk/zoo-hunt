import { useNavigate } from 'react-router-dom';
import { useGame } from '../GameContext';
import { Screen } from '../components';
import { MagnifierIcon, CameraIcon, StarIcon, TrophyIcon } from '../../shared/icons';

const STEPS = [
	{ Icon: MagnifierIcon, title: 'Solve clues', text: 'Follow the clues to find animals around the zoo.' },
	{ Icon: CameraIcon, title: 'Snap a photo', text: 'Take a team selfie with the correct animal’s enclosure.' },
	{ Icon: StarIcon, title: 'Earn points', text: 'Submit your photo to earn points!' },
	{ Icon: TrophyIcon, title: 'Win a prize', text: 'The team with the highest score earns a special prize!' },
];

/** Frame 03-how-to-play. */
export function HowToPlay() {
	const nav = useNavigate();
	const { state } = useGame();
	return (
		<Screen nav={!!state}>
			<h1 className="display h-title" style={{ marginTop: 80 }}>
				How to play
			</h1>
			<div className="card mt-l" style={{ padding: 28, marginTop: 50 }}>
				<div className="steps">
					{STEPS.map(({ Icon, title, text }) => (
						<div key={title} className="step">
							<Icon />
							<div>
								<div className="st">{title}</div>
								<div className="sd">{text}</div>
							</div>
						</div>
					))}
				</div>
			</div>
			<div className="spacer" />
			<button className="btn md center mt-l" style={{ minWidth: 207 }} onClick={() => nav(state ? '/clues' : '/join')}>
				Next
			</button>
		</Screen>
	);
}
