import { useNavigate } from 'react-router-dom';
import { useGame } from '../GameContext';
import { Screen } from '../components';

const STEPS = [
	{ icon: '🔍', title: 'Solve clues', text: 'Use the clues to find animals around the zoo.' },
	{ icon: '📸', title: 'Snap a photo', text: 'Take a team selfie with the correct animal (or its enclosure).' },
	{ icon: '⭐', title: 'Earn points', text: 'Submit your photo. The host approves it and you score!' },
	{ icon: '🏆', title: 'Top team wins', text: 'Most points at the end of the hunt takes the prize.' },
];

export function HowToPlay() {
	const nav = useNavigate();
	const { state } = useGame();
	return (
		<Screen nav={!!state}>
			<h1 className="title-l tc c-green" style={{ marginTop: 30 }}>
				How to play
			</h1>
			<div className="card mt-l" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
				{STEPS.map((s) => (
					<div key={s.title} className="row" style={{ alignItems: 'flex-start' }}>
						<div style={{ fontSize: 30, width: 44, textAlign: 'center' }} aria-hidden>
							{s.icon}
						</div>
						<div>
							<div className="eyebrow" style={{ color: 'var(--green-dark)' }}>
								{s.title}
							</div>
							<div className="small">{s.text}</div>
						</div>
					</div>
				))}
			</div>
			<div style={{ flex: 1 }} />
			<button className="btn block mt-l" onClick={() => nav(state ? '/clues' : '/join')}>
				{state ? 'Back to clues' : 'Next'}
			</button>
		</Screen>
	);
}
